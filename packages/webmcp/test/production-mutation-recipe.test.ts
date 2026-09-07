import { describe, expect, it, vi } from "vitest";

import {
  exposeCancellationReceipt,
  exposeCancelOrder,
  type CancellationIntent,
  type CancellationReceipt,
  type CancelOrderDependencies,
  type CancelOrderInput,
  type Order,
} from "../recipes/production-mutation.js";
import { assertToolReady, ToolError } from "../src/index.js";
import {
  createWebMcpTestHarness,
  MemoryIdempotencyStore,
  MemoryOperationJournal,
} from "../src/testing.js";

const input: CancelOrderInput = {
  orderId: "order-1",
  reason: "customer_request",
  operationId: "cancel-order-1",
  expectedVersion: "version-3",
};

function createBackend() {
  let order: Order = {
    id: "order-1",
    accountId: "account-1",
    status: "open",
    version: "version-3",
  };
  let effects = 0;
  let lostResponses = 0;
  let receiptReadFailures = 0;
  const receipts = new Map<string, CancellationReceipt>();

  const cancelOrder = vi.fn(
    async (intent: CancelOrderInput): Promise<CancellationReceipt> => {
      const existing = receipts.get(intent.operationId);
      if (existing) {
        if (
          existing.orderId !== intent.orderId ||
          existing.reason !== intent.reason ||
          existing.approvedVersion !== intent.expectedVersion
        ) {
          throw new ToolError({
            code: "operation_id_reused",
            message: "The operation ID is already bound to different intent.",
            retryable: false,
          });
        }
        return existing;
      }
      if (order.version !== intent.expectedVersion) {
        throw new ToolError({
          code: "approved_state_changed",
          message: "The approved order version is stale.",
          retryable: false,
        });
      }

      effects += 1;
      order = { ...order, status: "cancelled", version: "version-4" };
      const receipt: CancellationReceipt = {
        operationId: intent.operationId,
        accountId: order.accountId,
        orderId: order.id,
        reason: intent.reason,
        approvedVersion: intent.expectedVersion,
        resultingVersion: order.version,
        status: "cancelled",
        committedAt: "2026-09-07T12:00:00.000Z",
      };
      receipts.set(intent.operationId, receipt);
      if (lostResponses > 0) {
        lostResponses -= 1;
        throw new Error("The server committed but the response was lost.");
      }
      return receipt;
    },
  );

  return {
    cancelOrder,
    effects: () => effects,
    failNextReceiptReads(count = 1) {
      receiptReadFailures = count;
    },
    loseNextResponses(count = 1) {
      lostResponses = count;
    },
    getOrder: async () => order,
    getReceipt: async (operationId: string) => {
      if (receiptReadFailures > 0) {
        receiptReadFailures -= 1;
        throw new Error("Receipt service temporarily unavailable.");
      }
      return receipts.get(operationId) ?? null;
    },
    updateOrder(update: Partial<Order>) {
      order = { ...order, ...update };
    },
  };
}

function dependencies(
  backend: ReturnType<typeof createBackend>,
  options: {
    approval?: (intent: CancellationIntent) => Promise<boolean>;
    modelContext?: CancelOrderDependencies["modelContext"];
    operationStore?: MemoryIdempotencyStore;
    operationJournal?: MemoryOperationJournal;
  } = {},
): CancelOrderDependencies {
  return {
    ...(options.modelContext ? { modelContext: options.modelContext } : {}),
    operationStore: options.operationStore ?? new MemoryIdempotencyStore(),
    operationJournal: options.operationJournal ?? new MemoryOperationJournal(),
    getSession: async () => ({
      accountId: "account-1",
      scopes: ["orders:cancel"],
    }),
    getOrder: (orderId) =>
      backend.getOrder().then((order) => (order.id === orderId ? order : null)),
    requestApproval: options.approval ?? (async () => true),
    cancelOrder: (intent) => backend.cancelOrder(intent),
    getCancellationReceipt: (operationId) => backend.getReceipt(operationId),
  };
}

describe("production mutation recipe", () => {
  it("binds approval, idempotency, and the receipt to the exact intent", async () => {
    const backend = createBackend();
    const harness = createWebMcpTestHarness();
    const requestApproval = vi.fn(async () => true);
    const registration = await exposeCancelOrder(
      dependencies(backend, {
        approval: requestApproval,
        modelContext: harness.modelContext,
      }),
    );

    const [tool] = harness.tools();
    expect(tool).toBeDefined();
    expect(() => assertToolReady(tool!)).not.toThrow();

    const first = await harness.invoke("cancel_order", input);
    const replay = await harness.invoke("cancel_order", input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      operationId: input.operationId,
      orderId: input.orderId,
      reason: input.reason,
      approvedVersion: input.expectedVersion,
      status: "cancelled",
    });
    expect(requestApproval).toHaveBeenCalledOnce();
    expect(requestApproval).toHaveBeenCalledWith({
      ...input,
      summary: "Cancel order order-1 as customer_request at version version-3.",
    });
    expect(backend.effects()).toBe(1);

    registration.dispose();
    expect(harness.tools()).toEqual([]);
  });

  it("refuses execution when state changes after the approved version", async () => {
    const backend = createBackend();
    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, {
        modelContext: harness.modelContext,
        approval: async () => {
          backend.updateOrder({ version: "version-4" });
          return true;
        },
      }),
    );

    await expect(harness.invoke("cancel_order", input)).rejects.toMatchObject({
      code: "approved_state_changed",
    });
    expect(backend.cancelOrder).not.toHaveBeenCalled();
    expect(backend.effects()).toBe(0);

    registration.dispose();
  });

  it("recovers a durable receipt in a fresh client without repeating the effect", async () => {
    const backend = createBackend();
    backend.loseNextResponses();
    backend.failNextReceiptReads();

    const firstHarness = createWebMcpTestHarness();
    const firstRegistration = await exposeCancelOrder(
      dependencies(backend, { modelContext: firstHarness.modelContext }),
    );
    await expect(
      firstHarness.invoke("cancel_order", input),
    ).rejects.toMatchObject({ code: "outcome_unknown", retryable: false });
    expect(backend.effects()).toBe(1);
    firstRegistration.dispose();

    const freshHarness = createWebMcpTestHarness();
    const freshDependencies = dependencies(backend, {
      modelContext: freshHarness.modelContext,
    });
    const receiptRegistration =
      await exposeCancellationReceipt(freshDependencies);
    const cancelRegistration = await exposeCancelOrder(freshDependencies);

    await expect(
      freshHarness.invoke("get_cancellation_receipt", {
        operationId: input.operationId,
      }),
    ).resolves.toMatchObject({
      status: "committed",
      receipt: { operationId: input.operationId, status: "cancelled" },
    });

    await expect(
      freshHarness.invoke("cancel_order", input),
    ).resolves.toMatchObject({
      operationId: input.operationId,
      status: "cancelled",
    });
    expect(backend.cancelOrder).toHaveBeenCalledOnce();
    expect(backend.effects()).toBe(1);

    receiptRegistration.dispose();
    cancelRegistration.dispose();
  });
});
