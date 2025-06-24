import { computed, effect, signal } from "@preact/signals";

export const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    name,
    createItem = (props) => {
      return { ...props };
    },
  },
) => {
  const propertyAccessorMap = new Map();
  const store = {
    name,
    defineGetSet: (propertyName, { get, set }) => {
      propertyAccessorMap.set(propertyName, {
        get,
        set,
      });
    },
  };

  const createItemFromProps = (props) => {
    if (props === null || typeof props !== "object") {
      return props;
    }

    const item = createItem(props);

    for (const [propertyName, { get, set }] of propertyAccessorMap) {
      Object.defineProperty(item, propertyName, {
        get: () => get(item),
        set: (value) => {
          set(item, value);
        },
      });
    }
    return item;
  };

  const arraySignal = signal(initialArray);
  const derivedSignal = computed(() => {
    const array = arraySignal.value;
    const idSet = new Set(); // will be used to detect id changes (deletion, addition)
    const idMap = new Map(); // used to speep up finding item by id
    for (const item of array) {
      const id = item[idKey];
      idSet.add(id);
      idMap.set(id, item);
    }
    return [idSet, idMap];
  });
  const idSetSignal = computed(() => derivedSignal.value[0]);
  const idMapSignal = computed(() => derivedSignal.value[1]);
  const previousIdSetSignal = signal(new Set(idSetSignal.peek()));
  const idChangeCallbackSet = new Set();
  effect(() => {
    const idSet = idSetSignal.value;
    const previousIdSet = previousIdSetSignal.peek();
    const setCopy = new Set();
    let modified = false;
    for (const id of idSet) {
      if (!previousIdSet.has(id)) {
        modified = true;
      }
      setCopy.add(id);
    }
    previousIdSetSignal.value = setCopy;
    if (modified) {
      for (const idChangeCallback of idChangeCallbackSet) {
        idChangeCallback(idSet, previousIdSet);
      }
    }
  });

  const propertyChangeCallbackSetMap = new Map();
  const registerPropertyChangeCallback = (property, callback) => {
    const set = propertyChangeCallbackSetMap.get(property);
    if (set) {
      set.add(callback);
    } else {
      propertyChangeCallbackSetMap.set(property, new Set([callback]));
    }
  };
  const assign = (item, props) => {
    let modified = false;
    const itemWithProps = Object.create(
      Object.getPrototypeOf(item),
      Object.getOwnPropertyDescriptors(item),
    );
    for (const key of Object.keys(props)) {
      const newValue = props[key];
      if (key in item) {
        const value = item[key];
        if (newValue !== value) {
          modified = true;
          itemWithProps[key] = newValue;
          const propertyChangeCallbackSet =
            propertyChangeCallbackSetMap.get(key);
          if (propertyChangeCallbackSet) {
            for (const propertyChangeCallback of propertyChangeCallbackSet) {
              propertyChangeCallback(newValue, value, false, key);
            }
          }
        }
      } else {
        modified = true;
        itemWithProps[key] = newValue;
        const propertyChangeCallbackSet = propertyChangeCallbackSetMap.get(key);
        if (propertyChangeCallbackSet) {
          for (const propertyChangeCallback of propertyChangeCallbackSet) {
            propertyChangeCallback(
              newValue,
              undefined,
              // third arg says "new"
              true,
              key,
            );
          }
        }
      }
    }
    return modified ? itemWithProps : item;
  };

  const itemDropCallbackSet = new Set();
  const registerItemDropCallback = (callback) => {
    itemDropCallbackSet.add(callback);
  };
  const itemRematchCallbackSet = new Set();
  const registerItemRematchingCallback = (match, rematchCallback) => {
    // alors la il s'agit de voir lorsqu'un item match
    itemRematchCallbackSet.add({
      match,
      rematchCallback,
    });
  };

  const select = (...args) => {
    const array = arraySignal.value;
    const idMap = idMapSignal.value;

    let property;
    let value;
    if (args.length === 1) {
      property = idKey;
      value = args[0];
    } else if (args.length === 2) {
      property = args[0];
      value = args[1];
    }
    if (property === idKey) {
      return idMap.get(value);
    }
    for (const itemCandidate of array) {
      const valueCandidate =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (valueCandidate === value) {
        return itemCandidate;
      }
    }
    return null;
  };
  const selectAll = (idArray) => {
    const result = [];
    const idMap = idMapSignal.value;
    for (const id of idArray) {
      const item = idMap.get(id);
      if (item) {
        result.push(item);
      }
    }
    return result;
  };
  const upsert = (...args) => {
    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const propsArray = args[0];
      if (array.length === 0) {
        const arrayAllCreated = [];
        for (const props of propsArray) {
          const item = createItemFromProps(props);
          arrayAllCreated.push(item);
        }
        arraySignal.value = arrayAllCreated;
        return arrayAllCreated;
      }
      let hasNew = false;
      let hasUpdate = false;
      const arraySomeUpdated = [];
      const arrayWithOnlyAffectedItems = [];
      const existingEntryMap = new Map();
      let index = 0;
      while (index < array.length) {
        const existingItem = array[index];
        const id = existingItem[idKey];
        existingEntryMap.set(id, {
          existingItem,
          existingItemIndex: index,
          processed: false,
        });
        index++;
      }

      for (const props of propsArray) {
        const id = props[idKey];
        const existingEntry = existingEntryMap.get(id);
        if (existingEntry) {
          const { existingItem } = existingEntry;
          const itemWithPropsOrItem = assign(existingItem, props);
          if (itemWithPropsOrItem !== existingItem) {
            hasUpdate = true;
          }
          arraySomeUpdated.push(itemWithPropsOrItem);
          existingEntry.processed = true;
          arrayWithOnlyAffectedItems.push(itemWithPropsOrItem);
        } else {
          hasNew = true;
          const item = createItemFromProps(props);
          arraySomeUpdated.push(item);
          arrayWithOnlyAffectedItems.push(item);
        }
      }

      for (const [, existingEntry] of existingEntryMap) {
        if (!existingEntry.processed) {
          arraySomeUpdated.push(existingEntry.existingItem);
        }
      }

      if (hasNew || hasUpdate) {
        arraySignal.value = arraySomeUpdated;
        return arrayWithOnlyAffectedItems;
      }
      return arrayWithOnlyAffectedItems;
    }
    let existingItem = null;
    let updatedItem = null;
    const arraySomeUpdated = [];
    let property;
    let value;
    let props;
    if (args.length === 1) {
      property = idKey;
      value = args[0][idKey];
      props = args[0];
    } else if (args.length === 2) {
      property = idKey;
      value = args[0];
      if (typeof value === "object") {
        value = value[idKey];
      }
      props = args[1];
    } else if (args.length === 3) {
      property = args[0];
      value = args[1];
      props = args[2];
    }
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (itemCandidateValue === value) {
        const itemWithPropsOrItem = assign(itemCandidate, props);
        if (itemWithPropsOrItem === itemCandidate) {
          existingItem = itemCandidate;
        } else {
          updatedItem = itemWithPropsOrItem;
        }
        arraySomeUpdated.push(itemWithPropsOrItem);
      } else {
        arraySomeUpdated.push(itemCandidate);
      }
    }
    if (existingItem) {
      return existingItem;
    }
    if (updatedItem) {
      arraySignal.value = arraySomeUpdated;
      return updatedItem;
    }
    const item = createItemFromProps(props);
    arraySomeUpdated.push(item);
    arraySignal.value = arraySomeUpdated;
    return item;
  };
  const drop = (...args) => {
    if (args.length === 1 && Array.isArray(args[0])) {
      const data = args[0];
      const array = arraySignal.peek();
      const arrayWithoutDroppedItems = [];
      let hasFound = false;
      const idToRemoveSet = new Set(data);
      const triggerDropSet = new Set();
      for (const existingItem of array) {
        const existingItemId = existingItem[idKey];
        if (idToRemoveSet.has(existingItemId)) {
          hasFound = true;
          idToRemoveSet.delete(existingItemId);
          triggerDropSet.add(() => {
            for (const itemDropCallback of itemDropCallbackSet) {
              itemDropCallback(existingItem);
            }
          });
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (hasFound) {
        arraySignal.value = arrayWithoutDroppedItems;
        for (const triggerDrop of triggerDropSet) {
          triggerDrop();
        }
        return arrayWithoutDroppedItems;
      }
      return array;
    }
    let property;
    let value;
    if (args.length === 1) {
      property = idKey;
      value = args[0];
    } else {
      property = args[0];
      value = args[1];
    }
    const array = arraySignal.peek();
    const arrayWithoutItemToDrop = [];
    let found = false;
    let itemDropped = null;
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (itemCandidateValue === value) {
        itemDropped = itemCandidate;
        found = true;
      } else {
        arrayWithoutItemToDrop.push(itemCandidate);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
      for (const itemDropCallback of itemDropCallbackSet) {
        itemDropCallback(itemDropped);
      }
      return arrayWithoutItemToDrop;
    }
    return array;
  };

  Object.assign(store, {
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    registerPropertyChangeCallback,
    registerItemDropCallback,
    registerItemRematchingCallback,
  });
  return store;
};
