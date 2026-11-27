import { createValidity } from "@jsenv/validity";
import { signal } from "@preact/signals";

import {
  listenLocalStorageKey,
  readLocalStorage,
  writeLocalStorage,
} from "./guarded_local_storage.js";

/**
 * A signal holding the value kept under `key` in localStorage, as a `type`:
 * read at creation, written at each write, and moved by a write from another
 * tab. For a value kept on this device under a key the app builds — a choice
 * per place, a flag a page leaves itself across a redirect. App state the
 * controls and the url read is `stateSignal(default, { id, persists: true })`,
 * which brings its rules, its default and its version.
 *
 * The text kept is read back with the type's rules (@jsenv/validity):
 * `"true"`, `"1"` and `"on"` are a `true` boolean, an object or an array is
 * JSON. A text that does not read as the type reads `undefined`, with a
 * warning. A write that is not the type throws at the writer: kept, it would
 * come back as something else after a reload. `null` and `undefined` remove
 * the key, and the signal then holds `undefined`, as a reload would. Every
 * access is guarded — a refused or full storage keeps the value for the
 * session.
 *
 * @param {string} key
 * @param {object} [options]
 * @param {string} [options.type="string"] A @jsenv/validity type: `"string"`,
 *   `"boolean"`, `"number"`, `"integer"`, `"object"`, `"array"`, `"date"`…
 * @returns {import("@preact/signals").Signal<any>}
 *
 * @example
 * const layoutSignalOf = (place) =>
 *   localStorageSignal(`plan_layout_${place.id}`); // "free" | "locked"
 * const neverAskSignal = localStorageSignal("reach_never", { type: "boolean" });
 * if (!neverAskSignal.peek()) { … }
 */
export const localStorageSignal = (key, { type = "string" } = {}) => {
  // Two readings of one type: the text kept, converted the way the type
  // reads text, and a written value, taken only as the type itself.
  const [textValidity, readText] = createValidity({ type });
  const [writtenValidity, readWritten] = createValidity({
    type,
    typeCoercion: false,
  });
  const decode = (text) => {
    if (text === undefined) {
      return undefined;
    }
    readText(text);
    if (textValidity.valid) {
      return textValidity.value;
    }
    console.warn(
      `localStorageSignal("${key}"): "${text}" does not read as a ${type}, read as undefined.`,
    );
    return undefined;
  };

  const valueSignal = signal(decode(readLocalStorage(key)));
  const signalProto = Object.getPrototypeOf(valueSignal);
  const valueDescriptor = Object.getOwnPropertyDescriptor(signalProto, "value");
  // The write is checked and kept where it is made, so a wrong type throws at
  // its writer. The signal stays a real Signal for Preact (JSX renders it).
  Object.defineProperty(valueSignal, "value", {
    get() {
      return valueDescriptor.get.call(valueSignal);
    },
    set(value) {
      if (value === null || value === undefined) {
        writeLocalStorage(key, undefined);
        valueDescriptor.set.call(valueSignal, undefined);
        return;
      }
      readWritten(value);
      if (!writtenValidity.valid) {
        throw new TypeError(
          `localStorageSignal("${key}") keeps a ${type}, got ${typeof value} ${String(value)}: it would come back as something else after a reload.`,
        );
      }
      writeLocalStorage(
        key,
        writtenValidity.representations.localStorage.value,
      );
      valueDescriptor.set.call(valueSignal, value);
    },
    enumerable: true,
    configurable: true,
  });
  listenLocalStorageKey(key, (text) => {
    valueDescriptor.set.call(valueSignal, decode(text));
  });
  return valueSignal;
};
