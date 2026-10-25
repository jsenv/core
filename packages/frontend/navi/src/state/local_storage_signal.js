import { effect, signal } from "@preact/signals";

import {
  readLocalStorage,
  writeLocalStorage,
} from "./guarded_local_storage.js";

/**
 * A signal holding the STRING kept under `key` in localStorage: read once at
 * creation, written back on every change. `null` and `undefined` remove the
 * key. Anything else than a string throws: storage keeps text only, so a
 * number would come back as `"3"` after a reload and an object as
 * `"[object Object]"`. Every access is guarded — a refused or full storage
 * keeps the value for the session.
 *
 * For state the app reads and binds — typed, validated, versioned — prefer
 * `stateSignal(default, { id, type, persists: true, version })`.
 *
 * @param {string} key
 * @returns {import("@preact/signals").Signal<string | null | undefined>}
 */
export const localStorageSignal = (key) => {
  const valueSignal = signal(readLocalStorage(key));
  effect(() => {
    const value = valueSignal.value;
    if (value === null || value === undefined) {
      // Storage keeps strings: a null written as is would come back as "null".
      writeLocalStorage(key, undefined);
      return;
    }
    if (typeof value !== "string") {
      throw new TypeError(
        `localStorageSignal("${key}") keeps a string, got ${typeof value} ${String(value)}: it would come back as a string after a reload. Use stateSignal({ id, type, persists: true }) for a typed value.`,
      );
    }
    writeLocalStorage(key, value);
  });

  return valueSignal;
};
