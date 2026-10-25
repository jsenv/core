import {
  readLocalStorage,
  writeLocalStorage,
} from "./guarded_local_storage.js";

/**
 * Reads and writes one value kept under `key` in localStorage, without a
 * signal: `[get, set, remove]`. `get()` reads storage again at each call, so a
 * write from another tab counts; a stored value that does not decode as
 * `type` reads `undefined` (with a console message). `set(undefined)` removes
 * the key. Every access is guarded — a refused or full storage keeps nothing.
 *
 * For state the app reads and binds, prefer
 * `stateSignal(default, { id, type, persists: true, version })`.
 *
 * @param {string} key
 * @param {object} [options]
 * @param {"any"|"boolean"|"number"|"array"|"object"} [options.type="any"] How
 *   the value is written and read back: `"any"`, `"array"` and `"object"` as
 *   JSON, `"boolean"` as `"true"`/`"false"`, `"number"` as its text.
 * @returns {[() => any, (value: any) => void, () => void]}
 */
export const valueInLocalStorage = (key, { type = "any" } = {}) => {
  const converter = TYPE_CONVERTERS[type];

  const get = () => {
    const valueInLocalStorage = readLocalStorage(key);
    if (valueInLocalStorage === undefined) {
      return undefined;
    }
    let valueToReturn = valueInLocalStorage;
    if (converter && converter.decode) {
      try {
        const valueDecoded = converter.decode(valueInLocalStorage);
        valueToReturn = valueDecoded;
      } catch (e) {
        console.error(`Error decoding localStorage "${key}" value:`, e);
        return undefined;
      }
    }
    // typeof answers "object" for an array: the "array" converter checked it.
    if (type !== "any" && type !== "array" && typeof valueToReturn !== type) {
      console.warn(
        `localStorage "${key}" value is invalid: should be a "${type}", got ${valueInLocalStorage}`,
      );
      return undefined;
    }
    return valueToReturn;
  };

  const set = (value) => {
    if (value === undefined) {
      writeLocalStorage(key, undefined);
      return;
    }
    let valueToStore = value;
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(valueToStore);
      valueToStore = valueEncoded;
    }
    writeLocalStorage(key, valueToStore);
  };
  const remove = () => {
    writeLocalStorage(key, undefined);
  };

  return [get, set, remove];
};

const TYPE_CONVERTERS = {
  any: {
    decode: (valueFromLocalStorage) => JSON.parse(valueFromLocalStorage),
    encode: (value) => JSON.stringify(value),
  },
  boolean: {
    decode: (valueFromLocalStorage) => {
      if (
        valueFromLocalStorage === "true" ||
        valueFromLocalStorage === "on" ||
        valueFromLocalStorage === "1"
      ) {
        return true;
      }
      return false;
    },
    encode: (value) => {
      return value ? "true" : "false";
    },
  },
  number: {
    decode: (valueFromLocalStorage) => {
      const valueParsed = parseFloat(valueFromLocalStorage);
      return valueParsed;
    },
  },
  array: {
    decode: (valueFromLocalStorage) => {
      const valueParsed = JSON.parse(valueFromLocalStorage);
      if (!Array.isArray(valueParsed)) {
        throw new Error(`Expected an array, got ${valueParsed}`);
      }
      return valueParsed;
    },
    encode: (value) => {
      if (!Array.isArray(value)) {
        throw new Error(`Expected an array, got ${value}`);
      }
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
  },
  object: {
    decode: (valueFromLocalStorage) => {
      const valueParsed = JSON.parse(valueFromLocalStorage);
      return valueParsed;
    },
    encode: (value) => {
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
  },
};
