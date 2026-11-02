import { ToolError } from "signett";

export const storageKey = "signett-shopping-list-v1";
const itemId = (name) => name.normalize("NFKC").trim().toLowerCase();

// The app owns its state. Signett exposes the same functions the UI calls.
export function createShoppingList(storage, onChange = () => {}) {
  const read = () => JSON.parse(storage.getItem(storageKey) ?? "[]");
  const save = (items) => {
    storage.setItem(storageKey, JSON.stringify(items));
    onChange();
    return { items };
  };
  return {
    snapshot: () => ({ items: read() }),
    add(names) {
      const items = read();
      for (const raw of names) {
        const name = raw.trim();
        if (!name || name.length > 60) {
          throw new ToolError({
            code: "invalid_name",
            message: "Use a grocery name between 1 and 60 characters.",
            retry: "never",
          });
        }
        const id = itemId(name);
        if (!items.some((item) => item.id === id))
          items.push({ id, name, checked: false });
      }
      if (items.length > 100) {
        throw new ToolError({
          code: "list_full",
          message:
            "This starter supports up to 100 groceries. Remove some items first.",
          retry: "never",
        });
      }
      return save(items);
    },
    setChecked(id, checked) {
      const items = read();
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        throw new ToolError({
          code: "item_not_found",
          message: "Read the shopping list and use an existing item ID.",
          retry: "after_repair",
        });
      }
      item.checked = checked;
      return save(items);
    },
    remove(id) {
      return save(read().filter((item) => item.id !== id));
    },
  };
}

export function shoppingTools(list) {
  return [
    {
      name: "get_shopping_list",
      description:
        "Read this browser's shopping list, including item IDs and whether each item is bought.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => list.snapshot(),
    },
    {
      name: "add_groceries",
      description:
        "Add one or more groceries to this browser's shopping list. Existing items, including bought items, are left unchanged. Repeating the same names does not add duplicates.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Grocery names to add, such as Milk or Bananas.",
            minItems: 1,
            maxItems: 20,
            items: { type: "string", minLength: 1, maxLength: 60 },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
      execute: ({ items }) => list.add(items),
      verify: ({ input }) =>
        input.items.every((name) =>
          list.snapshot().items.some((item) => item.id === itemId(name)),
        ),
    },
    {
      name: "set_grocery_checked",
      description:
        "Mark an existing grocery as bought or still needed. Get the item ID from get_shopping_list. Setting the same value again leaves the list unchanged.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Exact item ID returned by get_shopping_list.",
            minLength: 1,
            maxLength: 240,
          },
          checked: {
            type: "boolean",
            description: "True means bought; false means still needed.",
          },
        },
        required: ["id", "checked"],
        additionalProperties: false,
      },
      execute: ({ id, checked }) => list.setChecked(id, checked),
      verify: ({ input }) =>
        list
          .snapshot()
          .items.some(
            (item) => item.id === input.id && item.checked === input.checked,
          ),
    },
  ];
}
