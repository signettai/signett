---
title: Resources
description: Source, examples, project guidance, and coding-agent resources for Signett WebMCP.
---

# Resources

Signett is developed in public. These are the primary artifacts for using, inspecting,
and contributing to the project.

## Use Signett

- [Build a useful shopping list](/tutorials/shopping-list)
- [Install Signett Agent for Chrome](https://chromewebstore.google.com/detail/signett-agent/eehffaaooiogcnfdombifkbflnmnhfbb)
- [Documentation](/guide/getting-started)
- [API reference](/reference/interface)
- [Examples on GitHub](https://github.com/signettai/signett/tree/main/fixtures)
- [Production checklist](/production-checklist)

## Use Signett with coding agents

The repository includes a coding-agent skill that describes the supported integration
contract and production boundaries without requiring an agent to inspect library internals.

- [Signett WebMCP skill](https://github.com/signettai/signett/tree/main/packages/webmcp/skills/signett-webmcp)
- [Agent integration contract](https://github.com/signettai/signett/blob/main/AGENTS.md)

## Inspect the project

- [Source](https://github.com/signettai/signett)
- [Issues](https://github.com/signettai/signett/issues)
- [Security policy](https://github.com/signettai/signett/blob/main/SECURITY.md)
- [MIT license](https://github.com/signettai/signett/blob/main/LICENSE)

## Reproduce the evidence

The monorepo keeps benchmark methodology, runnable harnesses, and reviewed evidence
beside the SDK so every claim can be traced to the tested implementation.

- [Signett benchmarks](https://github.com/signettai/signett/tree/main/benchmarks)

An interactive trace player replays recorded benchmark evidence, including lost-response
and concurrent-overwrite faults. From a repository checkout:

```sh
npm run bench:p0
npm run demo
```

Open `http://127.0.0.1:4173/demo/`. This is a replay of measured evidence, not a live
model run. For a working app you can change, start with the [shopping list](./tutorials/shopping-list).
