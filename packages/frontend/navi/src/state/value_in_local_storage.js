export const valueInLocalStorage = (
  key,
  { type = "string", fallback } = {},
) => {
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
      return fallback;
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

    let valueToSet = value;
    let validityMessage = getValidityMessage(valueToSet);

    // If validation fails, try to convert the value
    if (validityMessage && converter) {
      const convertedValue = tryConvertValue(valueToSet, type);
      if (convertedValue !== valueToSet) {
        const convertedValidityMessage = getValidityMessage(convertedValue);
        if (!convertedValidityMessage) {
          // Conversion successful and valid
          valueToSet = convertedValue;
          validityMessage = "";
        }
      }
    }

    if (validityMessage) {
      console.warn(
        `The value to set in localStorage "${key}" is invalid: ${validityMessage}`,
      );
    }

    if (converter && converter.encode) {
      const valueEncoded = converter.encode(valueToSet);
      window.localStorage.setItem(key, valueEncoded);
      return;
    }
    window.localStorage.setItem(key, valueToSet);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
  };

  return [get, set, remove];
};

const tryConvertValue = (value, type) => {
  const validator = typeConverters[type];
  if (!validator) {
    return value;
  }
  if (!validator.cast) {
    return value;
  }
  const fromType = typeof value;
  const castFunction = validator.cast[fromType];
  if (!castFunction) {
    return value;
  }
  const convertedValue = castFunction(value);
  return convertedValue;
};

const createNumberValidator = ({ min, max, step } = {}) => {
  return {
    cast: (value) => {
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && isFinite(parsed)) {
          return parsed;
        }
      }
      return value;
    },
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
      if (min !== undefined && value < min) {
        return min === 0 ? `must be positive` : `must be >= ${min}`;
      }
      if (max !== undefined && value > max) {
        return max === 0 ? `must be negative` : `must be <= ${max}`;
      }
      if (step !== undefined) {
        const remainder = (value - (min || 0)) % step;
        const epsilon = 0.0000001;
        if (remainder > epsilon && step - remainder > epsilon) {
          if (step === 1) {
            return `must be an integer`;
          }
          return `must be a multiple of ${step}`;
        }
      }
      return "";
    },
  };
};
const typeConverters = {
  boolean: {
    cast: {
      string: (value) => {
        if (value === "true") return true;
        if (value === "false") return false;
        return value;
      },
      number: (value) => {
        return Boolean(value);
      },
    },
    checkValidity: (value) => {
      if (typeof value !== "boolean") {
        return `must be a boolean`;
      }
      return "";
    },
    decode: (value) => {
      return value === "true";
    },
    encode: (value) => {
      return value ? "true" : "false";
    },
  },
  string: {
    cast: {
      number: String,
      boolean: String,
    },
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a string`;
      }
      return "";
    },
  },
  number: createNumberValidator(),
  float: createNumberValidator(),
  positive_number: createNumberValidator({ min: 0 }),
  integer: createNumberValidator({ step: 1 }),
  positive_integer: createNumberValidator({ min: 0, step: 1 }),
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
    cast: {
      string: (value) => {
        try {
          return JSON.parse(value);
        } catch {
          // Invalid JSON, can't convert
          return value;
        }
      },
    },
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
