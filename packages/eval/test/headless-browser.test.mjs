import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { HeadlessWebMcpPage } from "../headless-browser.mjs";

function createPage(executeTool) {
  const context = vm.createContext({
    document: {
      modelContext: {
        getTools: async () => [{ name: "add_groceries" }],
        executeTool,
      },
    },
    window: {},
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
  });
  return new HeadlessWebMcpPage({
    cdp: { evaluate: (expression) => vm.runInContext(expression, context) },
  });
}

const call = {
  id: "add-one",
  name: "add_groceries",
  arguments: { items: ["Milk"] },
};

test("passes structured arguments to current Chrome without double encoding", async () => {
  let calls = 0;
  const page = createPage(async (tool, input, { signal }) => {
    calls += 1;
    assert.equal(tool.name, call.name);
    assert.equal(typeof input, "object");
    assert.equal(JSON.stringify(input), JSON.stringify(call.arguments));
    assert.equal(signal.aborted, false);
    return { count: input.items.length };
  });

  const result = await page.invoke(call);
  assert.equal(result.count, 1);
  assert.equal(calls, 1);
});

test("supports older Chrome previews that require serialized arguments", async () => {
  let calls = 0;
  const page = createPage(async (_tool, input) => {
    calls += 1;
    if (typeof input !== "string") throw new Error("Failed to parse input");
    return JSON.parse(input);
  });

  assert.equal(
    JSON.stringify(await page.invoke(call)),
    JSON.stringify(call.arguments),
  );
  assert.equal(calls, 2);
});

test("preserves JSON properties when transferring arguments into the page", async () => {
  const input = JSON.parse(
    '{"__proto__":{"label":"grocery"},"items":["Milk"]}',
  );
  const page = createPage(async (_tool, received) => {
    assert.equal(Object.hasOwn(received, "__proto__"), true);
    return received;
  });

  const result = await page.invoke({ ...call, arguments: input });
  assert.equal(JSON.stringify(result), JSON.stringify(input));
});

test("does not retry an application failure after a tool may have changed state", async () => {
  let effects = 0;
  const page = createPage(async () => {
    effects += 1;
    throw new TypeError("Response unavailable after saving");
  });

  await assert.rejects(page.invoke(call), {
    name: "TypeError",
    message: "Response unavailable after saving",
  });
  assert.equal(effects, 1);
});
