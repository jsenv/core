import { resource } from "@jsenv/navi";

let nextId = 1;
const itemStore = new Map();

// Pre-populate with a few items
for (let i = 0; i < 3; i++) {
  const id = String(nextId++);
  itemStore.set(id, { id });
}

export const ITEM = resource("item", {
  idKey: "id",

  GET_MANY: () => {
    return Array.from(itemStore.values());
  },

  POST: ({ id }) => {
    const item = { id };
    itemStore.set(id, item);
    return item;
  },

  DELETE: ({ id }) => {
    const item = itemStore.get(id);
    if (!item) {
      throw new Error(`Item ${id} not found`);
    }
    itemStore.delete(id);
    return item;
  },
});

export const addItem = () => {
  const id = String(nextId++);
  ITEM.POST({ id });
};

export const deleteItem = (id) => {
  ITEM.DELETE({ id });
};
