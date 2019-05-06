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

            // there is also message._args
            // which is an array of JSHandle{ _context, _client _remoteObject }
            const type = message.type()
            const text = message.text()
            if (text === "JSHandle@error") {
              const errorHandle = message._args[0]

              try {
                // ensure we use a string so that istanbul won't try
                // to put any coverage statement inside it
                // eslint-disable-next-line no-new-func
                const fn = new Function(
                  "value",
                  `if (value instanceof Error) {
                  return value.stack
                }
                return value`,
                )
                const stack = await errorHandle.executionContext().evaluate(fn, errorHandle)
                onConsole({
                  type: "error",
                  text: appendNewLine(stack),
                })
              } catch (e) {
                onConsole({
                  type: "error",
                  text: String(errorHandle),
                })
              }
            } else {
              onConsole({
                type,
                text: appendNewLine(text),
              })
            }
          },
        })
      }
    },
  })

  return { stop: cleanup }
}

const appendNewLine = (string) => `${string}
`
