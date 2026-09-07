# Execution guarantees

Use this document to set accurate expectations with application teams, security
reviewers, and design partners. Signett controls the agent-facing browser boundary. The
application and its backend remain the authority for identity, policy, business state,
and durable effects.

## Guarantees provided by Signett

When the documented interfaces are used correctly, Signett guarantees that:

- runtime input validation happens before application execution;
- context and authorization run before confirmation or idempotency lookup;
- one live owner coordinates equal keys through the supplied idempotency store;
- an effect is never automatically retried by Signett;
- completed equal-key operations replay their stored result;
- abandoned work enters application-owned recovery instead of speculative execution;
- execution, replay, and recovered output pass through application-owned verification;
- an unprovable effect becomes `outcome_unknown`, not an ordinary retryable failure;
- late cancellation does not rewrite a completed effect as cancelled; and
- observer or telemetry failure cannot change the operation outcome.

These are library ordering and failure-semantics guarantees. The deterministic test
harness and store conformance suite exercise them.

## Guarantees that require application integration

The following outcomes are possible only when the application supplies the necessary
backend behavior:

| Desired outcome                         | Application requirement                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Approval applies to what executes       | Preview every material intent field and validate the same fields, resource versions, and expiry on the server |
| Duplicate calls across clients converge | Bind a stable operation ID to the exact intent in shared durable storage                                      |
| A lost response is recoverable          | Persist an authoritative receipt before acknowledging success                                                 |
| A fresh session can reconcile           | Expose authenticated receipt/status lookup independent of browser storage                                     |
| Stale decisions do not execute          | Enforce optimistic concurrency or another server precondition                                                 |
| Verification means business success     | Query authoritative state and compare the exact requested postcondition                                       |
| Operations are auditable                | Correlate intent, approval evidence, backend effect, and receipt under an application-owned retention policy  |

Browser IndexedDB and an operation journal can coordinate a profile and survive reloads;
they do not create a multi-device or cross-transport backend guarantee.

## What Signett does not guarantee

Signett does not guarantee:

- exactly-once effects across a database and external systems;
- that the agent, tool input, or caller-supplied identity is trustworthy;
- authentication, authorization, spending policy, inventory, or business eligibility;
- rollback after cancellation or after an irreversible effect starts;
- correct approval UI, accessibility, or comprehension;
- correctness of application-provided idempotency keys, recovery, or verification;
- availability of the application, browser, agent host, or telemetry backend; or
- that a successful browser response is authoritative evidence of a backend effect.

Do not claim “exactly once” unless every participating system supplies compatible
transaction semantics. Prefer a scoped claim such as:

> Under the tested operation contract, equal retries converge on the same durable
> receipt, and the authoritative oracle observed one intended effect.

## Minimum consequential-action contract

Before exposing an externally visible or irreversible action, define:

1. **Intent:** every material argument, authenticated principal, resource version, and
   expiry.
2. **Approval:** a human-readable view derived from that intent.
3. **Operation identity:** a stable ID bound to the exact intent by the server.
4. **Effect boundary:** the point after which non-execution can no longer be assumed.
5. **Receipt:** durable evidence of the committed result.
6. **Recovery:** authenticated lookup that distinguishes committed, not applied, and
   unknown.
7. **Verification:** an authoritative comparison with the exact requested outcome.
8. **Operator path:** ownership and next action for unresolved operations.

If the application cannot answer these questions, expose the discovery/read tools and
improve the backend boundary before exposing the mutation.

See the [production checklist](./production-checklist) and the
[`production-mutation.ts`](https://github.com/signettai/signett/blob/main/packages/webmcp/recipes/production-mutation.ts)
reference contract.
