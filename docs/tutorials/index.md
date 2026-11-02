# Tutorials

Start with the [shopping-list starter](./shopping-list): a useful app you can install
and change in minutes, with a sample tool call that requires no API key.

The tutorials then move from one browser-local function to a production-shaped operation.
Each one ends with observable evidence: a registered native tool, an execution trace,
and—when the tool changes data—an authoritative application result.

Starting from your own application? Use the
[User Jobs to Be Done workflow](../guide/user-jobs-workflow) to choose one outcome,
time-box its capability sketch, define the Case and oracle, and only then implement the
minimum tool surface. The codelabs below provide runnable examples for each proof lane.

| Codelab                                                   | What you build or run                           | What it teaches                                                                                                  | Time          |
| --------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| [1. First agent call](./first-agent-call)                 | A React page with `get_greeting`                | Registration, Chrome discovery, manual invocation, and your first `signett agent` run                            | 15 minutes    |
| [2. Headless agent testing](./headless-agent-testing)     | A terminal-driven WebMCP regression suite       | Ad-hoc prompts, saved tasks, fresh browser Trials, authoritative grading, redaction, and automation              | 25 minutes    |
| [3. Authenticated payment](../guide/real-browser-example) | The repository's React and Express payment app  | The complete loop: controls, browser and agent Trials, database grading, baselines, iteration, and change checks | 45–60 minutes |
| [4. Cal.diy booking](./cal-diy)                           | A real booking through a local Cal.diy checkout | Discovery-before-mutation, human confirmation, ambiguous-outcome recovery, and a Postgres oracle                 | 45–90 minutes |

Use the shopping list for the fastest first result. Continue with the first-agent-call
codelab for a detailed React and native-browser walkthrough. It establishes the three
systems involved in every example:

```text
website + Signett -> native WebMCP tool -> agent runtime -> model
```

Signett defines and guards the website capability. The browser exposes that capability.
An agent runtime connects a model to the browser. A model does not call a webpage by
itself.

After the codelabs, use [patterns from Cal.diy and Saleor](../guide/integration-patterns)
as the integration checklist for your own application.
