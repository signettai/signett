import {
  ToolError,
  createSignett,
  type GuardObserver,
  type IdempotencyStore,
  type ModelContextLike,
  type OperationJournal,
} from "signett";

type Session = {
  accountId: string;
  scopes: string[];
};

export type CancelOrderInput = {
  orderId: string;
  reason: "customer_request" | "duplicate";
  operationId: string;
  expectedVersion: string;
};

export type Order = {
  id: string;
  accountId: string;
  status: "open" | "cancelled" | "shipped";
  version: string;
};

export type CancellationIntent = Readonly<CancelOrderInput> & {
  summary: string;
};

export type CancellationReceipt = {
  operationId: string;
  accountId: string;
  orderId: string;
  reason: CancelOrderInput["reason"];
  approvedVersion: string;
  resultingVersion: string;
  status: "cancelled";
  committedAt: string;
};

export type CancellationRejection = {
  status: "rejected";
  effect: "not_applied";
  code: "operation_id_reused" | "approved_state_changed";
  message: string;
};

export type CancellationExecutionResult =
  { status: "committed"; receipt: CancellationReceipt } | CancellationRejection;

type ReceiptStatus =
  | { status: "not_found" }
  | { status: "committed"; receipt: CancellationReceipt };

export interface CancelOrderDependencies {
  modelContext?: ModelContextLike;
  operationStore: IdempotencyStore;
  operationJournal: OperationJournal;
  observe?: GuardObserver;
  getSession(options: { signal: AbortSignal }): Promise<Session>;
  getOrder(
    orderId: string,
    options: { accountId: string; signal: AbortSignal },
  ): Promise<Order | null>;
  requestApproval(intent: CancellationIntent): Promise<boolean>;
  /**
   * The server implementation must atomically bind operationId to the complete
   * cancellation intent and return an existing equal-intent receipt on retry.
   * A known conflict must return `rejected` with `effect: "not_applied"`.
   * Throw when the outcome is not known; a missing receipt is not proof that the
   * effect did not occur.
   */
  cancelOrder(
    input: CancelOrderInput,
    options: { accountId: string; signal: AbortSignal },
  ): Promise<CancellationExecutionResult>;
  /** Read a durable server-owned receipt; never derive it from browser state. */
  getCancellationReceipt(
    operationId: string,
    options: { accountId: string; signal: AbortSignal },
  ): Promise<CancellationReceipt | null>;
}

/** Copy this boundary and replace the order-specific application functions. */
export async function exposeCancelOrder(dependencies: CancelOrderDependencies) {
  const signett = createInterface(dependencies);

  return await signett.expose<CancelOrderInput, CancellationReceipt>({
    name: "cancel_order",
    description:
      "Cancel one unshipped order for the signed-in account. Inspect the order first and pass its current version. The operation requires approval of the exact order, reason, and version.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Stable identifier of the order to cancel.",
          minLength: 1,
          maxLength: 128,
        },
        reason: {
          description: "Why the signed-in account is cancelling the order.",
          enum: ["customer_request", "duplicate"],
        },
        operationId: {
          type: "string",
          description:
            "Stable identifier reused only for retries of this exact cancellation intent.",
          minLength: 1,
          maxLength: 64,
        },
        expectedVersion: {
          type: "string",
          description:
            "Current authoritative order version observed before approval.",
          minLength: 1,
          maxLength: 128,
        },
      },
      required: ["orderId", "reason", "operationId", "expectedVersion"],
      additionalProperties: false,
    },
    authorize: ({ context }) => context.scopes.includes("orders:cancel"),
    confirm: {
      mode: "effect-only",
      request: ({ input }) => dependencies.requestApproval(intentFor(input)),
    },
    idempotency: {
      store: dependencies.operationStore,
      key: ({ input, context }) =>
        JSON.stringify([
          "cancel:v1",
          context.accountId,
          input.operationId,
          input.orderId,
          input.reason,
          input.expectedVersion,
        ]),
    },
    journal: { store: dependencies.operationJournal },
    execute: async (input, { context, operation, signal }) => {
      const existingReceipt = await dependencies.getCancellationReceipt(
        input.operationId,
        { accountId: context.accountId, signal },
      );
      if (existingReceipt) {
        if (matchesRequestedReceipt(existingReceipt, input, context)) {
          return existingReceipt;
        }
        throw operationConflict();
      }

      const order = await dependencies.getOrder(input.orderId, {
        accountId: context.accountId,
        signal,
      });
      if (!order || order.accountId !== context.accountId) {
        throw new ToolError({
          code: "order_not_found",
          message: "The order is not available to the signed-in account.",
          retryable: false,
        });
      }
      if (order.version !== input.expectedVersion) {
        throw new ToolError({
          code: "approved_state_changed",
          message:
            "The order changed after it was inspected. Inspect it again and request approval for the current version.",
          retry: "after_repair",
          repair: {
            steps: [
              {
                action: "refresh_state",
                instruction: "Inspect the current authoritative order version.",
              },
              {
                action: "change_input",
                instruction:
                  "Use the current version and a new operationId, then request approval again.",
              },
            ],
            update: ["expectedVersion", "operationId"],
          },
        });
      }
      if (order.status === "shipped") {
        throw new ToolError({
          code: "order_already_shipped",
          message: "Shipped orders cannot be cancelled.",
          retryable: false,
        });
      }

      await operation?.write({
        operationId: input.operationId,
        orderId: input.orderId,
      });
      const result = await dependencies.cancelOrder(input, {
        accountId: context.accountId,
        signal,
      });
      if (result.status === "rejected") {
        await operation?.remove();
        throw rejectionError(result);
      }
      return result.receipt;
    },
    recover: async ({ input, context, signal }) => {
      const receipt = await dependencies.getCancellationReceipt(
        input.operationId,
        { accountId: context.accountId, signal },
      );
      return matchesRequestedReceipt(receipt, input, context)
        ? { recovered: true, output: receipt }
        : { recovered: false };
    },
    verify: async ({ input, output, context, signal }) => {
      const receipt = await dependencies.getCancellationReceipt(
        input.operationId,
        { accountId: context.accountId, signal },
      );
      return (
        matchesRequestedReceipt(receipt, input, context) &&
        receiptsEqual(output, receipt)
      );
    },
  });
}

