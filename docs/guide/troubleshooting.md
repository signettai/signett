# Troubleshooting

Start with the symptom you can observe. The [shopping-list starter](../tutorials/shopping-list)
also offers a deterministic sample call when you want to check the SDK without an
agent or native browser support.

## The tool status is `unsupported`

Signett did not find a native boundary to register against. The human website keeps
working; it does not mean your application function failed.

- **The browser has no native WebMCP.** Use a supported Chrome build and enable the
  experimental API for local development. The current local flag is
  `chrome://flags/#enable-webmcp-testing`; relaunch Chrome after changing it. Manual
  DevTools inspection can also require `chrome://flags/#devtools-webmcp-support`.
  Check [Chrome's current preview guidance](https://developer.chrome.com/blog/webmcp-epp)
  when flags or browser support differ. Installing an extension does not itself enable the API.
- **The code ran on the server.** There is no browser `document` during a server
  render. Register in mounted client code; see
  [server-side rendering](./getting-started#server-side-rendering).
- **A bridge appeared later.** Signett does not poll for injected boundaries. Wait
  for your bridge and pass it to `createSignett({ modelContext })`. Test harnesses
  are explicit test boundaries, not production browser polyfills.

Use `createSignett({ unsupported: "warn" })` to surface the missing boundary in the
console, and inspect the registration's `status` before investigating agent behavior.

## The agent cannot see a registered tool

Confirm the tool is `registered` in the page or [Inspector](./developer-tooling).
Then check that the agent is using the same page and browser session.

For [Signett Agent](https://chromewebstore.google.com/detail/signett-agent/eehffaaooiogcnfdombifkbflnmnhfbb),
allow website access and refresh its tool inventory after a tool registers. Configure
the provider in Settings before sending a prompt. A page with a deterministic sample
does not provide a model to the extension.

Headless runners and MCP browser servers can open separate browser profiles. Their
flags and login state may differ from a Chrome window you configured manually.
Restart an MCP client after changing its server configuration.

If tools disappear on navigation or logout, check their owner: disposing a
registration removes it from the native inventory.

## `@signett/eval` cannot be installed, or the CLI is missing

The public `signett` package includes the CLI starting at 0.1.2:

```sh
npm install signett@latest
npx signett --help
```

Use `signett/eval` for evaluation imports and `signett/agent` for agent-suite imports.
There is no need to install the unpublished scoped `@signett/eval` package. Old docs
that say the SDK does not install a CLI describe the earlier packaging.

From a source checkout, run `npm ci` and `npm run build` before testing the CLI.
The [CLI reference](../reference/cli) describes supported commands; `signett check`
compares evaluation reports, rather than accepting a website URL.

## A tool registers twice in React or during hot reload

Dispose the registration when its component or module is replaced. React code can
use `useSignettTool` from `signett/react`; include every reactive value used by the
callbacks in the dependency list. A vanilla Vite module can dispose its registrations
in `import.meta.hot.dispose`. Dispose registrations individually; the interface does
not have a `dispose()` method.

## Input is rejected before the application runs

`ValidationError` means the input does not match `inputSchema`: for example, a string
was supplied instead of an array, a required field is missing, or extra fields were
sent to a closed schema. Read the reported path and fix the input or description.
Use `ToolError` for expected application failures, such as an item that no longer exists.

An authorization denial means the app's policy rejected the call. A verification
failure means the postcondition could not be proven. An `outcome_unknown` result
requires authoritative reconciliation; do not repeat a consequential operation with
a new operation ID. See the [error reference](../reference/errors).

## Idempotency requires an operation journal

Configure `journal: { store }` alongside idempotency so execution can distinguish
known pre-effect failures from ambiguous outcomes. Memory adapters from
`signett/testing` are test utilities. See [durable storage](./idempotency-concurrency)
and the [production checklist](../production-checklist) for real effects.

## A tool registers but the agent chooses badly

Registration proves the boundary works, not that a model will select the right tool.
Use `checkToolReadiness(tool)` to catch missing descriptions, unbounded inputs, and
unclear schemas. Then use a [saved agent task](../tutorials/headless-agent-testing)
to measure actual selection and completion against application state.
