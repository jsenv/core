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
  const store = {
    name,
  };

  const createItemFromProps = (props) => {
    if (props === null || typeof props !== "object") {
      return props;
    }
    const item = createItem(props);
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
    if (modified) {
      previousIdSetSignal.value = setCopy;
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

  const itemDropCallbackSet = new Set();
  const registerItemDropCallback = (callback) => {
    itemDropCallbackSet.add(callback);
  };

  const itemMatchLifecycleSet = new Set();
  const registerItemMatchLifecycle = (matchPredicate, { match, nomatch }) => {
    const matchState = {
      hasMatched: false,
      hadMatchedBefore: false,
    };
    const itemMatchLifecycle = {
      matchPredicate,
      match,
      nomatch,
      matchState,
    };
    itemMatchLifecycleSet.add(itemMatchLifecycle);
  };

  effect(() => {
    const array = arraySignal.value;

    for (const {
      matchPredicate,
      match,
      nomatch,
      matchState,
    } of itemMatchLifecycleSet) {
      let currentlyHasMatch = false;

      // Check if any item currently matches
      for (const item of array) {
        if (matchPredicate(item)) {
          currentlyHasMatch = true;
          break;
        }
      }

      // Handle state transitions
      if (currentlyHasMatch && !matchState.hasMatched) {
        // New match found
        matchState.hasMatched = true;
        const isRematch = matchState.hadMatchedBefore;
        if (match) {
          match(isRematch);
        }
      } else if (!currentlyHasMatch && matchState.hasMatched) {
        // No longer has match
        matchState.hasMatched = false;
        matchState.hadMatchedBefore = true;
        if (nomatch) {
          nomatch();
        }
      }
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
    const triggerPropertyChangeSet = new Set();
    const triggerPropertyChanges = () => {
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const triggerPropertyChange of triggerPropertyChangeSet) {
        triggerPropertyChange();
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
              triggerPropertyChangeSet.add(() => {
                for (const propertyChangeCallback of propertyChangeCallbackSet) {
                  propertyChangeCallback(newValue, value, itemWithProps);
                }
              });
            }
          }
        } else {
          modified = true;
          itemWithProps[key] = newValue;
          const propertyChangeCallbackSet =
            propertyChangeCallbackSetMap.get(key);
          if (propertyChangeCallbackSet) {
            triggerPropertyChangeSet.add(() => {
              for (const propertyChangeCallback of propertyChangeCallbackSet) {
                propertyChangeCallback(newValue, undefined, itemWithProps);
              }
            });
          }
        }
      }
      return modified ? itemWithProps : item;
    };

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
        triggerPropertyChanges();
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
      const firstArg = args[0];
      if (!firstArg || typeof firstArg !== "object") {
        throw new TypeError(
          `Expected an object as first argument, got ${firstArg}`,
        );
      }
      value = firstArg[idKey];
      props = firstArg;
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
      triggerPropertyChanges();
      return updatedItem;
    }
    const item = createItemFromProps(props);
    arraySomeUpdated.push(item);
    arraySignal.value = arraySomeUpdated;
    triggerPropertyChanges();
    return item;
  };
  const drop = (...args) => {
    if (args.length === 1 && Array.isArray(args[0])) {
      const triggerDropSet = new Set();
      const triggerItemDrops = () => {
        for (const triggerDrop of triggerDropSet) {
          triggerDrop();
        }
      };

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
        triggerItemDrops();
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
    registerItemMatchLifecycle,
  });
  return store;
};
