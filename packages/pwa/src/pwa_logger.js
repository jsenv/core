let logLevel = "warn"
let logBackgroundColor = "green"
let logColor = "black"

export const pwaLogger = {
  setOptions: (options) => {
    logLevel = options.logLevel || logLevel
    logBackgroundColor = options.logBackgroundColor || logBackgroundColor
    logColor = options.logColor || logColor
  },

  debug: (...args) => {
    if (logLevel === "debug") {
      console.info(...injectLogStyles(args))
    }
  },
  info: (...args) => {
    if (logLevel === "debug" || logLevel === "info") {
      console.info(...injectLogStyles(args))
    }
  },
  warn: (...args) => {
    if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
      console.info(...injectLogStyles(args))
    }
  },
  error: (...args) => {
    if (
      logLevel === "debug" ||
      logLevel === "info" ||
      logLevel === "warn" ||
      logLevel === "error"
    ) {
      console.info(...injectLogStyles(args))
    }
  },
  debugGroupCollapsed: (...args) => {
    if (logLevel === "debug") {
      console.group(...injectLogStyles(args))
    }
  },

  groupEnd: () => console.groupEnd(),
}

const injectLogStyles = (args) => {
  return [
    `%cjsenv %cpwa`,
    `background: orange; color: white; padding: 1px 3px; margin: 0 1px`,
    `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ]
}
