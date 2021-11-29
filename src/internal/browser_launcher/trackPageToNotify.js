export const trackPageToNotify = (page, { onError, onConsole }) => {
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
  const removeErrorListener = registerEvent({
    object: page,
    eventType: "error",
    callback: onError,
  })

  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
  const removePageErrorListener = registerEvent({
    object: page,
    eventType: "pageerror",
    callback: onError,
  })

  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
  const removeConsoleListener = registerEvent({
    object: page,
    eventType: "console",
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
    callback: async (consoleMessage) => {
      onConsole({
        type: consoleMessage.type(),
        text: appendNewLine(extractTextFromConsoleMessage(consoleMessage)),
      })
    },
  })

  return () => {
    removeErrorListener()
    removePageErrorListener()
    removeConsoleListener()
  }
}

const appendNewLine = (string) => `${string}
`

const extractTextFromConsoleMessage = (consoleMessage) => {
  return consoleMessage.text()
  // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
}

const registerEvent = ({ object, eventType, callback }) => {
  object.on(eventType, callback)
  return () => {
    object.removeListener(eventType, callback)
  }
}
