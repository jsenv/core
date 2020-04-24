export const jsenvLogger = {
  log: (...args) => {
    // a nice yellow:ffdc00
    const backgroundColor = "#F7931E" // jsenv logo color

    console.log(
      `%cjsenv`,
      `background: ${backgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
      ...args,
    )
  },
  evaluate: () => {
    throw new Error("cannot evaluate when no file is being executed")
  },
}
