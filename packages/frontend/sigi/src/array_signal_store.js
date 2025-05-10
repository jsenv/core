import { signal, effect, computed } from "@preact/signals";

export const arraySignalStore = (initialArray = [], idKey = "id") => {
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

  const select = (property, value) => {
    const array = arraySignal.value;
    const idMap = idMapSignal.value;
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
  const selectAll = (objects) => {
    const result = [];
    const idMap = idMapSignal.value;
    for (const object of objects) {
      const id = object[idKey];
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
        arraySignal.value = propsArray;
        return;
      }
      let hasNew = false;
      let hasUpdate = false;
      const arrayUpdated = [];
      const existingEntryMap = new Map();
      let index = 0;
      while (index < array.length) {
        const existingItem = array[index];
        arrayUpdated.push(existingItem);
        const id = existingItem[idKey];
        existingEntryMap.set(id, {
          existingItem,
          existingItemIndex: index,
        });
        index++;
      }

      for (const props of propsArray) {
        const id = props[idKey];
        const existingEntry = existingEntryMap.get(id);
        if (existingEntry) {
          const { existingItem, existingItemIndex } = existingEntry;
          const itemWithPropsOrItem = assign(existingItem, props);
          if (itemWithPropsOrItem !== existingItem) {
            hasUpdate = hasUpdate || true;
            arrayUpdated[existingItemIndex] = itemWithPropsOrItem;
          }
        } else {
          hasNew = true;
          arrayUpdated.push(props);
        }
      }
      if (hasNew || hasUpdate) {
        arraySignal.value = arrayUpdated;
      }
      return;
    }
    let isNew = true;
    let updated = false;
    const arrayUpdated = [];
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
        isNew = false;
        const itemWithPropsOrItem = assign(itemCandidate, props);
        if (itemWithPropsOrItem !== itemCandidate) {
          updated = true;
        }
        arrayUpdated.push(itemWithPropsOrItem);
      } else {
        arrayUpdated.push(itemCandidate);
      }
    }
    if (isNew) {
      arrayUpdated.push(props);
      arraySignal.value = arrayUpdated;
      return;
    }
    if (updated) {
      arraySignal.value = arrayUpdated;
    }
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
      }
      return arrayWithoutDroppedItems;
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
    }
    return array;
  };

  /**
   * Both propertyChangeEffect and deleteEffect might receive a signal
   * That starts to return a falsy value because it rely on a given property to find an item
   *
   * For example a signal like this:
   * const currentItemSignal = computed(() => {
   *    return arrayStore.select("name", "a");
   * })
   * Will return null when the item "a" is renamed
   * But we still want to detect the rename or the deletion of such an item
   * So we use a signal not reset when it becomes null + rely on item id to find it back in the array
   */
  const propertyChangeEffect = (itemSignal, property, callback) => {
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
      return item
        ? typeof property === "function"
          ? property(item)
          : item[property]
        : NOT_FOUND;
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
        callback(value, previousValue);
      }
    });
  };
  const deleteEffect = (itemSignal, callback) => {
    const idToTrackSignal = signal(null);
    effect(() => {
      const item = itemSignal.value;
      if (item) {
        idToTrackSignal.value = item[idKey];
      } else {
        // not found, it was likely deleted
        // but maybe it was renamed so we need
        // the other effect to be sure
      }
    });
    const detectIdDeleted = (idSet, previousIdSet) => {
      const idToTrack = idToTrackSignal.value;
      if (idToTrack && previousIdSet.has(idToTrack) && !idSet.has(idToTrack)) {
        callback(idToTrack);
      }
    };
    idChangeCallbackSet.add(detectIdDeleted);
    return () => {
      idChangeCallbackSet.delete(detectIdDeleted);
    };
  };

  return {
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    deleteEffect,
    propertyChangeEffect,
  };
};

const assign = (item, props) => {
  let modified = false;
  const itemWithProps = { ...item };
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
