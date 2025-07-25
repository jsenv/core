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

  const propertiesObserverSet = new Set();
  const observeProperties = (itemSignal, callback) => {
    const observer = { itemSignal, callback };
    propertiesObserverSet.add(observer);

    // Return cleanup function
    return () => {
      propertiesObserverSet.delete(observer);
    };
  };

  const removalsCallbackSet = new Set();
  const observeRemovals = (callback) => {
    removalsCallbackSet.add(callback);
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
    const itemMutationsMap = new Map(); // Map<itemId, propertyMutations>
    const triggerPropertyMutations = () => {
      if (itemMutationsMap.size === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const observer of propertiesObserverSet) {
        const { itemSignal, callback } = observer;
        const watchedItem = itemSignal.peek();
        if (!watchedItem) {
          continue;
        }

        // Check if this item has mutations
        const itemSpecificMutations = itemMutationsMap.get(watchedItem[idKey]);
        if (itemSpecificMutations) {
          callback(itemSpecificMutations);
        }
      }
    };
    const assign = (item, props) => {
      const itemOwnPropertyDescriptors = Object.getOwnPropertyDescriptors(item);
      const itemOwnKeys = Object.keys(itemOwnPropertyDescriptors);
      const itemWithProps = Object.create(
        Object.getPrototypeOf(item),
        itemOwnPropertyDescriptors,
      );
      let hasChanges = false;
      const propertyMutations = {};

      for (const key of Object.keys(props)) {
        const newValue = props[key];
        if (itemOwnKeys.includes(key)) {
          const oldValue = item[key];
          if (newValue !== oldValue) {
            hasChanges = true;
            itemWithProps[key] = newValue;
            propertyMutations[key] = {
              oldValue,
              newValue,
              target: item,
              newTarget: itemWithProps,
            };
          }
        } else {
          hasChanges = true;
          itemWithProps[key] = newValue;
          propertyMutations[key] = {
            added: true,
            newValue,
            target: item,
            newTarget: itemWithProps,
          };
        }
      }

      if (!hasChanges) {
        return item;
      }

      // Store mutations for this specific item
      itemMutationsMap.set(item[idKey], propertyMutations);
      return itemWithProps;
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
        triggerPropertyMutations();
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
      triggerPropertyMutations();
      return updatedItem;
    }
    const item = createItemFromProps(props);
    arraySomeUpdated.push(item);
    arraySignal.value = arraySomeUpdated;
    triggerPropertyMutations();
    return item;
  };
  const drop = (...args) => {
    const removedItemArray = [];
    const triggerRemovedMutations = () => {
      if (removedItemArray.length === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const removalsCallback of removalsCallbackSet) {
        removalsCallback(removedItemArray);
      }
    };

    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const firstArg = args[0];
      const arrayWithoutDroppedItems = [];
      let hasFound = false;
      const idToRemoveSet = new Set();
      const idRemovedArray = [];

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
          idRemovedArray.push(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (idToRemoveSet.size > 0) {
        console.warn(
          `arraySignalStore.drop: Some ids were not found in the array: ${Array.from(idToRemoveSet).join(", ")}`,
        );
      }
      if (hasFound) {
        arraySignal.value = arrayWithoutDroppedItems;
        triggerRemovedMutations();
        return idRemovedArray;
      }
      return [];
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
      removedItemArray.push(itemDropped);
      triggerRemovedMutations();
      return itemDropped[idKey];
    }
    return null;
  };

  const signalForMutableIdKey = (mutableIdKey, mutableIdValueSignal) => {
    const itemIdSignal = signal(null);
    const check = (value) => {
      const item = select(mutableIdKey, value);
      if (!item) {
        return false;
      }
      itemIdSignal.value = item[idKey];
      return true;
    };
    if (!check()) {
      effect(function () {
        const mutableIdValue = mutableIdValueSignal.value;
        if (check(mutableIdValue)) {
          this.dispose();
        }
      });
    }

    return computed(() => {
      return select(itemIdSignal.value);
    });
  };

  Object.assign(store, {
    mutableIdKeys,
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    observeProperties,
    observeRemovals,
    registerItemMatchLifecycle,
    signalForMutableIdKey,
  });
  return store;
};
