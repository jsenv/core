import { connectAction } from "./actions.js";

export const connectActionWithLocalStorageBoolean = (
  action,
  key,
  { defaultValue = false } = {},
) => {
  connectAction(action, {
    getParams: () => {
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
  });
};
export const connectActionWithLocalStorageString = (
  action,
  key,
  actionParamName = key,
  { defaultValue = "" } = {},
) => {
  connectAction(action, {
    getParams: () => {
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
  });
};
