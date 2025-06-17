export const getOptionsForActionConnectedToLocalStorageBoolean = (
  key,
  { defaultValue = false } = {},
) => {
  return {
    match: () => {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue;
      }
      return value === "true";
    },
    activationEffect: () => {
      localStorage.setItem(key, "true");
    },
    deactivationEffect: () => {
      if (defaultValue === true) {
        localStorage.setItem(key, "false");
      } else {
        localStorage.removeItem(key);
      }
    },
  };
};
export const getOptionsForActionConnectedToLocalStorageString = (
  key,
  actionParamName = key,
  { defaultValue = "" } = {},
) => {
  return {
    match: () => {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue ? { [actionParamName]: defaultValue } : null;
      }
      return { [actionParamName]: value };
    },
    activationEffect: (params) => {
      const valueToStore = params[actionParamName];
      localStorage.setItem(key, valueToStore);
    },
    deactivationEffect: () => {
      localStorage.removeItem(key);
    },
  };
};
