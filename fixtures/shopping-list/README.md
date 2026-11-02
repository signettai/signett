# An agent-ready shopping list

A useful first Signett app: add groceries, read the list, and mark items bought.
The UI and agent tools use the same application functions. Data stays in this
browser's local storage; there is no account, backend, or model in the sample call.

Requires Node.js 20.19+ or 22.12+ and npm. From an empty folder:

```sh
npx --yes degit@3.10.1 signettai/signett/fixtures/shopping-list my-list
cd my-list
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and click **Run sample tool call**. The real list gains
Milk, Eggs, and Bread. Refresh to check persistence. Click again to check that the
app's set-like addition does not duplicate groceries.

The sample uses `signett/testing` to invoke the real tools deterministically. It
does not emulate a model, enable WebMCP, or publish a browser polyfill. A separate
Signett interface registers the same definitions natively when WebMCP is available.

To use natural language, install [Signett Agent for Chrome](https://chromewebstore.google.com/detail/signett-agent/eehffaaooiogcnfdombifkbflnmnhfbb),
enable native WebMCP for local development, and configure a model provider in the
extension. Follow the [complete tutorial](https://www.signett.ai/tutorials/shopping-list#connect-a-real-agent).
Then ask: **Add coffee and bananas. Mark the milk bought.** Real model calls use your
provider's API key and may incur its charges.

## Change it

- `shopping-list.js`: app-owned storage functions and three tool definitions.
- `main.js`: human UI, native registration, and the labeled sample test call.
- `style.css`: appearance.
- `shopping-list.test.js`: invalid input, persistence, verification, repeat calls, and teardown.

```sh
npm test
npm run build
npx signett agent --help
```

This is deliberately a single-device list. Storage is not encrypted or shared across
devices, and simultaneous writes in multiple tabs are not transactional. It is not
a payment or booking architecture. Use a backend with application-owned permissions,
idempotency, and receipts for consequential effects.

The pinned `signett@0.1.2` comes from npm. This folder is not a monorepo workspace
and does not depend on unpublished SDK changes.
