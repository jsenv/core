/**
 * jsenv/navi - createJsValueWeakMap
 *
 * Key/value cache with true ephemeron behavior and deep equality support.
 *
 * Features:
 * - Mutual retention: key keeps value alive, value keeps key alive
 * - Deep equality: different objects with same content are treated as identical keys
 * - Automatic GC: entries are eligible for collection when unreferenced
 * - Iteration support: can iterate over live entries for deep equality lookup
 *
 * Implementation:
 * - Dual WeakMap (key->value, value->key) provides ephemeron behavior
 * - An object key is found among the keys sharing its buckets, never among
 *   all of them: a bucket names what any key equal to it shares (see
 *   readBucketNames), and only the keys in it are compared in depth. Every
 *   instance of an action would otherwise be compared at every binding of
 *   fresh params — a row binding { id } in a list of thousands.
 * - Buckets hold WeakRefs, so they enable iteration without preventing GC,
 *   and a key leaving takes its bucket entries with it (FinalizationRegistry)
 * - A primitive key cannot be held weakly, so its value is (WeakRef): the
 *   entry lives as long as something else holds the value, and leaves with it
 *   (FinalizationRegistry). Held strongly, every string a field ever sent
 *   would keep the action instance bound to it for the life of the page.
 *
 * Use case: Action caching where params (key) and action (value) should have
 * synchronized lifetimes while allowing natural garbage collection.
 */

import {
  compareTwoJsValues,
  SYMBOL_IDENTITY,
} from "./compare_two_js_values.js";
import { SYMBOL_OBJECT_SIGNAL } from "../action/symbol_object_signal.js";
import { isSignal } from "./is_signal.js";

export const createJsValueWeakMap = () => {
  // Core ephemeron maps for mutual retention
  const keyToValue = new WeakMap(); // key -> value
  const valueToKey = new WeakMap(); // value -> key

  // Bucket name -> Set of WeakRef(key): the keys that may equal one another.
  const bucketMap = new Map();
  // key -> { keyRef, bucketNames }: how to take a key out of its buckets.
  const entryByKey = new WeakMap();
  const removeFromBuckets = ({ keyRef, bucketNames }) => {
    for (const bucketName of bucketNames) {
      const bucket = bucketMap.get(bucketName);
      if (!bucket) {
        continue;
      }
      bucket.delete(keyRef);
      if (bucket.size === 0) {
        bucketMap.delete(bucketName);
      }
    }
  };
  const keyFinalization = new FinalizationRegistry(removeFromBuckets);

  const findEqualKey = (key) => {
    if (keyToValue.has(key)) {
      return key;
    }
    for (const bucketName of readBucketNames(key)) {
      const bucket = bucketMap.get(bucketName);
      if (!bucket) {
        continue;
      }
      for (const keyRef of bucket) {
        const existingKey = keyRef.deref();
        if (existingKey && compareTwoJsValues(existingKey, key)) {
          return existingKey;
        }
      }
    }
    return undefined;
  };
  const removeKey = (existingKey) => {
    const existingValue = keyToValue.get(existingKey);
    keyToValue.delete(existingKey);
    valueToKey.delete(existingValue);
    const entry = entryByKey.get(existingKey);
    if (entry) {
      entryByKey.delete(existingKey);
      keyFinalization.unregister(entry.keyRef);
      removeFromBuckets(entry);
    }
  };

  // Primitive key -> WeakRef(value), or the value itself when it is not an
  // object (nothing to collect).
  const primitiveCache = new Map();
  const primitiveFinalization = new FinalizationRegistry((key) => {
    const entry = primitiveCache.get(key);
    // Set again since: the entry is another value's now.
    if (entry instanceof WeakRef && entry.deref() === undefined) {
      primitiveCache.delete(key);
    }
  });
  const readPrimitiveEntry = (entry) =>
    entry instanceof WeakRef ? entry.deref() : entry;

  const isObjectKey = (key) =>
    key && (typeof key === "object" || typeof key === "function");

  return {
    *[Symbol.iterator]() {
      const keySeen = new Set();
      for (const bucket of bucketMap.values()) {
        for (const keyRef of bucket) {
          const key = keyRef.deref();
          if (!key || keySeen.has(key) || !keyToValue.has(key)) {
            continue;
          }
          keySeen.add(key);
          yield [key, keyToValue.get(key)];
        }
      }
      for (const [k, entry] of primitiveCache) {
        const v = readPrimitiveEntry(entry);
        if (v !== undefined) {
          yield [k, v];
        }
      }
    },

    get(key) {
      if (isObjectKey(key)) {
        const existingKey = findEqualKey(key);
        return existingKey === undefined
          ? undefined
          : keyToValue.get(existingKey);
      }
      return readPrimitiveEntry(primitiveCache.get(key));
    },

    set(key, value) {
      if (isObjectKey(key)) {
        const existingKey = findEqualKey(key);
        if (existingKey !== undefined) {
          removeKey(existingKey);
        }
        keyToValue.set(key, value);
        valueToKey.set(value, key);
        const keyRef = new WeakRef(key);
        const bucketNames = readBucketNames(key);
        for (const bucketName of bucketNames) {
          let bucket = bucketMap.get(bucketName);
          if (!bucket) {
            bucket = new Set();
            bucketMap.set(bucketName, bucket);
          }
          bucket.add(keyRef);
        }
        const entry = { keyRef, bucketNames };
        entryByKey.set(key, entry);
        keyFinalization.register(key, entry, keyRef);
      } else if (isObjectKey(value)) {
        primitiveCache.set(key, new WeakRef(value));
        primitiveFinalization.register(value, key);
      } else {
        primitiveCache.set(key, value);
      }
    },

    delete(key) {
      if (isObjectKey(key)) {
        const existingKey = findEqualKey(key);
        if (existingKey === undefined) {
          return false;
        }
        removeKey(existingKey);
        return true;
      }
      return primitiveCache.delete(key);
    },

    getStats: () => {
      const keySet = new Set();
      for (const bucket of bucketMap.values()) {
        for (const keyRef of bucket) {
          const key = keyRef.deref();
          if (key) {
            keySet.add(key);
          }
        }
      }
      return {
        ephemeronPairs: {
          alive: keySet.size,
          buckets: bucketMap.size,
          note: "True ephemeron: key ↔ value mutual retention via dual WeakMap",
        },
        primitive: {
          total: primitiveCache.size,
          note: "Primitive keys hold their value weakly",
        },
      };
    },
  };
};

