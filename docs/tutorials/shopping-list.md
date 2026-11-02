# Build an agent-ready shopping list

Build a small website you can actually use. Add groceries by hand, then let a tool
add several at once. Both paths update the same list, and the groceries remain after
you refresh. Start with a sample tool call; connect a real agent when you are ready.

**Time:** about five minutes after installing Node.js. **You need:** Node.js 20.19+
or 22.12+, npm, and a browser. The first result needs no account, API key, or backend.

## Install and run

```sh
npx --yes degit@3.10.1 signettai/signett/fixtures/shopping-list my-list
cd my-list
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The starter is plain JavaScript and Vite. It installs
the published `signett@0.1.2` from npm, including the SDK and terminal CLI. You do not
need to clone the whole Signett repository or install `@signett/eval`.

Already have a repository checkout? Run `npm install` and `npm run dev` from
`fixtures/shopping-list`, which is an independent project.

## See the result

1. Click **Run sample tool call**. Milk, Eggs, and Bread appear in your list.
2. Open **See the last tool call** to inspect the actual input, output, and stages.
3. Refresh. Your groceries are still there.
4. Run the sample again. The existing groceries are not duplicated.
5. Add something yourself and check it off. The human UI uses the same app logic.

The sample invokes the real `add_groceries` tool through Signett's deterministic test
harness. It validates the schema, executes the application function, then verifies
that the requested groceries exist in local storage. It is **not a model run** and
does not require native WebMCP. Native registration happens separately, using the
same tool definitions when the browser supports it.

## The small integration that makes it work

The starter keeps application state in `shopping-list.js`. The useful operation is
an ordinary function: `list.add(items)`. This is its Signett wrapper, simplified to
the four required fields:

```js
import { createSignett } from "signett";

const signett = createSignett();
const registration = await signett.expose({
  name: "add_groceries",
  description:
    "Add groceries to the shopping list; existing names are left unchanged.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 60 },
        minItems: 1,
        maxItems: 20,
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  execute: ({ items }) => list.add(items),
});
```

Here `list` is the starter's app-owned storage object, not a Signett service. The
complete tool also supplies `verify`, which reads the saved list and checks that
every requested item exists. Its companion tools are:

| Tool                  | What it does                                                    |
| --------------------- | --------------------------------------------------------------- |
| `get_shopping_list`   | Returns item IDs, names, and bought status.                     |
| `add_groceries`       | Adds up to 20 names per call, keeping existing items unchanged. |
| `set_grocery_checked` | Sets an existing item's bought status using its ID.             |

Signett supplies registration, runtime validation, execution events, and the
verification hook. Your application still implements storage, duplicate handling,
and UI updates. It does not become an agent planner.

## Connect a real agent

If your existing browser agent already supports native WebMCP, open this page in its
browser and use the prompt below. To use Signett's standalone Chrome extension:

1. Install [Signett Agent from the Chrome Web Store](https://chromewebstore.google.com/detail/signett-agent/eehffaaooiogcnfdombifkbflnmnhfbb).
2. Use a Chrome build with native WebMCP. For local development, enable
   `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, and reopen the starter.
   Experimental availability and flags can change; see
   [Chrome's WebMCP preview](https://developer.chrome.com/blog/webmcp-epp).
3. Check the page reports **All 3 tools are registered**. If it does not, use
   [troubleshooting](../guide/troubleshooting#the-tool-status-is-unsupported).
4. Open the extension, allow website access, then choose your provider and model in
   **Settings** and enter its API key. These are real model calls using your provider.
5. Start a new conversation and ask:

   > Add coffee and bananas to my shopping list. Mark the milk bought, then tell me what I still need.

The agent should read the list, add groceries, and set milk's bought status. Watch
the same page update. The model chooses the calls; the exact sequence can vary.

The extension is installed separately from npm. Installing it alone does not enable
native WebMCP. The starter's no-key sample remains available even when your browser
does not yet expose the native API.

## Make it yours

Open `shopping-list.js` to change the tools and `main.js` to change the sample input.
Rename the app or adapt the
list to packing for a trip. Add your own application function first, then expose it
with a name, description, input schema, and `execute` callback.

Run the included checks:

```sh
npm test
npm run build
```

The tests prove invalid input cannot change the list, repeated names do not add
duplicates, bought status is preserved, saved state survives a new app instance,
and disposal unregisters tools. They invoke the actual published package.

This starter is a single-device example using local storage, not cross-tab
transactional storage. For payments, bookings, or shared data, keep authoritative
state, authorization, idempotency, and receipts on your backend. Continue with
[production WebMCP](../guide/production-webmcp) when your workflow needs those controls.
