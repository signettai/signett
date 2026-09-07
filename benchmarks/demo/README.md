# Signett customer demo

An interactive trace player for the P0 benchmark. It visualizes the real recorded
payment-app metrics and the model-free safety trials without presenting deterministic
Cypress timings as an LLM-agent result.

```sh
npm run bench:p0   # refresh evidence
npm run demo       # open http://127.0.0.1:4173/demo/
```

Presentation flow:

1. Run the speed comparison.
2. State: “WebMCP removes the UI work.”
3. Open the Trust tab and inject the lost-response fault.
4. State: “Signett provides the reusable boundary for consequential execution.”
5. Show the concurrent overwrite to demonstrate honest detection rather than claiming
   the library prevents failures it does not prevent.

The demo reads `evidence/p0/latest.json` at runtime. It contains no hardcoded KPI scores.

## 90-second design-partner proof

Use one consequential action and keep the claim scoped to the evidence:

1. **0:00–0:15 — Name the production problem.** “The backend may commit after an
   agent loses the response. Retrying blindly can duplicate a consequential action.”
2. **0:15–0:35 — Show the exact intent.** Display the operation ID, material fields,
   resource version, and the approval derived from them. Change the resource version
   and show that execution requires new approval.
3. **0:35–1:05 — Lose the response.** Run the Trust tab's lost-response scenario. The
   authoritative state, not the browser response, determines the result.
4. **1:05–1:20 — Reconcile.** From a fresh client, query the server-owned receipt by
   operation ID without attempting the effect again.
5. **1:20–1:30 — State the boundary.** “Signett orders the browser execution and makes
   failure semantics testable. The application still owns authorization, server
   idempotency, the receipt, and business correctness.”

The interactive demo supplies the recorded lost-response evidence. The
compile-checked `packages/webmcp/recipes/production-mutation.ts` reference and its test
supply exact-intent approval, changed-version rejection, fresh-client receipt lookup,
and one-effect assertions. Do not use the Saleor browser-profile experiment as evidence
of multi-device uniqueness.
