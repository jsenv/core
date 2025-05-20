export const valueInLocalStorage = (key, { type } = {}) => {
  const get = () => {
    const valueInLocalStorage = window.localStorage.getItem(key);

    if (valueInLocalStorage === null) {
      return undefined;
    }
    if (type === "number") {
      if (valueInLocalStorage === "undefined") {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      const valueParsed = JSON.parse(valueInLocalStorage);
      if (!isFinite(valueParsed)) {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      return valueParsed;
    }
    return JSON.parse(valueInLocalStorage);
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem("aside_width", JSON.stringify(value));
  };

  return [get, set];
};
