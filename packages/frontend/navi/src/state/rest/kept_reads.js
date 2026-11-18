import { signal } from "@preact/signals";

import { NO_PARAMS } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";

/*
 * What a previous document kept of the page it was on (see keepPageOnScreen in
 * nav/page_kept.js), waiting for the reads that draw it again, and what those
 * reads are made of on the way out: rows with their relations inline.
 *
 * A kept read is found by the read's name and the params it was asked with
 * (getKeptReadKey). It is handed out once: the first run of the read draws it
 * while its request is out, and from then on the store holds the rows. Handed
 * out again, after a reset say, it would write the previous document's rows
 * over a fresher answer.
 *
 * This module is the half the reads see: `resource()` and the range reader
 * take from it and say which of their reads are kept as rows, routeAction takes
 * from it for any other action (through action/kept_values.js). Which reads are
 * on the page on screen, and what the slot is written into, is page_kept.js.
 */

// key → what the read answered in the previous document, not handed out yet
const offeredReadMap = new Map();
export const offerKeptReads = (entryMap) => {
  offeredReadMap.clear();
  for (const [key, entry] of entryMap) {
    offeredReadMap.set(key, entry);
  }
};
export const withdrawKeptReads = () => {
  offeredReadMap.clear();
};
export const takeKeptRead = (key) => {
  const entry = offeredReadMap.get(key);
  if (entry === undefined) {
    return undefined;
  }
  offeredReadMap.delete(key);
  return entry;
};

// The root actions whose answer is rows of a store: a resource's GET and
// GET_MANY. They are kept as rows, since their value (ids) names rows a new
// document's store does not hold. A relationship read is not kept at all (see
// below). Any other route action is kept by its value (see page_kept.js).
const keepableReadWeakSet = new WeakSet();
export const markKeepableRead = (rootAction) => {
  keepableReadWeakSet.add(rootAction);
};
export const isKeepableRead = (action) => {
  const rootAction = action.rootAction || action;
  return keepableReadWeakSet.has(rootAction);
};
// The reads of a relation (`.one()`, `.many()`, `.scopedOne()`,
// `.scopedMany()`): their value is ids into another store under an owner —
// neither plain data a new document can draw, nor rows of their own. Kept by
// value, a new document would read ids naming rows it does not hold, under an
// owner it may not hold yet.
const relationshipReadWeakSet = new WeakSet();
export const markRelationshipRead = (rootAction) => {
  relationshipReadWeakSet.add(rootAction);
};
export const isRelationshipRead = (action) => {
  const rootAction = action.rootAction || action;
  return relationshipReadWeakSet.has(rootAction);
};

// What is kept of a composition moved without an answer: the window a list
// draws went past a step, or the list trimmed ranks it no longer holds. Said
// from the list's render, where no signal may be written, to whoever writes
// the page kept (see page_kept.js), which reads the composition when it next
// writes.
const keptFrameMovedCallbackSet = new Set();
export const noteKeptFrameMoved = () => {
  for (const callback of keptFrameMovedCallbackSet) {
    callback();
  }
};
export const observeKeptFrameMoved = (callback) => {
  keptFrameMovedCallbackSet.add(callback);
  return () => {
    keptFrameMovedCallbackSet.delete(callback);
  };
};

// The range readers a <List.Items> on screen reads through, each with the number
// of lists reading it: the reads of the page a route action does not cover.
export const shownRangeReadersSignal = signal(new Map());
export const showRangeReader = (reader) => {
  const shownMap = new Map(shownRangeReadersSignal.peek());
  shownMap.set(reader, (shownMap.get(reader) || 0) + 1);
  shownRangeReadersSignal.value = shownMap;
  return () => {
    const shownMapNow = new Map(shownRangeReadersSignal.peek());
    const count = shownMapNow.get(reader);
    if (count === 1) {
      shownMapNow.delete(reader);
    } else {
      shownMapNow.set(reader, count - 1);
    }
    shownRangeReadersSignal.value = shownMapNow;
  };
};

// A row already in the store is the fresher one: the kept copy only stands in
// for rows nothing has answered yet. Its relations are written as they were
// kept, which a real answer corrects like any other.
export const upsertKeptItem = (store, keptItem) => {
  const id = keptItem[store.idKey];
  if (id !== undefined) {
    const existing = store.select(id);
    if (existing) {
      return existing;
    }
  }
  return store.upsert(keptItem);
};

export const getKeptReadKey = (name, params) => {
  return `${name}|${getParamsKey(params)}`;
};
// `true` is what a route action without params is bound to (see routeAction),
// and a key holding undefined says nothing a missing one does not.
export const getParamsKey = (params) => {
  if (params === undefined || params === NO_PARAMS || params === true) {
    return "";
  }
  if (isPlainParams(params)) {
    const keys = Object.keys(params).filter((key) => params[key] !== undefined);
    if (keys.length === 0) {
      return "";
    }
  }
  return stableStringify(params);
};
const isPlainParams = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};
const stableStringify = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  const parts = [];
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${stableStringify(value[key])}`);
  }
  return `{${parts.join(",")}}`;
};

// What a read's data is made of, ready to be written: a row, or the rows of a
// list, each with its relations inline.
export const serializeData = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => serializeItem(item, new Set()));
  }
  return serializeItem(data, new Set());
};
// The item with its relations inline: a relation value stands for what its
// signal holds (the child row, the child rows, or nothing), a row reached
// twice on the same path is written as its id — the setters accept both.
export const serializeItem = (item, ancestorSet) => {
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
