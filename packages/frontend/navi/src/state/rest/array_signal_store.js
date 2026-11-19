import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

export const primitiveCanBeId = (value) => {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "symbol") {
    return true;
  }
  return false;
};

// How long a row nothing holds any more stays in its store: between one and
// two of these (see the sweep below). Long enough for one holder letting go
// and another taking the row over — a list leaving, the page replacing it
// reading the same rows — to happen in between.
const ROW_LEAVE_DELAY = 1000;

// Set while a range answer is written (see readRange in
// resource_range_reader.js), and so for every child its relations write
// along: the rows it brings stay for as long as something holds them (see
// `pinned` below), where a row any other write brings stays for as long as
// its store.
let rangeAnswerDepth = 0;
export const writeRangeAnswer = (write) => {
  rangeAnswerDepth++;
  try {
    return write();
  } finally {
    rangeAnswerDepth--;
  }
};

export const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    uniqueKeys = [],
    name,
    createItem = (props) => {
      return { ...props };
    },
    // Called with the item of a row leaving the store, deleted or let go of
    // (see the sweep below): what the item holds in other stores — the
    // children its relations point at — is let go of with it.
    leaveItem,
    // A row a range answer brings leaves once the holders that took it let go
    // of it. Without it the store keeps every row it is given: the store of a
    // scoped relation, whose owner holds all of it.
    letsGoOfRows = false,
  },
) => {
  const store = {
    name,
  };

  // `answer`: the props come from an answer, see upsertAnswer. createItem
  // hands it to the relations, which write the children inside the props.
  const createItemFromProps = (props, answer) => {
    if (props === null || typeof props !== "object") {
      return props;
    }
    if (props[idKey] === undefined) {
      // Kept under `undefined`, every such item would be one and the same: a
      // list drawing its last row as many times as it has rows, a creation
      // rewriting all of them — and nothing saying why.
      throw new Error(
        `${name || "store"}: an item arrived without "${idKey}" (it has ${Object.keys(props).join(", ")}) — declare its key with idKey, or give a single item an id of its own ({ id: "me", … })`,
      );
    }
    const item = createItem(props, answer);
    return item;
  };

  // One entry per row, by id, in the order the rows arrived: its item, and a
  // signal of it that a render reads to follow that row and no other. A write
  // touches the entries of the rows it names and nothing else, so a page
  // landing costs the page, whatever the store holds.
  //
  // What decides whether a row may leave (see mayLeave):
  // - `pinned`: written by something else than a range answer (an action's
  //   answer, a pushed message, the app): kept for as long as the store.
  // - `taken`: held at least once (see hold). A row a range answer brings and
  //   nobody takes stays too: read straight from the reader, its ids are kept
  //   by whoever asked, where the store cannot see them.
  // - `watched`: a render or an effect follows it.
  const entryById = new Map();
  // Bumped by every write that changes the rows. What reads the store as a
  // whole follows it — the array, a search by another key — and so does a
  // read of an id the store does not hold, to hear its row arrive.
  const versionSignal = signal(0);
  const bumpVersion = () => {
    versionSignal.value = versionSignal.peek() + 1;
  };
  // Built when read: a store nobody reads whole pays nothing for it.
  const arraySignal = computed(() => {
    // eslint-disable-next-line no-unused-expressions
    versionSignal.value;
    const array = [];
    for (const entry of entryById.values()) {
      array.push(entry.item);
    }
    return array;
  });
  const createItemSignal = (entry, item) => {
    const itemSignal = signal(item, {
      watched() {
        if (entry.itemSignal !== itemSignal) {
          return;
        }
        entry.watched = true;
        leavingNext.delete(item[idKey]);
        leavingSoon.delete(item[idKey]);
      },
      unwatched() {
        // A signal the row left (renamed, gone) is not the row's to speak for.
        if (entry.itemSignal !== itemSignal) {
          return;
        }
        entry.watched = false;
        noteMayLeave(entry);
      },
    });
    return itemSignal;
  };
  const createEntry = (item, pinned) => {
    const entry = {
      item,
      itemSignal: null,
      pinned,
      taken: holdCountById.has(item[idKey]),
      watched: false,
    };
    entry.itemSignal = createItemSignal(entry, item);
    return entry;
  };

  // How many holders hold each id: the ranks of a list run and of a
  // composition (see createHeldItems, and resource_range_reader.js), the
  // parent rows pointing at it through a relation (resource_graph.js). Counted
  // by id rather than on the entry: a holder may hold an id before its row
  // arrives, and keeps holding it while its row is gone and comes back.
  const holdCountById = new Map();
  const hold = (id) => {
    if (id === undefined) {
      return;
    }
    holdCountById.set(id, (holdCountById.get(id) || 0) + 1);
    const entry = entryById.get(id);
    if (entry) {
      entry.taken = true;
      leavingNext.delete(id);
      leavingSoon.delete(id);
    }
  };
  const release = (id) => {
    const count = holdCountById.get(id);
    if (count === undefined) {
      // Under an id its row no longer has: the count went with the row when
      // it was renamed (see replaceItem), and keeps it.
      return;
    }
    if (count > 1) {
      holdCountById.set(id, count - 1);
      return;
    }
    holdCountById.delete(id);
    const entry = entryById.get(id);
    if (entry) {
      noteMayLeave(entry);
    }
  };
  // A Map of the store's items by rank, holding each item while it is in it:
  // what a list run keeps of the collection it draws (see useItemStore in
  // list.jsx). `clear()` lets go of them all, which the run does as it leaves.
  const createHeldItems = () => new HeldItems(hold, release, idKey);

  const mayLeave = (entry) =>
    letsGoOfRows &&
    entry.taken &&
    !entry.pinned &&
    !entry.watched &&
    !holdCountById.has(entry.item[idKey]);
  // The rows let go of, in two generations: since the last sweep, and before
  // it. A sweep sends the older ones away if nothing took them back, so a row
  // leaves between one and two ROW_LEAVE_DELAY after it was last let go of.
  // It leaves without a word: not a removal (observeRemovals hears deletes,
  // which a list takes out of the collection), the store forgetting a row it
  // kept for nobody. Read again by id, the row is absent, as after a reload.
  let leavingNext = new Set();
  let leavingSoon = new Set();
  let sweepTimeout = null;
  const noteMayLeave = (entry) => {
    if (!mayLeave(entry)) {
      return;
    }
    leavingNext.add(entry.item[idKey]);
    if (sweepTimeout === null) {
      sweepTimeout = setTimeout(sweep, ROW_LEAVE_DELAY);
    }
  };
  const sweep = () => {
    sweepTimeout = null;
    const leaving = [];
    for (const id of leavingSoon) {
      const entry = entryById.get(id);
      if (entry && mayLeave(entry)) {
        leaving.push(entry);
      }
    }
    leavingSoon = leavingNext;
    leavingNext = new Set();
    if (leavingSoon.size > 0) {
      sweepTimeout = setTimeout(sweep, ROW_LEAVE_DELAY);
    }
    if (leaving.length === 0) {
      return;
    }
    batch(() => {
      for (const entry of leaving) {
        entryById.delete(entry.item[idKey]);
        entry.itemSignal.value = undefined;
      }
      bumpVersion();
      if (leaveItem) {
        for (const entry of leaving) {
          leaveItem(entry.item);
        }
      }
    });
  };
  for (const item of initialArray) {
    entryById.set(item[idKey], createEntry(item, true));
  }

  const itemPropertiesObserverSet = new Set();
  const observeItemProperties = (itemSignal, callback, { properties } = {}) => {
    const propertiesSet = properties ? new Set(properties) : null;
    const observer = { itemSignal, callback, propertiesSet };
    itemPropertiesObserverSet.add(observer);
    return () => {
      itemPropertiesObserverSet.delete(observer);
    };
  };

  const propertiesObserverSet = new Set();
  const observeProperties = (callback, { properties } = {}) => {
    const propertiesSet = properties ? new Set(properties) : null;
    const observer = { callback, propertiesSet };
    propertiesObserverSet.add(observer);
    return () => {
      propertiesObserverSet.delete(observer);
    };
  };

  const removalsCallbackSet = new Set();
  const observeRemovals = (callback) => {
    removalsCallbackSet.add(callback);
    return () => {
      removalsCallbackSet.delete(callback);
    };
  };

  // The id of the row `props` name: under idKey, or the row holding the same
  // value under one of the unique keys — read off the whole store, as only
  // the id is indexed.
  const readIdFromItemProps = (props) => {
    let id;
    if (Object.hasOwn(props, idKey)) {
      id = props[idKey];
      return id;
    }
    if (uniqueKeys.length === 0) {
      return undefined;
    }

    let uniqueKey;
    for (const uniqueKeyCandidate of uniqueKeys) {
      if (Object.hasOwn(props, uniqueKeyCandidate)) {
        uniqueKey = uniqueKeyCandidate;
        break;
      }
    }
    if (!uniqueKey) {
      throw new Error(
        `item properties must have one of the following keys:
${[idKey, ...uniqueKeys].join(", ")}`,
      );
    }
    const uniqueKeyValue = props[uniqueKey];
    for (const entry of entryById.values()) {
      const uniqueKeyCandidate = entry.item[uniqueKey];
      if (uniqueKeyCandidate === uniqueKeyValue) {
        id = entry.item[idKey];
        break;
      }
    }
    if (!id) {
      throw new Error(
        `None of the existing item uses ${uniqueKey}: ${uniqueKeyValue}, so item properties must specify the "${idKey}" key.`,
      );
    }
    return id;
  };
  // Read by id, a render follows that row alone — an upsert replaces only the
  // items it changes (see assign below), so a row nobody wrote stays still
  // while the rest of the store moves. An id the store does not hold is
  // followed through the version, until its row arrives.
  const readItem = (id) => {
    const entry = entryById.get(id);
    if (entry) {
      return entry.itemSignal.value;
    }
    // eslint-disable-next-line no-unused-expressions
    versionSignal.value;
    return undefined;
  };
  const readIdOf = (toMatch) => {
    if (toMatch === null || typeof toMatch !== "object") {
      return toMatch;
    }
    if (!Object.hasOwn(toMatch, idKey)) {
      // Found by a unique key, read off the whole store: followed whole.
      // eslint-disable-next-line no-unused-expressions
      versionSignal.value;
    }
    return readIdFromItemProps(toMatch);
  };

  const select = (...args) => {
    let property;
    let value;
    if (args.length === 1) {
      property = idKey;
      value = readIdOf(args[0]);
    } else if (args.length === 2) {
      property = args[0];
      value = args[1];
    }
    if (property === idKey) {
      return readItem(value);
    }
    // eslint-disable-next-line no-unused-expressions
    versionSignal.value;
    for (const entry of entryById.values()) {
      const itemCandidate = entry.item;
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
    const result = [];
    for (const toMatch of toMatchArray) {
      const item = readItem(readIdOf(toMatch));
      if (item) {
        result.push(item);
      }
    }
    return result;
  };
  // A value changes a row when it is another object — the app writing a new
  // one says something changed, and that is taken as said. An answer says it
  // with every object nested in its rows: JSON.parse makes them all new, the
  // ones that did not move included, so a revalidation returning the same
  // rows would replace every one of them for every reader. What an answer
  // sends again equal in depth is the value already held (see upsertAnswer).
  const valueChangedByWrite = (newValue, oldValue) => newValue !== oldValue;
  const valueChangedByAnswer = (newValue, oldValue) =>
    newValue !== oldValue && !compareTwoJsValues(newValue, oldValue);
  // One write, however many stores its relations reach: an effect reading the
  // rows (a render, the page kept for the next document) runs once the whole
  // write is in, rather than once per child written, half of it still to come.
  const upsertWith = (args, answer) => batch(() => upsertWithNow(args, answer));
  const upsertWithNow = (args, answer) => {
    const valueChanged = answer ? valueChangedByAnswer : valueChangedByWrite;
    const pins = !letsGoOfRows || rangeAnswerDepth === 0;
    const mutationsMap = new Map(); // Map<itemId, propertyMutations>
    const triggerPropertyMutations = () => {
      for (const itemPropertiesObserver of itemPropertiesObserverSet) {
        const { itemSignal, callback, propertiesSet } = itemPropertiesObserver;
        const watchedItem = itemSignal.peek();
        if (!watchedItem) {
          continue;
        }
        const itemMutations = mutationsMap.get(watchedItem[idKey]);
        if (itemMutations) {
          if (propertiesSet) {
            let hasRelevantMutation = false;
            for (const p of propertiesSet) {
              if (Object.hasOwn(itemMutations, p)) {
                hasRelevantMutation = true;
                break;
              }
            }
            if (hasRelevantMutation) {
              callback(itemMutations);
            }
          } else {
            callback(itemMutations);
          }
        }
      }
      if (propertiesObserverSet.size) {
        const allMutations = Array.from(mutationsMap.values());
        for (const propertiesObserver of propertiesObserverSet) {
          const { callback, propertiesSet } = propertiesObserver;
          if (propertiesSet) {
            const filteredMutations = [];
            for (const propertyMutations of allMutations) {
              for (const p of propertiesSet) {
                if (Object.hasOwn(propertyMutations, p)) {
                  filteredMutations.push(propertyMutations);
                  break;
                }
              }
            }
            if (filteredMutations.length > 0) {
              callback(filteredMutations);
            }
          } else {
            callback(allMutations);
          }
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
          const { set } = itemOwnPropertyDescriptors[key];
          if (set) {
            // A relation (.one(), .many() and their scoped forms in
            // resource_graph.js): the row holds which children it points to,
            // the children live in their own store, and whoever reads them
            // follows them there. Its setter writes them, compared as this
            // write compares (`answer`), and says whether the row points
            // elsewhere now. Compared as a value instead, the children
            // received are never the object the row hands out, and every
            // write naming the relation would replace the row.
            if (set.call(itemWithProps, newValue, answer)) {
              hasChanges = true;
              propertyMutations[key] = {
                oldValue,
                newValue,
                target: item,
                newTarget: itemWithProps,
              };
            }
            continue;
          }
          if (valueChanged(newValue, oldValue)) {
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

      // Store mutations keyed by old id
      mutationsMap.set(item[idKey], propertyMutations);
      return itemWithProps;
    };

    let changed = false;
    // The row's new item in place of the one its entry held. Renamed (its
    // idKey written), the row moves to its new id with what holds it, and
    // whoever reads the old id sees it go.
    const replaceItem = (entry, item) => {
      const id = entry.item[idKey];
      const newId = item[idKey];
      entry.item = item;
      changed = true;
      if (newId === id) {
        entry.itemSignal.value = item;
        return;
      }
      const itemSignalOfOldId = entry.itemSignal;
      entryById.delete(id);
      entry.itemSignal = createItemSignal(entry, item);
      entry.watched = false;
      entryById.set(newId, entry);
      const holdCount = holdCountById.get(id);
      if (holdCount !== undefined) {
        holdCountById.delete(id);
        holdCountById.set(newId, (holdCountById.get(newId) || 0) + holdCount);
      }
      itemSignalOfOldId.value = undefined;
    };
    const write = (entry, props) => {
      if (pins) {
        entry.pinned = true;
      }
      // A row let go of and written again waits again: an answer is taken in
      // by the list that asked a render later, and the row must still be
      // there then (see the sweep).
      const id = entry.item[idKey];
      if (leavingSoon.delete(id)) {
        leavingNext.add(id);
      }
      const item = assign(entry.item, props);
      if (item !== entry.item) {
        replaceItem(entry, item);
      }
      return item;
    };
    const insert = (props) => {
      const item = createItemFromProps(props, answer);
      entryById.set(item[idKey], createEntry(item, pins));
      changed = true;
      return item;
    };
    const done = () => {
      if (changed) {
        bumpVersion();
        triggerPropertyMutations();
      }
    };

    if (args.length === 1 && Array.isArray(args[0])) {
      const items = [];
      for (const props of args[0]) {
        const entry = entryById.get(readIdFromItemProps(props));
        items.push(entry ? write(entry, props) : insert(props));
      }
      done();
      return items;
    }
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
      valueToMatch = readIdFromItemProps(firstArg);
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
    if (propertyToMatch === idKey) {
      const entry = entryById.get(valueToMatch);
      if (entry) {
        const item = write(entry, props);
        done();
        return item;
      }
    } else {
      const entryMatchingArray = [];
      for (const entry of entryById.values()) {
        const itemCandidateValue =
          typeof propertyToMatch === "function"
            ? propertyToMatch(entry.item)
            : entry.item[propertyToMatch];
        if (itemCandidateValue === valueToMatch) {
          entryMatchingArray.push(entry);
        }
      }
      if (entryMatchingArray.length > 0) {
        let item;
        for (const entry of entryMatchingArray) {
          item = write(entry, props);
        }
        done();
        return item;
      }
    }
    const item = insert(props);
    done();
    return item;
  };
  const upsert = (...args) => upsertWith(args, false);
  /**
   * Writes what the server sent — a callback's answer, a pushed message (a
   * websocket's, a server-sent event's) — into the store. Takes what `upsert`
   * takes and returns the same: a row equal in depth to the one held stays
   * the one held, and its readers stay still, where `upsert` compares by
   * reference and JSON makes every nested object a new one. The children its
   * relations carry into their own stores are compared the same way. A new row joins no
   * `GET_MANY` and no `GET_RANGE` composition: read again what it belongs to
   * (docs/resource.md).
   */
  const upsertAnswer = (...args) => upsertWith(args, true);
  // Batched like upsertWith: a removal observer may drop rows of another
  // store (a `.one()` declared with `onDelete: "cascade"`), and an effect
  // reading both runs once, never between the child leaving and its parents.
  const drop = (...args) => batch(() => dropNow(...args));
  const dropNow = (...args) => {
    const removedItemArray = [];
    const remove = (entry) => {
      entryById.delete(entry.item[idKey]);
      entry.itemSignal.value = undefined;
      removedItemArray.push(entry.item);
    };
    const done = () => {
      if (removedItemArray.length === 0) {
        return;
      }
      bumpVersion();
      if (leaveItem) {
        for (const removedItem of removedItemArray) {
          leaveItem(removedItem);
        }
      }
      for (const removalsCallback of removalsCallbackSet) {
        removalsCallback(removedItemArray);
      }
    };

    if (args.length === 1 && Array.isArray(args[0])) {
      const idRemovedArray = [];
      const idRemovedSet = new Set();
      const idNotFoundArray = [];
      for (const value of args[0]) {
        let id;
        if (typeof value === "object" && value !== null) {
          id = readIdFromItemProps(value);
        } else if (primitiveCanBeId(value)) {
          id = value;
        } else {
          throw new TypeError(`id to drop must be an id, got ${value}`);
        }
        const entry = entryById.get(id);
        if (entry) {
          remove(entry);
          idRemovedArray.push(id);
          idRemovedSet.add(id);
        } else if (!idRemovedSet.has(id)) {
          idNotFoundArray.push(id);
        }
      }
      if (idNotFoundArray.length > 0) {
        console.warn(
          `arraySignalStore.drop: Some ids were not found in the array: ${idNotFoundArray.join(", ")}`,
        );
      }
      done();
      return idRemovedArray;
    }
    let propertyToMatch;
    let valueToMatch;
    if (args.length === 1) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (valueToMatch !== null && typeof valueToMatch === "object") {
        valueToMatch = readIdFromItemProps(valueToMatch);
      } else if (!primitiveCanBeId(valueToMatch)) {
        throw new TypeError(`id to drop must be an id, got ${valueToMatch}`);
      }
    } else {
      propertyToMatch = args[0];
      valueToMatch = args[1];
    }
    if (propertyToMatch === idKey) {
      const entry = entryById.get(valueToMatch);
      if (!entry) {
        return null;
      }
      remove(entry);
      done();
      return entry.item[idKey];
    }
    const entryMatchingArray = [];
    for (const entry of entryById.values()) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(entry.item)
          : entry.item[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
        entryMatchingArray.push(entry);
      }
    }
    if (entryMatchingArray.length === 0) {
      return null;
    }
    for (const entry of entryMatchingArray) {
      remove(entry);
    }
    done();
    return entryMatchingArray[entryMatchingArray.length - 1].item[idKey];
  };

  const signalForKey = (key, keyValueSignal) => {
    if (key === idKey) {
      return _signalForIdKey(keyValueSignal);
    }
    if (uniqueKeys.includes(key)) {
      return _signalForUniqueKey(key, keyValueSignal);
    }
    throw new Error(
      `signalForKey: "${key}" is not the idKey or a uniqueKey of this store (idKey: ${idKey}, uniqueKeys: ${uniqueKeys.join(", ")})`,
    );
  };
  const _signalForUniqueKey = (uniqueKey, uniqueKeyValueSignal) => {
    const itemIdSignal = signal(null);
    const check = (value) => {
      const item = select(uniqueKey, value);
      if (!item) {
        return false;
      }
      itemIdSignal.value = item[idKey];
      return true;
    };
    if (!check(uniqueKeyValueSignal.peek())) {
      effect(function () {
        const uniqueKeyValue = uniqueKeyValueSignal.value;
        if (check(uniqueKeyValue)) {
          this.dispose();
        }
      });
    }
    return computed(() => {
      return select(itemIdSignal.value);
    });
  };

  const _signalForIdKey = (idValueSignal) => {
    const itemIdSignal = signal(null);
    const check = (value) => {
      const item = select(idKey, value);
      if (!item) {
        return false;
      }
      itemIdSignal.value = item[idKey];
      return true;
    };
    if (!check(idValueSignal.peek())) {
      effect(function () {
        const idValue = idValueSignal.value;
        if (check(idValue)) {
          this.dispose();
        }
      });
    }
    // When the id itself is renamed, keep itemIdSignal in sync.
    observeProperties(
      (mutationsArray) => {
        const currentId = itemIdSignal.peek();
        if (currentId === null) return;
        for (const mutations of mutationsArray) {
          const mutation = mutations[idKey];
          if (mutation.oldValue === currentId) {
            itemIdSignal.value = mutation.newValue;
            break;
          }
        }
      },
      { properties: [idKey] },
    );
    return computed(() => {
      return select(itemIdSignal.value);
    });
  };

  Object.assign(store, {
    idKey,
    uniqueKeys,
    arraySignal,
    select,
    selectAll,
    upsert,
    upsertAnswer,
    drop,
    hold,
    release,
    createHeldItems,

    observeItemProperties,
    observeProperties,
    observeRemovals,
    signalForKey,
  });
  return store;
};

// See createHeldItems above: setting, deleting and clearing hold and let go of
// the items they put in and take out, so what the map holds is what it holds
// in the store, whoever writes to it.
class HeldItems extends Map {
  constructor(hold, release, idKey) {
    super();
    this.holdItem = (item) => {
      if (item) {
        hold(item[idKey]);
      }
    };
    this.releaseItem = (item) => {
      if (item) {
        release(item[idKey]);
      }
    };
  }
  set(key, item) {
    const previous = super.get(key);
    super.set(key, item);
    if (item !== previous) {
      this.holdItem(item);
      this.releaseItem(previous);
    }
    return this;
  }
  delete(key) {
    if (!super.has(key)) {
      return false;
    }
    const previous = super.get(key);
    super.delete(key);
    this.releaseItem(previous);
    return true;
  }
  clear() {
    const items = Array.from(super.values());
    super.clear();
    for (const item of items) {
      this.releaseItem(item);
    }
  }
}

export const syncStoreToSignals = (store, propertyToSignalMap) => {
  const { idKey } = store;
  const cleanupCallbackSet = new Set();
  for (const [propertyName, targetSignal] of Object.entries(
    propertyToSignalMap,
  )) {
    if (propertyName === idKey) {
      const unsubscribe = store.observeProperties(
        (mutationsArray) => {
          for (const mutations of mutationsArray) {
            const mutation = mutations[idKey];
            if (mutation.oldValue === targetSignal.peek()) {
              targetSignal.value = mutation.newValue;
              break;
            }
          }
        },
        { properties: [idKey] },
      );
      cleanupCallbackSet.add(unsubscribe);
      continue;
    }
    const itemSignal = store.signalForKey(propertyName, targetSignal);
    const unsubscribe = store.observeItemProperties(
      itemSignal,
      (propertyMutations) => {
        const mutation = propertyMutations[propertyName];
        targetSignal.value = mutation.newValue;
      },
      { properties: [propertyName] },
    );
    cleanupCallbackSet.add(unsubscribe);
  }
  return () => {
    for (const cleanup of cleanupCallbackSet) {
      cleanup();
    }
    cleanupCallbackSet.clear();
  };
};
