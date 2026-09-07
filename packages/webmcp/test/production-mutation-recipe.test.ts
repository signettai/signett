import { describe, expect, it, vi } from "vitest";

import {
  exposeCancellationReceipt,
  exposeCancelOrder,
  type CancellationExecutionResult,
  type CancellationIntent,
  type CancellationReceipt,
  type CancelOrderDependencies,
  type CancelOrderInput,
  type Order,
} from "../recipes/production-mutation.js";
import { assertToolReady } from "../src/index.js";
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
  const orders = new Map<string, Order>([
    [
      "order-1",
      {
        id: "order-1",
        accountId: "account-1",
        status: "open",
        version: "version-3",
      },
    ],
  ]);
  const receipts = new Map<string, CancellationReceipt>();
  const failedReceiptReads = new Set<number>();
  let ambiguousFailures = 0;
  let effects = 0;
  let lostResponses = 0;
  let receiptReads = 0;
  let staleRejections = 0;

  const cancelOrder = vi.fn(
    async (intent: CancelOrderInput): Promise<CancellationExecutionResult> => {
      if (ambiguousFailures > 0) {
        ambiguousFailures -= 1;
        throw new Error("The server connection failed without an outcome.");
      }

      const existing = receipts.get(intent.operationId);
      if (existing) {
        if (!receiptMatchesInput(existing, intent)) {
          return {
            status: "rejected",
            effect: "not_applied",
            code: "operation_id_reused",
            message: "The operation ID is already bound to different intent.",
          };
        }
        return { status: "committed", receipt: existing };
      }

      if (staleRejections > 0) {
        staleRejections -= 1;
        return {
          status: "rejected",
          effect: "not_applied",
          code: "approved_state_changed",
          message: "The approved order version is stale.",
        };
      }

      const order = orders.get(intent.orderId);
      if (!order || order.version !== intent.expectedVersion) {
        return {
          status: "rejected",
          effect: "not_applied",
          code: "approved_state_changed",
          message: "The approved order version is stale.",
        };
      }

      effects += 1;
      const updated = {
        ...order,
        status: "cancelled",
        version: "version-4",
      } as const;
      orders.set(intent.orderId, updated);
      const receipt: CancellationReceipt = {
        operationId: intent.operationId,
        accountId: order.accountId,
        orderId: order.id,
        reason: intent.reason,
        approvedVersion: intent.expectedVersion,
        resultingVersion: updated.version,
        status: "cancelled",
        committedAt: "2026-09-07T12:00:00.000Z",
      };
      receipts.set(intent.operationId, receipt);
      if (lostResponses > 0) {
        lostResponses -= 1;
        throw new Error("The server committed but the response was lost.");
      }
      return { status: "committed", receipt };
    },
  );

  return {
    addOrder(order: Order) {
      orders.set(order.id, order);
    },
    cancelOrder,
    async commit(intent: CancelOrderInput): Promise<CancellationReceipt> {
      const result = await cancelOrder(intent);
      if (result.status !== "committed") {
        throw new Error(`Unable to seed receipt: ${result.code}`);
      }
      return result.receipt;
    },
    effects: () => effects,
    failNextAmbiguously(count = 1) {
      ambiguousFailures = count;
    },
    failReceiptReadOn(...readNumbers: number[]) {
      for (const readNumber of readNumbers) failedReceiptReads.add(readNumber);
    },
    getOrder: async (orderId: string) => orders.get(orderId) ?? null,
    getReceipt: async (operationId: string) => {
      receiptReads += 1;
      if (failedReceiptReads.delete(receiptReads)) {
        throw new Error("Receipt service temporarily unavailable.");
      }
      return receipts.get(operationId) ?? null;
    },
    loseNextResponses(count = 1) {
      lostResponses = count;
    },
    rejectNextAsStale(count = 1) {
      staleRejections = count;
    },
    updateOrder(orderId: string, update: Partial<Order>) {
      const order = orders.get(orderId);
      if (!order) throw new Error(`Unknown order ${orderId}`);
      orders.set(orderId, { ...order, ...update });
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
    getOrder: (orderId) => backend.getOrder(orderId),
    requestApproval: options.approval ?? (async () => true),
    cancelOrder: (intent) => backend.cancelOrder(intent),
    getCancellationReceipt: (operationId) => backend.getReceipt(operationId),
  };
}

function receiptMatchesInput(
  receipt: CancellationReceipt,
  candidate: CancelOrderInput,
): boolean {
  return (
    receipt.operationId === candidate.operationId &&
    receipt.orderId === candidate.orderId &&
    receipt.reason === candidate.reason &&
    receipt.approvedVersion === candidate.expectedVersion
  );
}

