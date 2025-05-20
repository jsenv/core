export const valueInLocalStorage = (key, { type = "string" } = {}) => {
  const converter = typeConverters[type];
  if (converter === undefined) {
    console.warn(
      `Invalid type "${type}" for "${key}" in local storage, expected one of ${Object.keys(
        typeConverters,
      ).join(", ")}`,
    );
  }

  const get = () => {
    const valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return undefined;
    }
    if (valueInLocalStorage === "undefined") {
      console.warn(
        `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
      );
      return undefined;
    }
    if (converter) {
      const result = converter.decode(valueInLocalStorage);
      if (result === undefined) {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      return result;
    }
    return valueInLocalStorage;
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    const valueToStore = converter ? converter.encode(value) : value;
    window.localStorage.setItem("aside_width", valueToStore);
  };

  return [get, set];
};

const typeConverters = {
  number: {
    encode: (value) => value,
    decode: (value) => {
      const valueParsed = parseFloat(value);
      if (!isFinite(valueParsed)) {
        return undefined;
      }
      return valueParsed;
    },
  },
  percentage: {
    encode: (value) => value,
    decode: (value) => {
      if (!value.endsWith("%")) {
        return undefined;
      }
      const percentageString = value.slice(0, -1);
      const percentageFloat = parseFloat(percentageString);
      if (typeof percentageFloat !== "number") {
        return undefined;
      }
      if (percentageFloat < 0 || percentageFloat > 100) {
        return undefined;
      }
      return value;
    },
  },
  string: {
    encode: (value) => value,
    decode: (value) => value,
  },
};
