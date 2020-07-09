const JSENV_LOG_ENABLED = false

export const jsenvLogger = {
  log: (...args) => {
    // prevent logs for now (do not mess with user logs)
    if (JSENV_LOG_ENABLED) {
      console.log(...prefixArgs(...args))
    }
  },

  debug: (...args) => {
    if (JSENV_LOG_ENABLED) {
      console.log(...prefixArgs(...args))
    }
  },
}

// a nice yellow:ffdc00
const backgroundColor = "#F7931E" // jsenv logo color

// eslint-disable-next-line no-unused-vars
const prefixArgs = (...args) => {
  return [
    `%cjsenv`,
    `background: ${backgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ]
}
