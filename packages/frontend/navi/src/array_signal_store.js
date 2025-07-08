import { computed, effect, signal } from "@preact/signals";

export const primitiveCanBeId = (value) => {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "symbol") {
    return true;
  }
  return false;
};

export const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    mutableIdKeys = [],
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

  const readIdFromItemProps = (props, array) => {
    let id;
    if (Object.hasOwn(props, idKey)) {
      id = props[idKey];
      return id;
    }
    if (mutableIdKeys.length === 0) {
      return undefined;
    }

    let mutableIdKey;
    for (const mutableIdKeyCandidate of mutableIdKeys) {
      if (Object.hasOwn(props, mutableIdKeyCandidate)) {
        mutableIdKey = mutableIdKeyCandidate;
        break;
      }
    }
    if (!mutableIdKey) {
      throw new Error(
        `item properties must have one of the following keys:
${[idKey, ...mutableIdKeys].join(", ")}`,
      );
    }
    const mutableIdValue = props[mutableIdKey];
    for (const itemCandidate of array) {
      const mutableIdCandidate = itemCandidate[mutableIdKey];
      if (mutableIdCandidate === mutableIdValue) {
        id = itemCandidate[idKey];
        break;
      }
    }
    if (!id) {
      throw new Error(
        `None of the existing item uses ${mutableIdKey}: ${mutableIdValue}, so item properties must specify the "${idKey}" key.`,
      );
    }
    return id;
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
      if (value !== null && typeof value === "object") {
        value = readIdFromItemProps(value, array);
      }
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
  const selectAll = (toMatchArray) => {
    const array = arraySignal.value;
    const result = [];
    const idMap = idMapSignal.value;
    for (const toMatch of toMatchArray) {
      const id =
        toMatch !== null && typeof toMatch === "object"
          ? readIdFromItemProps(toMatch, array)
          : toMatch;
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
        const id = readIdFromItemProps(props, array);
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
    let propertyToMatch;
    let valueToMatch;
    let props;
    if (args.length === 1) {
      const firstArg = args[0];
      propertyToMatch = idKey;
      if (!firstArg || typeof firstArg !== "object") {
        throw new TypeError(
          `Expected an object as first argument, got ${firstArg}`,
        );
      }
      valueToMatch = readIdFromItemProps(firstArg, array);
      props = firstArg;
    } else if (args.length === 2) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (typeof valueToMatch === "object") {
        valueToMatch = valueToMatch[idKey];
      }
      props = args[1];
    } else if (args.length === 3) {
      propertyToMatch = args[0];
      valueToMatch = args[1];
      props = args[2];
    }
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
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
    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const triggerDropSet = new Set();
      const triggerItemDrops = () => {
        for (const triggerDrop of triggerDropSet) {
          triggerDrop();
        }
      };

      const firstArg = args[0];
      const arrayWithoutDroppedItems = [];
      let hasFound = false;
      const idToRemoveSet = new Set();
      for (const value of firstArg) {
        if (typeof value === "object" && value !== null) {
          const id = readIdFromItemProps(value, array);
          idToRemoveSet.add(id);
        } else if (!primitiveCanBeId(value)) {
          throw new TypeError(`id to drop must be an id, got ${value}`);
        }
        idToRemoveSet.add(value);
      }
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
    let propertyToMatch;
    let valueToMatch;
    if (args.length === 1) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (valueToMatch !== null && typeof valueToMatch === "object") {
        valueToMatch = readIdFromItemProps(valueToMatch, array);
      } else if (!primitiveCanBeId(valueToMatch)) {
        throw new TypeError(`id to drop must be an id, got ${valueToMatch}`);
      }
    } else {
      propertyToMatch = args[0];
      valueToMatch = args[1];
    }
    const arrayWithoutItemToDrop = [];
    let found = false;
    let itemDropped = null;
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
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
