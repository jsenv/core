import { signal, effect, computed } from "@preact/signals";

const generateClientId = () => {
  return window.crypto.randomUUID();
};

const clientIdSymbol = Symbol.for("client_id");

export const arraySignalStore = (
  initialItems = [],
  uniquePropertyName = "id",
) => {
  const initialArray = [];
  for (const props of initialItems) {
    initialArray.push({
      [clientIdSymbol]: generateClientId(),
      ...props,
    });
  }
  const arraySignal = signal(initialArray);

  const currentItemIdSignal = signal(null);
  const setCurrentItem = (props) => {
    const item = upsert(props);
    currentItemIdSignal.value = item[clientIdSymbol];
  };
  const currentItemSignal = computed(() => {
    const currentItemId = currentItemIdSignal.value;
    const array = arraySignal.value;
    if (!currentItemId) {
      return null;
    }
    for (const item of array) {
      if (item[clientIdSymbol] === currentItemId) {
        return item;
      }
    }
    return null;
  });

  const onItemPropertyChange = (itemSignal, propertyName, callback) => {
    const NOT_FOUND = {};
    const propertyValueSignal = computed(() => {
      // eslint-disable-next-line no-unused-expressions
      arraySignal.value; // register array signal as dependency
      const item = itemSignal.value;
      return item ? item[propertyName] : NOT_FOUND;
    });
    const propertyValuePreviousSignal = signal(propertyValueSignal.value);
    return effect(() => {
      const propertyValuePrevious = propertyValuePreviousSignal.value;
      const propertyValue = propertyValueSignal.value;
      propertyValuePreviousSignal.value = propertyValue;
      if (
        propertyValue !== propertyValuePrevious &&
        propertyValue !== NOT_FOUND &&
        propertyValuePrevious !== NOT_FOUND
      ) {
        callback(propertyValuePrevious, propertyValue);
      }
    });
  };
  const onItemRemoved = (itemSignal, callback) => {
    const itemPreviousSignal = signal(itemSignal.value);
    return effect(() => {
      const item = itemSignal.value;
      const itemPrevious = itemPreviousSignal.value;
      itemPreviousSignal.value = itemPrevious;
      if (itemPrevious && !item) {
        callback(itemPrevious);
      }
    });
  };

  const getByUniquePropertyName = (id) => {
    const array = arraySignal.peek();
    for (const item of array) {
      if (item[uniquePropertyName] === id) {
        return item;
      }
    }
    return null;
  };
  const upsert = (...args) => {
    if (args.length === 1 && Array.isArray(args[0])) {
      const propsArray = args[0];
      const array = arraySignal.peek();
      if (array.length === 0) {
        const arrayUpdated = [];
        for (const props of propsArray) {
          arrayUpdated.push({
            [clientIdSymbol]: generateClientId(),
            ...props,
          });
        }
        arraySignal.value = arrayUpdated;
        return arrayUpdated;
      }
      const arrayUpdated = [];
      const existingItemMap = new Map();
      for (const existingItem of array) {
        arrayUpdated.push(existingItem);
        existingItemMap.set(existingItem[uniquePropertyName], existingItem);
      }
      for (const props of propsArray) {
        const id = props[uniquePropertyName];
        const existingItem = existingItemMap.get(id);
        if (existingItem) {
          Object.assign(existingItem, props);
        } else {
          const item = {
            [clientIdSymbol]: generateClientId(),
            ...props,
          };
          arrayUpdated.push(item);
        }
      }
      arraySignal.value = arrayUpdated;
      return arrayUpdated;
    }
    const array = arraySignal.peek();
    let found = false;
    const arrayUpdated = [];
    let item;
    let id;
    let props;
    if (args.length === 1) {
      props = args[0];
      id = props[uniquePropertyName];
    } else if (args.length === 2) {
      id = args[0];
      props = args[1];
    }
    for (const existingItem of array) {
      if (existingItem[uniquePropertyName] === id) {
        found = true;
        Object.assign(existingItem, props);
        arrayUpdated.push(existingItem);
        item = existingItem;
      } else {
        arrayUpdated.push(existingItem);
      }
    }
    if (!found) {
      item = {
        [clientIdSymbol]: generateClientId(),
        ...props,
      };
      arrayUpdated.push(item);
    }
    arraySignal.value = arrayUpdated;
    return item;
  };
  const drop = (data) => {
    if (Array.isArray(data)) {
      const array = arraySignal.peek();
      const arrayWithoutDroppedItems = [];
      let someDrop = false;
      const idToRemoveSet = new Set(data);
      for (const existingItem of array) {
        const existingItemId = existingItem[uniquePropertyName];
        if (idToRemoveSet.has(existingItemId)) {
          someDrop = true;
          idToRemoveSet.delete(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (someDrop) {
        arraySignal.value = arrayWithoutDroppedItems;
      }
      return arrayWithoutDroppedItems;
    }
    const idToRemove = data;
    const array = arraySignal.peek();
    const arrayWithoutItemToDrop = [];
    let found = false;
    for (const existingItem of array) {
      if (existingItem[uniquePropertyName] === idToRemove) {
        found = true;
      } else {
        arrayWithoutItemToDrop.push(existingItem);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
    }
    return array;
  };

  return {
    arraySignal,
    getByUniquePropertyName,
    upsert,
    drop,
    currentItemSignal,
    setCurrentItem,
    onItemPropertyChange,
    onItemRemoved,
  };
};

// const arrayStore = arraySignalStore(
//   [
//     {
//       name: "a",
//     },
//     {
//       name: "b",
//     },
//   ],
//   "name",
// );

// arrayStore.setCurrentItem({ name: "a" });

// detect_renaming: {
//   arrayStore.onItemPropertyChange(
//     arrayStore.currentItemSignal,
//     "name",
//     (from, to) => {
//       console.log(`renamed from ${from} to ${to}`);
//     },
//   );
//   arrayStore.upsert("a", { name: "a_renamed" });
// }

// detect_deletion: {
//   arrayStore.onItemRemoved(arrayStore.currentItemSignal, (item) => {
//     console.log(`deleted ${item.name}`);
//   });
//   arrayStore.drop("a_renamed");
// }
