import { paramsFromParentWindow } from "./parent_window_context.js";

const logLevel = paramsFromParentWindow.logLevel;

export const logger = {
  info: (...args) => {
    if (logLevel === "warn" || logLevel === "info" || logLevel === "debug") {
      console.info(...prefixArgs(...args));
    }
  },

  debug: (...args) => {
    if (logLevel === "debug") {
      console.debug(...prefixArgs(...args));
    }
  },
};

// a nice yellow:ffdc00
const backgroundColor = "#F7931E"; // jsenv logo color

const prefixArgs = (...args) => {
  return [
    `%cjsenv`,
    `background: ${backgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ];
};
