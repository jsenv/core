export const valueInLocalStorage = (key, { type = "any" } = {}) => {
  const converter = TYPE_CONVERTERS[type];

  const get = () => {
    let valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return undefined;
    }
    let valueToReturn = valueInLocalStorage;
    if (converter && converter.decode) {
      const valueDecoded = converter.decode(valueInLocalStorage);
      valueToReturn = valueDecoded;
    }
    if (type !== "any" && typeof valueToReturn !== type) {
      console.warn(
        `localStorage "${key}" value is invalid: should be a "${type}", got ${valueInLocalStorage}`,
      );
      return undefined;
    }
    return valueToReturn;
  };

  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    let valueToStore = value;
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(valueToStore);
      valueToStore = valueEncoded;
    }
    window.localStorage.setItem(key, valueToStore);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
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
