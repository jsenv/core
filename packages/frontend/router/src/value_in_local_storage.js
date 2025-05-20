export const valueInLocalStorage = (key, { type = "string" } = {}) => {
  const converter = typeConverters[type];
  if (converter === undefined) {
    console.warn(
      `Invalid type "${type}" for "${key}" in local storage, expected one of ${Object.keys(
        typeConverters,
      ).join(", ")}`,
    );
  }
  const getValidityMessage = (value) => {
    if (!converter) {
      return "";
    }
    if (!converter.checkValidity) {
      return "";
    }
    const checkValidityResult = converter.checkValidity(value);
    if (checkValidityResult === false) {
      return value;
    }
    if (!checkValidityResult) {
      return "";
    }
    return checkValidityResult;
  };

  const get = () => {
    const valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return undefined;
    }
    const validityMessage = getValidityMessage(valueInLocalStorage);
    if (validityMessage) {
      console.warn(
        `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
      );
      return undefined;
    }
    if (converter) {
      if (converter.checkValidity) {
        const validity = converter.checkValidity(valueInLocalStorage);
        if (!validity) {
        }
      }
      if (converter.decode) {
        const valueDecoded = converter.decode(valueInLocalStorage);
        return valueDecoded;
      }
      return valueInLocalStorage;
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
    if (converter) {
      if (converter.encode) {
        const valueEncoded = converter.encode(value);
        window.localStorage.setItem(key, valueEncoded);
        return;
      }
    }
    window.localStorage.setItem(key, value);
  };

  return [get, set];
};

const typeConverters = {
  number: {
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number, got ${value}`;
      }
      return "";
    },
    decode: (value) => {
      const valueParsed = parseFloat(value);
      if (!isFinite(valueParsed)) {
        return undefined;
      }
      return valueParsed;
    },
  },
  percentage: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a percentage, got ${value}`;
      }
      if (!value.endsWith("%")) {
        return `must end with %, got ${value}`;
      }
      const percentageString = value.slice(0, -1);
      const percentageFloat = parseFloat(percentageString);
      if (typeof percentageFloat !== "number") {
        return `must be a percentage, got ${value}`;
      }
      if (percentageFloat < 0 || percentageFloat > 100) {
        return `must be between 0 and 100, got ${value}`;
      }
      return "";
    },
  },
  string: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a string, got ${value}`;
      }
      return "";
    },
    encode: (value) => value,
    decode: (value) => value,
  },
};
