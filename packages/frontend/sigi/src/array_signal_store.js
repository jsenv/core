import { signal, effect, computed } from "@preact/signals";

export const arraySignalStore = (initialArray = [], idKey = "id") => {
  const arraySignal = signal(initialArray);

  const select = (property, value) => {
    const array = arraySignal.peek();
    for (const itemCandidate of array) {
      const valueCandidate = itemCandidate[property];
      if (valueCandidate === value) {
        return itemCandidate;
      }
    }
    return null;
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
      const existingItemMap = new Map();
      for (const existingItem of array) {
        arrayUpdated.push(existingItem);
        existingItemMap.set(existingItem[idKey], existingItem);
      }
      for (const props of propsArray) {
        const id = props[idKey];
        const existingItem = existingItemMap.get(id);
        if (existingItem) {
          const updated = assign(existingItem, props);
          hasUpdate = hasUpdate || updated;
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
    for (const existingItem of array) {
      if (existingItem[property] === value) {
        isNew = false;
        updated = assign(existingItem, props);
        arrayUpdated.push(existingItem);
      } else {
        arrayUpdated.push(existingItem);
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
  const drop = (data) => {
    if (Array.isArray(data)) {
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
    const idToRemove = data;
    const array = arraySignal.peek();
    const arrayWithoutItemToDrop = [];
    let found = false;
    for (const existingItem of array) {
      if (existingItem[idKey] === idToRemove) {
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
  const propertyChangeEffect = (
    itemSignal,
    // one day property might be allowed to be a function to support nested property or abstract property
    property,
    callback,
  ) => {
    const NOT_FOUND = { label: "not_found" };
    const itemSignalCopy = signal(itemSignal.peek());
    effect(() => {
      const item = itemSignal.value;
      if (item) {
        itemSignalCopy.value = item;
      } else if (itemSignalCopy.peek()) {
        // not found, it was likely deleted
        // but maybe it was renamed so we need
        // the other effect to be sure
      }
    });
    const valueSignal = computed(() => {
      const item = itemSignalCopy.value;
      const array = arraySignal.value;
      if (!item) {
        return NOT_FOUND;
      }
      const value = item[property];
      const itemId = item[idKey];
      for (const itemCandidate of array) {
        const itemCandidateId = itemCandidate[idKey];
        if (itemCandidateId === itemId) {
          return value;
        }
      }
      return NOT_FOUND;
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
    const idSetSignal = computed(() => {
      const array = arraySignal.value;
      const idSet = new Set();
      for (const item of array) {
        idSet.add(item[idKey]);
      }
      return idSet;
    });
    const previousIdSetSignal = signal(new Set(idSetSignal.peek()));

    return effect(() => {
      const idToTrack = idToTrackSignal.value;
      const idSet = idSetSignal.value;
      const previousIdSet = previousIdSetSignal.peek();
      previousIdSetSignal.value = new Set(idSet);
      if (idToTrack && previousIdSet.has(idToTrack) && !idSet.has(idToTrack)) {
        callback(idToTrack);
      }
    });
  };

  return {
    arraySignal,
    select,
    upsert,
    drop,

    deleteEffect,
    propertyChangeEffect,
  };
};

const assign = (item, props) => {
  let modified = false;
  for (const key of Object.keys(props)) {
    const newValue = props[key];
    if (key in item) {
      const value = item[key];
      if (newValue !== value) {
        modified = true;
        item[key] = newValue;
      }
    } else {
      modified = true;
      item[key] = newValue;
    }
  }
  return modified;
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