// What an object key shares with every key compareTwoJsValues finds equal to
// it, as bucket names — one, or two for a key carrying an identity. Built
// from its top level only, nested values left out ("*"): enough to keep the
// keys of one action apart (each { id } its own bucket), cheap to build at
// every binding. It follows compareTwoJsValues rule by rule:
// - an object carrying its signal equals only another carrying the same one;
// - arrays are equal element by element, in order;
// - two objects sharing a SYMBOL_IDENTITY value are equal whatever they
//   hold, and one holding the same keys and values is equal too: a key with
//   an identity sits in its identity bucket AND in its content bucket;
// - a Date equals a Date of the same time, a signal only itself, an object
//   with nothing enumerable (a Set, an element) only itself;
// - otherwise the same keys holding equal values.
const readBucketNames = (key) => {
  if (typeof key === "function") {
    return [`ref:${readReferenceId(key)}`];
  }
  const objectSignal = key[SYMBOL_OBJECT_SIGNAL];
  if (objectSignal) {
    return [`signal_object:${readReferenceId(objectSignal)}`];
  }
  if (Array.isArray(key)) {
    let name = `array:${key.length}`;
    for (const element of key) {
      name += `,${readValueToken(element)}`;
    }
    return [name];
  }
  const contentBucketName = readContentBucketName(key);
  if (SYMBOL_IDENTITY in key) {
    const identity = key[SYMBOL_IDENTITY];
    return [
      `identity:${typeof identity}:${String(identity)}`,
      contentBucketName,
    ];
  }
  return [contentBucketName];
};
const readContentBucketName = (object) => {
  if (object instanceof Date) {
    return `date:${object.getTime()}`;
  }
  if (isSignal(object)) {
    return `ref:${readReferenceId(object)}`;
  }
  const keys = Object.keys(object);
  if (keys.length === 0) {
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      return `ref:${readReferenceId(object)}`;
    }
    return "object:";
  }
  keys.sort();
  let name = "object:";
  for (const key of keys) {
    name += `${JSON.stringify(key)}=${readValueToken(object[key])},`;
  }
  return name;
};
// One token for every value compareTwoJsValues finds equal at that place,
// "*" for anything compared in depth (or by reference) further down.
const readValueToken = (value) => {
  if (value === undefined || Number.isNaN(value)) {
    // compareTwoJsValues takes undefined and NaN for one another.
    return "u";
  }
  if (value === null) {
    return "null";
  }
  const type = typeof value;
  if (type === "string") {
    return `s${JSON.stringify(value)}`;
  }
  if (type === "number") {
    return `n${value}`;
  }
  if (type === "boolean") {
    return value ? "t" : "f";
  }
  if (type === "bigint") {
    return `i${value}`;
  }
  return "*";
};
const referenceIdMap = new WeakMap();
let referenceIdCount = 0;
const readReferenceId = (object) => {
  let id = referenceIdMap.get(object);
  if (id === undefined) {
    referenceIdCount++;
    id = referenceIdCount;
    referenceIdMap.set(object, id);
  }
  return id;
};
