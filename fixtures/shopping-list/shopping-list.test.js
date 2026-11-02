import assert from "node:assert/strict";
import test from "node:test";
import { createSignett } from "signett";
import { createWebMcpTestHarness } from "signett/testing";
import { createShoppingList, shoppingTools } from "./shopping-list.js";

async function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const list = createShoppingList(storage);
  const harness = createWebMcpTestHarness();
  const events = [];
  const signett = createSignett({
    modelContext: harness.modelContext,
    observe: (event) => events.push(event),
  });
  const registrations = await Promise.all(
    shoppingTools(list).map((tool) => signett.expose(tool)),
  );
  return { list, harness, storage, events, registrations };
}

test("a tool call saves real state, verifies it, and survives a new app instance", async () => {
  const { list, harness, storage, events } = await setup();
  await harness.invoke("add_groceries", { items: ["Milk", "Eggs", "Bread"] });
  assert.equal(list.snapshot().items.length, 3);
  assert.deepEqual(createShoppingList(storage).snapshot(), list.snapshot());
  assert.ok(events.some((event) => event.stage === "verified"));
  await harness.invoke("set_grocery_checked", { id: "milk", checked: true });
  const result = await harness.invoke("get_shopping_list", {});
  assert.equal(result.items.find((item) => item.id === "milk").checked, true);
});

test("invalid input is rejected before it changes the list", async () => {
  const { list, harness } = await setup();
  await assert.rejects(harness.invoke("add_groceries", { items: "Milk" }));
  await assert.rejects(harness.invoke("add_groceries", { items: [] }));
  await assert.rejects(
    harness.invoke("add_groceries", { items: ["Eggs", " "] }),
  );
  assert.deepEqual(list.snapshot().items, []);
});

test("repeating an addition preserves existing items and their checked state", async () => {
  const { list, harness } = await setup();
  await harness.invoke("add_groceries", { items: ["Milk", "milk", " Eggs "] });
  await harness.invoke("set_grocery_checked", { id: "milk", checked: true });
  await harness.invoke("add_groceries", { items: ["MILK", "Eggs"] });
  assert.equal(list.snapshot().items.length, 2);
  assert.equal(list.snapshot().items[0].checked, true);
});

test("an unknown item has no effect and disposal removes every tool", async () => {
  const { list, harness, registrations } = await setup();
  await assert.rejects(
    harness.invoke("set_grocery_checked", { id: "missing", checked: true }),
  );
  assert.deepEqual(list.snapshot().items, []);
  registrations.forEach((registration) => registration.dispose());
  assert.equal(harness.tools().length, 0);
});
