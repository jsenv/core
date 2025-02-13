let logLevel = "warn";
let logBackgroundColor = "green";
let logColor = "black";

export const pwaLogger = {
  setOptions: (options) => {
    logLevel = options.logLevel || logLevel;
    logBackgroundColor = options.logBackgroundColor || logBackgroundColor;
    logColor = options.logColor || logColor;
  },

  debug: (...args) => {
    if (logLevel === "debug") {
      console.debug(...injectLogStyles(args));
    }
  },
  info: (...args) => {
    if (logLevel === "debug" || logLevel === "info") {
      console.info(...injectLogStyles(args));
    }
  },
  warn: (...args) => {
    if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
      console.warn(...injectLogStyles(args));
    }
  },
  error: (...args) => {
    if (
      logLevel === "debug" ||
      logLevel === "info" ||
      logLevel === "warn" ||
      logLevel === "error"
    ) {
      console.error(...injectLogStyles(args));
    }
  },
  infoGroupCollapsed: (...args) => {
    if (logLevel === "debug" || logLevel === "info") {
      console.group(...injectLogStyles(args));
    }
  },
  debugGroupCollapsed: (...args) => {
    if (logLevel === "debug") {
      console.group(...injectLogStyles(args));
    }
  },

  groupEnd: () => console.groupEnd(),
};

const injectLogStyles = (args) => {
  return [
    `%cjsenv%cpwa`,
    `background: orange; color: rgb(55, 7, 7); padding: 1px 3px; margin: 0 1px`,
    `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ];
};
