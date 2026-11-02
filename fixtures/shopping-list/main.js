import { createSignett } from "signett";
import { createWebMcpTestHarness } from "signett/testing";
import { createShoppingList, shoppingTools } from "./shopping-list.js";
import "./style.css";

const $ = (selector) => document.querySelector(selector);
const error = (cause) => {
  $("#error").textContent =
    cause instanceof Error ? cause.message : String(cause);
};

try {
  const list = createShoppingList(localStorage, render);
  const tools = shoppingTools(list);
  // Native registration publishes tools for a real browser agent.
  const native = createSignett();
  const registrations = await Promise.all(
    tools.map((tool) => native.expose(tool)),
  );
  const registered = registrations.filter(
    (entry) => entry.status === "registered",
  ).length;
  $("#native-status").textContent =
    registered === tools.length
      ? "All 3 tools are registered with native WebMCP. Open Signett Agent on this page."
      : "Your browser is not exposing native WebMCP yet. The list and sample call work now; agent setup is the next step.";

  // A separate test boundary invokes real app code; it never installs a browser polyfill.
  const harness = createWebMcpTestHarness();
  const stages = [];
  const sample = createSignett({
    modelContext: harness.modelContext,
    observe: (event) => {
      stages.push(event.stage);
    },
  });
  const sampleRegistrations = await Promise.all(
    tools.map((tool) => sample.expose(tool)),
  );

  function render() {
    const { items } = list.snapshot();
    $("#items").replaceChildren();
    $("#empty").hidden = items.length > 0;
    $("#count").textContent =
      `${items.filter((item) => !item.checked).length} to buy`;
    for (const item of items) {
      const row = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.checked;
      checkbox.addEventListener("change", () => {
        try {
          list.setChecked(item.id, checkbox.checked);
        } catch (cause) {
          checkbox.checked = item.checked;
          error(cause);
        }
      });
      const name = document.createElement("span");
      name.textContent = item.name;
      label.append(checkbox, name);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${item.name}`);
      remove.addEventListener("click", () => {
        try {
          list.remove(item.id);
        } catch (cause) {
          error(cause);
        }
      });
      row.append(label, remove);
      $("#items").append(row);
    }
  }

  $("#add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    $("#error").textContent = "";
    try {
      list.add([$("#item-name").value]);
      $("#item-name").value = "";
    } catch (cause) {
      error(cause);
    }
  });
  $("#sample").addEventListener("click", async () => {
    $("#sample").disabled = true;
    $("#error").textContent = "";
    $("#call-status").textContent = "Running…";
    stages.length = 0;
    const input = { items: ["Milk", "Eggs", "Bread"] };
    try {
      const output = await harness.invoke("add_groceries", input);
      $("#call-status").textContent =
        "Input validated · List updated · Saved result verified";
      $("#trace").textContent = JSON.stringify(
        { tool: "add_groceries", input, output, stages },
        null,
        2,
      );
    } catch (cause) {
      $("#call-status").textContent = "The call failed. See the error below.";
      error(cause);
    } finally {
      $("#sample").disabled = false;
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.storageArea === localStorage) render();
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      [...registrations, ...sampleRegistrations].forEach((registration) =>
        registration.dispose(),
      );
    });
  render();
} catch (cause) {
  error(cause);
}
