import { trackRessources } from "./ressource-tracker.js"

export const trackBrowserPages = (browser, { onError, onConsole }) => {
  const { registerCleanupCallback, cleanup } = trackRessources()

  const registerEvent = ({ object, eventType, callback }) => {
    object.on(eventType, callback)
    registerCleanupCallback(() => {
      object.removeListener(eventType, callback)
    })
  }

  registerEvent({
    object: browser,
    eventType: "targetcreated",
    callback: async (target) => {
      const type = target.type()
      if (type === "browser") {
        const childBrowser = target.browser()
        const childPageTracker = trackBrowserPages(childBrowser, { onError, onConsole })

        registerCleanupCallback(childPageTracker.stop)
      }

      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
      if (type === "page" || type === "background_page") {
        const page = await target.page()

        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
        registerEvent({
          object: page,
          eventType: "error",
          callback: onError,
        })

        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
        registerEvent({
          object: page,
          eventType: "pageerror",
          callback: onError,
        })

        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
        registerEvent({
          object: page,
          eventType: "console",
          callback: async (message) => {
            // https://github.com/GoogleChrome/puppeteer/issues/3397#issuecomment-434970058
            // https://github.com/GoogleChrome/puppeteer/issues/2083

            const type = message.type()
            // ensure we use a string so that istanbul won't try
            // to put any coverage statement inside it
            // ideally we should use uneval no ?
            // eslint-disable-next-line no-new-func
            const functionEvaluatedBrowserSide = new Function(
              "value",
              `if (value instanceof Error) {
                return value.stack
              }
              return value`,
            )
            const argValues = await Promise.all(
              message.args().map(async (arg) => {
                const jsHandle = arg

                try {
                  return await jsHandle
                    .executionContext()
                    .evaluate(functionEvaluatedBrowserSide, jsHandle)
                } catch (e) {
                  return String(jsHandle)
                }
              }),
            )
            const text = argValues.reduce((previous, value, index) => {
              let string

              if (typeof value === "object") string = JSON.stringify(value, null, "  ")
              else string = String(value)

              if (index === 0) return `${previous}${string}`
              return `${previous} ${string}`
            }, "")

            onConsole({
              type,
              text: appendNewLine(text),
            })
          },
        })
      }
    },
  })

  return { stop: cleanup }
}

const appendNewLine = (string) => `${string}
`
