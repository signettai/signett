# Design partner program

Signett is looking for a small number of teams preparing to let agents perform a
real, consequential action in an existing web application. The purpose of a design
partnership is to remove a concrete production blocker and learn which execution
controls repeat across applications. It is not a generic SDK trial.

## The initial hypothesis

The first customer is a web platform or product team with:

- an authenticated website and an existing backend mutation;
- a planned agent-accessible action such as placing or cancelling an order, making a
  reservation, issuing a refund, or changing an account;
- a launch target inside the next 90 days;
- an authoritative backend read that can prove the final state; and
- an engineering or security owner accountable for duplicate, stale, or disputed
  actions.

Read-only discovery tools, hypothetical agent roadmaps, and teams looking for an agent
planner are not the initial program. Signett is most useful where a lost response,
stale approval, or duplicate execution would delay a launch or create an incident.

## The flagship acceptance test

Every pilot begins with one bounded action and one shared test:

```text
prepare exact intent
  → approve the material terms
  → commit the backend effect
  → lose the response deliberately
  → open a fresh client
  → retrieve the authoritative receipt
  → prove that one intended effect exists
```

The intent includes every material field, relevant resource versions, the authenticated
principal, an expiry, and a stable operation ID. The backend binds that operation ID to
the intent and rejects changed intent. Approval becomes invalid when a material
precondition changes.

The compile-checked
[`production-mutation.ts`](https://github.com/signettai/signett/blob/main/packages/webmcp/recipes/production-mutation.ts)
recipe demonstrates the pattern with order cancellation. Its tests cover exact-intent
approval, stale state, a lost response, a fresh client, and durable receipt lookup.

## What the pilot includes

Signett contributes:

- design of one read tool and one consequential action;
- an intent, approval, operation, receipt, recovery, and verification contract;
- deterministic fault tests plus a native-browser exercise;
- integration review and a weekly working session; and
- a final evidence report and production recommendation.

The partner contributes:

- an engineer who owns the existing workflow and backend;
- access to a staging environment and its authoritative state;
- the application-owned authentication, authorization, approval UI, and business
  operation;
- a security or platform reviewer; and
- agreement on what may be published, anonymized, or kept private.

The pilot does not replace the partner's database, payment provider, authorization,
business rules, or incident process.

## Suggested four-week sequence

| Week | Work                                                  | Exit criterion                                                   |
| ---: | ----------------------------------------------------- | ---------------------------------------------------------------- |
|    0 | Qualify the workflow and owner                        | A real launch blocker, target date, and bounded action are named |
|    1 | Define intent, authority, receipt, and failure states | Both teams sign off on the acceptance tests                      |
|    2 | Integrate in staging                                  | The guarded action reaches the real backend and UI               |
|    3 | Run faults and native-agent tasks                     | Database oracles pass; unknown outcomes are visible              |
|    4 | Review security and launch evidence                   | Ship, extend, or stop based on agreed evidence                   |

## Pilot scorecard

Record a baseline before integration and review these measures weekly:

| Measure                                       | Evidence                                                    |
| --------------------------------------------- | ----------------------------------------------------------- |
| Time to first guarded staging action          | Engineering log, excluding environment setup                |
| Application-specific boundary code            | Reviewed diff, separated from tests and UI                  |
| Exact replay and concurrent duplicate effects | Authoritative database count                                |
| Changed-intent and stale-version attempts     | Rejected before another effect                              |
| Lost-response recovery                        | Durable receipt retrieved from a fresh client               |
| Unknown outcomes                              | Visible, non-retryable, and assigned an operator action     |
| Agent task quality                            | Selection, arguments, completion, and forbidden effects     |
| Launch decision                               | The accountable owner records ship, extend, or stop and why |

Lifecycle telemetry should contain operation and invocation correlation, stage, timing,
and safe error classification. Do not collect prompts, tool inputs, outputs, customer
data, or credentials by default.

## Discovery conversation

Start with the workflow, not the library:

1. Which agent-triggered action is expected to reach production first?
2. What could happen if its backend commits and the response disappears?
3. What exact terms must a person approve, and which of them can change?
4. How are duplicate calls coordinated across tabs, devices, and agent transports?
5. Which authoritative read proves the effect, and how is an indeterminate result
   handled today?
6. Who owns the production incident if the agent reports the wrong outcome?
7. What acceptance evidence does security require, and by what launch date?
8. Which team and budget own the work if the pilot removes the blocker?

A qualified pilot has concrete answers to the action, owner, deadline, authoritative
state, and consequence of failure. Interest in WebMCP alone is not qualification.

## Decision after the pilot

Continue only when the partner reaches a real launch decision, the reusable Signett
boundary is smaller than an application-specific implementation, and at least one
important failure was prevented or made safely recoverable. Repeated requests across
pilots determine the product roadmap. One-off application work remains an integration,
not a new platform feature.

Review [Signett's execution guarantees](./execution-guarantees) before agreeing on
pilot claims or production acceptance criteria.
