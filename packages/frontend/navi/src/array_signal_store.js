import { computed, effect, signal } from "@preact/signals";

export const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    name,
    createItem = () => {
      return {};
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

    const item = createItem();
    Object.assign(item, props);

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
    previousIdSetSignal.value = new Set(idSet);
    for (const idChangeCallback of idChangeCallbackSet) {
      idChangeCallback(idSet, previousIdSet);
    }
  });

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
      for (const existingItem of array) {
        const existingItemId = existingItem[idKey];
        if (idToRemoveSet.has(existingItemId)) {
          hasFound = true;
          idToRemoveSet.delete(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (hasFound) {
        arraySignal.value = arrayWithoutDroppedItems;
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
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (itemCandidateValue === value) {
        found = true;
      } else {
        arrayWithoutItemToDrop.push(itemCandidate);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
      return arrayWithoutItemToDrop;
    }
    return array;
  };

  /**
   * For example a signal like this:
   * const currentItemSignal = computed(() => {
   *    return arrayStore.select("name", "a");
   * })
   * Will return null when the item "a" is renamed
   * But we still want to detect the rename or the deletion of such an item
   * So we use a signal not reset when it becomes null + rely on item id to find it back in the array
   */
  const registerPropertyLifecycle = (
    itemSignal,
    property,
    { changed, dropped, reinserted },
  ) => {
    let wasFound = false;
    const NOT_FOUND = { label: "not_found" };
    const idToTrackSignal = signal(null);
    effect(() => {
      const item = itemSignal.value;
      if (item) {
        idToTrackSignal.value = item[idKey];
      } else if (idToTrackSignal.peek()) {
        // not found, it was likely deleted
        // but maybe it was renamed so we need
        // the other effect to be sure
      }
    });
    const valueSignal = computed(() => {
      const idToTrack = idToTrackSignal.value;
      const idMap = idMapSignal.value;
      if (!idToTrack) {
        return NOT_FOUND;
      }
      const item = idMap.get(idToTrack);
      if (!item) {
        return NOT_FOUND;
      }
      return typeof property === "function" ? property(item) : item[property];
    });
    const previousValueSignal = signal(valueSignal.peek());

    return effect(() => {
      const value = valueSignal.value;
      const previousValue = previousValueSignal.peek();
      previousValueSignal.value = value;

      if (
        value !== previousValue &&
        previousValue !== NOT_FOUND &&
        value !== NOT_FOUND
      ) {
        changed(value, previousValue);
      } else if (previousValue === NOT_FOUND && value !== NOT_FOUND) {
        if (wasFound) {
          reinserted(value, previousValue);
        }
      } else if (previousValue !== NOT_FOUND && value === NOT_FOUND) {
        dropped(previousValue);
      }

      if (value !== NOT_FOUND) {
        wasFound = true;
      }
    });
  };

  Object.assign(store, {
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    registerPropertyLifecycle,
  });
  return store;
};

export const assign = (item, props) => {
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
      }
    } else {
      modified = true;
      itemWithProps[key] = newValue;
    }
  }
  return modified ? itemWithProps : item;
};