/**
 * Expose cross-session receipt lookup separately from the consequential action.
 * A fresh browser can reconcile an operation without attempting the effect again.
 */
export async function exposeCancellationReceipt(
  dependencies: CancelOrderDependencies,
) {
  const signett = createInterface(dependencies);

  return await signett.expose<{ operationId: string }, ReceiptStatus>({
    name: "get_cancellation_receipt",
    description:
      "Retrieve the authoritative server receipt for an earlier order-cancellation operation without repeating the cancellation.",
    inputSchema: {
      type: "object",
      properties: {
        operationId: {
          type: "string",
          description: "The stable operation identifier used for cancellation.",
          minLength: 1,
          maxLength: 64,
        },
      },
      required: ["operationId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    authorize: ({ context }) => context.scopes.includes("orders:cancel"),
    execute: async ({ operationId }, { context, signal }) => {
      const receipt = await dependencies.getCancellationReceipt(operationId, {
        accountId: context.accountId,
        signal,
      });
      if (!receipt || receipt.accountId !== context.accountId) {
        return { status: "not_found" };
      }
      return { status: "committed", receipt };
    },
  });
}

function createInterface(dependencies: CancelOrderDependencies) {
  return createSignett<Session>({
    ...(dependencies.modelContext
      ? { modelContext: dependencies.modelContext }
      : {}),
    context: ({ signal }) => dependencies.getSession({ signal }),
    ...(dependencies.observe ? { observe: dependencies.observe } : {}),
  });
}

function intentFor(input: CancelOrderInput): CancellationIntent {
  return Object.freeze({
    ...input,
    summary: `Cancel order ${input.orderId} as ${input.reason} at version ${input.expectedVersion}.`,
  });
}

function matchesRequestedReceipt(
  receipt: CancellationReceipt | null,
  input: CancelOrderInput,
  context: Session,
): receipt is CancellationReceipt {
  return (
    receipt?.accountId === context.accountId &&
    receipt.operationId === input.operationId &&
    receipt.orderId === input.orderId &&
    receipt.reason === input.reason &&
    receipt.approvedVersion === input.expectedVersion &&
    receipt.status === "cancelled"
  );
}

function receiptsEqual(
  left: CancellationReceipt,
  right: CancellationReceipt,
): boolean {
  return (
    left.operationId === right.operationId &&
    left.accountId === right.accountId &&
    left.orderId === right.orderId &&
    left.reason === right.reason &&
    left.approvedVersion === right.approvedVersion &&
    left.resultingVersion === right.resultingVersion &&
    left.status === right.status &&
    left.committedAt === right.committedAt
  );
}

function operationConflict(): ToolError {
  return new ToolError({
    code: "operation_id_reused",
    message: "The operation ID is already bound to a different intent.",
    retry: "after_repair",
    repair: {
      action: "change_input",
      instruction:
        "Choose a new operationId for this intent and request approval again.",
    },
  });
}

function rejectionError(rejection: CancellationRejection): ToolError {
  if (rejection.code === "operation_id_reused") return operationConflict();
  return new ToolError({
    code: rejection.code,
    message: rejection.message,
    retry: "after_repair",
    repair: {
      steps: [
        {
          action: "refresh_state",
          instruction: "Inspect the current authoritative order version.",
        },
        {
          action: "change_input",
          instruction:
            "Use the current version and a new operationId, then request approval again.",
        },
      ],
      update: ["expectedVersion", "operationId"],
    },
  });
}
