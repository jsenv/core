import { effect, signal, untracked } from "@preact/signals";

import { NO_PARAMS } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import {
  compareTwoJsValues,
  SYMBOL_IDENTITY,
} from "../../utils/compare_two_js_values.js";

/*
 * The rows a resource's GET landed with, mirrored into a signal the app hands
 * over — a `stateSignal` with `persists` for a copy that survives a reload, so
 * that the reload starts on the "refresh over a known answer" line of
 * docs/data_states.md rather than on the first-load one. Where the signal
 * keeps its value is the signal's business; this module only decides what the
 * copy contains, when it enters the store, and when it is rewritten.
 *
 * What the signal holds: one item per params the GET was asked with (`""` for
 * a GET without params), as the store holds it with its relations written
 * inline — `user: { … }`, `my_games: [ … ]`. That is the shape the GET
 * callback itself returns, so the copy re-enters the store through the same
 * setters a real answer goes through and its relations normalize into their
 * own stores.
 *
 * It re-enters at the first run of the GET asking for it, never at
 * declaration: relations are declared after `resource()` returns, and a row
 * upserted before them keeps its relation values as plain data.
 *
 * The write follows the store, not the callback: an effect reads the item and
 * every row it reaches through a relation, so a PUT on the item or a list
 * upserting one of its children rewrites the copy. The signal turning
 * `undefined` from outside is "forget": nothing is written until a GET lands
 * again.
 */
export const createResourcePersistence = (
  store,
  { idKey, name, signal: persistedSignal, when },
) => {
  if (
    !persistedSignal ||
    typeof persistedSignal !== "object" ||
    typeof persistedSignal.subscribe !== "function"
  ) {
    throw new TypeError(
      `resource("${name}").persist needs a signal to write the copy into, received ${persistedSignal}`,
    );
  }

  // paramsKey → item the signal holds that is not in the store yet
  const storedItemMap = new Map();
  // paramsKey → id of the row the GET holds for these params
  const entryMapSignal = signal(new Map());
  const recordItem = (paramsKey, itemId) => {
    const entryMap = entryMapSignal.peek();
    if (entryMap.get(paramsKey) === itemId) {
      return;
    }
    const entryMapUpdated = new Map(entryMap);
    entryMapUpdated.set(paramsKey, itemId);
    entryMapSignal.value = entryMapUpdated;
  };
  const isAllowed = () => {
    return when ? Boolean(when()) : true;
  };

  // An empty signal means "nothing is known": whoever emptied it — sign-out
  // writing undefined, or `when` saying no — nothing is written again until a
  // GET lands.
  const forget = () => {
    storedItemMap.clear();
    if (entryMapSignal.peek().size > 0) {
      entryMapSignal.value = new Map();
    }
  };
  let lastWritten;
  const write = (value) => {
    if (compareTwoJsValues(value, lastWritten)) {
      return;
    }
    lastWritten = value;
    persistedSignal.value = value;
  };
  // Runs at once with what the signal already holds (the copy read from
  // storage), then on every write — the module's own ones are recognized
  // and left alone.
  persistedSignal.subscribe((value) => {
    if (value === lastWritten) {
      return;
    }
    lastWritten = value;
    storedItemMap.clear();
    if (value === undefined || value === null) {
      forget();
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    for (const paramsKey of Object.keys(value)) {
      storedItemMap.set(paramsKey, value[paramsKey]);
    }
  });

  const findItem = (params) => {
    const paramsKey = getParamsKey(params);
    return untracked(() => {
      const itemId = entryMapSignal.peek().get(paramsKey);
      if (itemId !== undefined) {
        const item = store.select(itemId);
        if (item) {
          return item;
        }
      }
      if (!isAllowed()) {
        return null;
      }
      const storedItem = storedItemMap.get(paramsKey);
      if (!storedItem || typeof storedItem !== "object") {
        return null;
      }
      storedItemMap.delete(paramsKey);
      const item = store.upsert(storedItem);
      recordItem(paramsKey, item[idKey]);
      return item;
    });
  };
  const recordGetItem = (params, itemId) => {
    recordItem(getParamsKey(params), itemId);
  };

  effect(() => {
    const entryMap = entryMapSignal.value;
    if (!isAllowed()) {
      write(undefined);
      forget();
      return;
    }
    if (entryMap.size === 0) {
      // Nothing is known yet: the copy is what a GET will draw, it must not
      // be erased by a page that has not asked anything.
      return;
    }
    const stored = {};
    for (const [paramsKey, storedItem] of storedItemMap) {
      stored[paramsKey] = storedItem;
    }
    for (const [paramsKey, itemId] of entryMap) {
      const item = store.select(itemId);
      if (!item) {
        continue;
      }
      stored[paramsKey] = serializeItem(item, new Set());
    }
    write(stored);
  });

  return {
    findItem,
    recordGetItem,
  };
};

const getParamsKey = (params) => {
  if (params === undefined || params === NO_PARAMS) {
    return "";
  }
  return stableStringify(params);
};

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${stableStringify(value[key])}`);
  }
  return `{${parts.join(",")}}`;
};

// The item with its relations inline: a relation value stands for what its
// signal holds (the child row, the child rows, or nothing), a row reached
// twice on the same path is written as its id — the setters accept both.
const serializeItem = (item, ancestorSet) => {
  ancestorSet.add(item);
  const serialized = {};
  for (const key of Object.keys(item)) {
    serialized[key] = serializeValue(item[key], ancestorSet);
  }
  ancestorSet.delete(item);
  return serialized;
};
const serializeValue = (value, ancestorSet) => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry, ancestorSet));
  }
  const objectSignal = value[SYMBOL_OBJECT_SIGNAL];
  if (objectSignal) {
    const held = objectSignal.value;
    if (held === undefined || held === null) {
      return null;
    }
    return serializeValue(held, ancestorSet);
  }
  if (typeof value.toJSON === "function") {
    return value;
  }
  if (ancestorSet.has(value)) {
    return Object.hasOwn(value, SYMBOL_IDENTITY)
      ? value[SYMBOL_IDENTITY]
      : null;
  }
  return serializeItem(value, ancestorSet);
};