function operationKey(candidate: CancelOrderInput): string {
  return JSON.stringify([
    "cancel:v1",
    "account-1",
    candidate.operationId,
    candidate.orderId,
    candidate.reason,
    candidate.expectedVersion,
  ]);
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

  it("uses unambiguous keys for delimiter-containing intent fields", async () => {
    const backend = createBackend();
    const harness = createWebMcpTestHarness();
    const firstInput: CancelOrderInput = {
      ...input,
      operationId: "operation",
      orderId: "left:right",
    };
    const secondInput: CancelOrderInput = {
      ...input,
      operationId: "operation:left",
      orderId: "right",
    };
    backend.addOrder({
      id: firstInput.orderId,
      accountId: "account-1",
      status: "open",
      version: input.expectedVersion,
    });
    backend.addOrder({
      id: secondInput.orderId,
      accountId: "account-1",
      status: "open",
      version: input.expectedVersion,
    });
    const registration = await exposeCancelOrder(
      dependencies(backend, { modelContext: harness.modelContext }),
    );

    const first = await harness.invoke("cancel_order", firstInput);
    const second = await harness.invoke("cancel_order", secondInput);

    expect(first).toMatchObject({
      operationId: "operation",
      orderId: "left:right",
    });
    expect(second).toMatchObject({
      operationId: "operation:left",
      orderId: "right",
    });
    expect(backend.effects()).toBe(2);
    registration.dispose();
  });

  it("rejects a replayed output that differs from the authoritative receipt", async () => {
    const backend = createBackend();
    const otherInput: CancelOrderInput = {
      ...input,
      operationId: "cancel-order-2",
      orderId: "order-2",
    };
    backend.addOrder({
      id: otherInput.orderId,
      accountId: "account-1",
      status: "open",
      version: otherInput.expectedVersion,
    });
    const wrongReceipt = await backend.commit(input);
    await backend.commit(otherInput);

    const operationStore = new MemoryIdempotencyStore();
    const storeOptions = { signal: new AbortController().signal };
    await operationStore.begin(operationKey(otherInput), storeOptions);
    await operationStore.complete(
      operationKey(otherInput),
      wrongReceipt,
      storeOptions,
    );

    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, {
        modelContext: harness.modelContext,
        operationStore,
      }),
    );

    await expect(
      harness.invoke("cancel_order", otherInput),
    ).rejects.toMatchObject({ code: "verification_failed" });
    expect(backend.effects()).toBe(2);
    registration.dispose();
  });

  it("refuses execution when state changes after the approved version", async () => {
    const backend = createBackend();
    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, {
        modelContext: harness.modelContext,
        approval: async () => {
          backend.updateOrder(input.orderId, { version: "version-4" });
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

  it("reports a server-proven stale rejection without marking the outcome unknown", async () => {
    const backend = createBackend();
    backend.rejectNextAsStale();
    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, { modelContext: harness.modelContext }),
    );

    await expect(harness.invoke("cancel_order", input)).rejects.toMatchObject({
      code: "approved_state_changed",
    });
    expect(backend.effects()).toBe(0);

    await expect(harness.invoke("cancel_order", input)).resolves.toMatchObject({
      operationId: input.operationId,
      status: "cancelled",
    });
    expect(backend.effects()).toBe(1);
    registration.dispose();
  });

  it("reports operation-ID reuse as a known conflict", async () => {
    const backend = createBackend();
    await backend.commit(input);
    const conflictingInput: CancelOrderInput = {
      ...input,
      reason: "duplicate",
    };
    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, { modelContext: harness.modelContext }),
    );

    await expect(
      harness.invoke("cancel_order", conflictingInput),
    ).rejects.toMatchObject({
      code: "operation_id_reused",
      retry: "after_repair",
    });
    expect(backend.effects()).toBe(1);
    registration.dispose();
  });

  it("keeps arbitrary failures after the effect boundary outcome-unknown", async () => {
    const backend = createBackend();
    backend.failNextAmbiguously();
    const harness = createWebMcpTestHarness();
    const registration = await exposeCancelOrder(
      dependencies(backend, { modelContext: harness.modelContext }),
    );

    await expect(harness.invoke("cancel_order", input)).rejects.toMatchObject({
      code: "outcome_unknown",
      retryable: false,
    });
    expect(backend.effects()).toBe(0);
    registration.dispose();
  });

  it("recovers a durable receipt in a fresh client without repeating the effect", async () => {
    const backend = createBackend();
    backend.loseNextResponses();
    backend.failReceiptReadOn(2);

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
