export const versionFromValue = (value) => {
  if (typeof value === "number") {
    return numberToVersion(value);
  }
  if (typeof value === "string") {
    return stringToVersion(value);
  }
  throw new TypeError(`version must be a number or a string, got ${value}`);
};

const numberToVersion = (number) => {
  return {
    major: number,
    minor: 0,
    patch: 0,
  };
};

const stringToVersion = (string) => {
  if (string.indexOf(".") > -1) {
    const parts = string.split(".");
    return {
      major: Number(parts[0]),
      minor: parts[1] ? Number(parts[1]) : 0,
      patch: parts[2] ? Number(parts[2]) : 0,
    };
  }

  if (isNaN(string)) {
    return {
      major: 0,
      minor: 0,
      patch: 0,
    };
  }

  return {
    major: Number(string),
    minor: 0,
    patch: 0,
  };
};
