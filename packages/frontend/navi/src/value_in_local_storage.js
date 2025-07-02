export const valueInLocalStorage = (key, options = {}) => {
  const { type = "string" } = options;
  const converter = typeConverters[type];
  if (converter === undefined) {
    console.warn(
      `Invalid type "${type}" for "${key}" in local storage, expected one of ${Object.keys(
        typeConverters,
      ).join(", ")}`,
    );
  }
  const getValidityMessage = (
    valueToCheck,
    valueInLocalStorage = valueToCheck,
  ) => {
    if (!converter) {
      return "";
    }
    if (!converter.checkValidity) {
      return "";
    }
    const checkValidityResult = converter.checkValidity(valueToCheck);
    if (checkValidityResult === false) {
      return `${valueInLocalStorage}`;
    }
    if (!checkValidityResult) {
      return "";
    }
    return `${checkValidityResult}, got "${valueInLocalStorage}"`;
  };

  const get = () => {
    let valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return Object.hasOwn(options, "default") ? options.default : undefined;
    }
    if (converter && converter.decode) {
      const valueDecoded = converter.decode(valueInLocalStorage);
      const validityMessage = getValidityMessage(
        valueDecoded,
        valueInLocalStorage,
      );
      if (validityMessage) {
        console.warn(
          `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
        );
        return undefined;
      }
      return valueDecoded;
    }
    const validityMessage = getValidityMessage(valueInLocalStorage);
    if (validityMessage) {
      console.warn(
        `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
      );
      return undefined;
    }
    return valueInLocalStorage;
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    const validityMessage = getValidityMessage(value);
    if (validityMessage) {
      console.warn(
        `The value to set in localStorage "${key}" is invalid: ${validityMessage}`,
      );
    }
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(value);
      window.localStorage.setItem(key, valueEncoded);
      return;
    }
    window.localStorage.setItem(key, value);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
  };

  return [get, set, remove];
};

const typeConverters = {
  boolean: {
    checkValidity: (value) => {
      if (typeof value !== "boolean") {
        return `must be a boolean`;
      }
      return "";
    },
    decode: (value) => {
      return value === "true";
    },
  },
  string: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a string`;
      }
      return "";
    },
  },
  number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isFinite(value)) {
        return `must be finite`;
      }
      return "";
    },
  },
  positive_number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  positive_integer: {
    decode: (value) => {
      const valueParsed = parseInt(value, 10);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isInteger(value)) {
        return `must be an integer`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  percentage: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a percentage`;
      }
      if (!value.endsWith("%")) {
        return `must end with %`;
      }
      const percentageString = value.slice(0, -1);
      const percentageFloat = parseFloat(percentageString);
      if (typeof percentageFloat !== "number") {
        return `must be a percentage`;
      }
      if (percentageFloat < 0 || percentageFloat > 100) {
        return `must be between 0 and 100`;
      }
      return "";
    },
  },
  object: {
    decode: (value) => {
      const valueParsed = JSON.parse(value);
      return valueParsed;
    },
    encode: (value) => {
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
    checkValidity: (value) => {
      if (value === null || typeof value !== "object") {
        return `must be an object`;
      }
      return "";
    },
  },
};
