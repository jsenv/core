import { trackPageTargets } from "./trackPageTargets.js"

export const trackPageTargetsToNotify = (page, { onError, onConsole, trackOtherPages = false }) => {
  const trackEvents = (page) => {
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
      callback: async (message) => {
        onConsole({
          type: message.type(),
          text: appendNewLine(await extractTextFromPuppeteerMessage(message)),
        })
      },
    })

    return () => {
      removeErrorListener()
      removePageErrorListener()
      removeConsoleListener()
    }
  }

  const stopEventTracking = trackEvents(page)
  if (!trackOtherPages) {
    return stopEventTracking
  }

  const stopPageTracking = trackPageTargets(page, async ({ target, type }) => {
    if (type === "browser") return null

    if (type === "page" || type === "background_page") {
      const page = await target.page()
      return trackEvents(page)
    }

    return null
  })

  return async () => {
    await stopEventTracking()
    await stopPageTracking()
  }
}

const registerEvent = ({ object, eventType, callback }) => {
  object.on(eventType, callback)
  return () => {
    object.removeListener(eventType, callback)
  }
}

const appendNewLine = (string) => `${string}
`

// https://github.com/GoogleChrome/puppeteer/issues/3397#issuecomment-434970058
// https://github.com/GoogleChrome/puppeteer/issues/2083
const extractTextFromPuppeteerMessage = async (message) => {
  return message.text()
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
