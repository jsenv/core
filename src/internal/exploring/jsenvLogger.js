export const jsenvLogger = {
  log: () => {
    // prevent logs for now (do not mess with user logs)
    // console.log(...prefixArgs(...args))
  },

  debug: () => {
    // console.log(...prefixArgs(...args))
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
