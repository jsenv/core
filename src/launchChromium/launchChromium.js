// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { URL } from "url"
import {
  createCancellationToken,
  createStoppableOperation,
} from "/node_modules/@dmail/cancellation/index.js"
import { startIndexServer } from "../server-index/startIndexServer.js"
import { originAsString } from "../server/index.js"
import { regexpEscape } from "../stringHelper.js"
import {
  registerProcessInterruptCallback,
  registerUngaranteedProcessTeardown,
} from "../process-signal/index.js"

const puppeteer = import.meta.require("puppeteer")

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  compileInto,
  sourceOrigin,
  compileServerOrigin,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  startIndexRequestHandler = startIndexServer,
  headless = true,
  generateHTML = ({ filenameRelative, systemScriptSrc }) => {
    return `<!doctype html>

<head>
  <title>Execute ${filenameRelative}</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${systemScriptSrc}"></script>
</body>

</html>`
  },
}) => {
  if (startIndexRequestHandler === startIndexRequestInterception && headless === false) {
    throw new Error(`startIndexRequestInterception work only in headless mode`)
  }

  const options = {
    headless,
    // because we use a self signed certificate
    ignoreHTTPSErrors: true,
    args: [
      // https://github.com/GoogleChrome/puppeteer/issues/1834
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
      // "--disable-dev-shm-usage",
    ],
  }

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }

  const { registerCleanupCallback, cleanup } = createTracker()

  const browserOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const browser = await puppeteer.launch({
        ...options,
        // let's handle them to close properly browser, remove listener
        // and so on, instead of relying on puppetter
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      })

      const targetTracker = createTargetTracker(browser)
      registerCleanupCallback(targetTracker.stop)

      const pageTracker = createPageTracker(browser, {
        onError: (error) => {
          errorCallbackArray.forEach((callback) => {
            callback(error)
          })
        },
        onConsole: ({ type, text }) => {
          consoleCallbackArray.forEach((callback) => {
            callback({ type, text })
          })
        },
      })
      registerCleanupCallback(pageTracker.stop)

      return browser
    },
    stop: async (browser, reason) => {
      await cleanup(reason)

      const disconnectedPromise = new Promise((resolve) => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback)
          resolve()
        }
        browser.on("disconnected", disconnectedCallback)
      })
      await browser.close()
      await disconnectedPromise
    },
  })
  const { stop } = browserOperation

  const stopOnExit = true
  if (stopOnExit) {
    const unregisterProcessTeadown = registerUngaranteedProcessTeardown((reason) => {
      stop(`process ${reason}`)
    })
    registerCleanupCallback(unregisterProcessTeadown)
  }
  const stopOnSIGINT = true
  if (stopOnSIGINT) {
    const unregisterProcessInterrupt = registerProcessInterruptCallback(() => {
      stop("process sigint")
    })
    registerCleanupCallback(unregisterProcessInterrupt)
  }

  const browser = await browserOperation

  const registerDisconnectCallback = (callback) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", callback)

    registerCleanupCallback(() => {
      browser.removeListener("disconnected", callback)
    })
  }

  const executeFile = async (filenameRelative, { collectNamespace, collectCoverage }) => {
    const [page, html] = await Promise.all([
      browser.newPage(),
      generateHTML({
        filenameRelative,
        systemScriptSrc: `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/system.js`,
      }),
    ])

    const { origin: indexOrigin, stop: indexStop } = await startIndexRequestHandler({
      cancellationToken,
      protocol,
      ip,
      port,
      page,
      body: html,
    })
    registerCleanupCallback(indexStop)

    const execute = async () => {
      await page.goto(indexOrigin)
      return await page.evaluate(
        ({
          compileInto,
          compileServerOrigin,
          filenameRelative,
          collectNamespace,
          collectCoverage,
          browserClientHref,
        }) => {
          return window.System.import(browserClientHref).then(({ executeCompiledFile }) => {
            return executeCompiledFile({
              compileInto,
              compileServerOrigin,
              filenameRelative,
              collectNamespace,
              collectCoverage,
            })
          })
        },
        {
          compileInto,
          compileServerOrigin,
          filenameRelative,
          collectNamespace,
          collectCoverage,
          browserClientHref: `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/browserClient.js`,
        },
      )
    }
    try {
      const { status, coverageMap, error, namespace } = await execute()
      if (status === "rejected") {
        return {
          status,
          error: errorToSourceError(error, { sourceOrigin, compileServerOrigin }),
          coverageMap,
        }
      }
      return {
        status,
        coverageMap,
        namespace,
      }
    } catch (e) {
      // if browser is closed due to cancellation
      // before it is able to finish evaluate we can safely ignore
      // and rethrow with current cancelError
      if (
        e.message === "Protocol error (Runtime.callFunctionOn): Target closed." &&
        cancellationToken.cancellationRequested
      ) {
        cancellationToken.throwIfRequested()
      }
      throw e
    }
  }

  return {
    name: "chromium",
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteer-api-tip-of-tree
    // https://github.com/GoogleChrome/puppeteer#q-why-doesnt-puppeteer-vxxx-work-with-chromium-vyyy
    version: "73.0.3679.0", // to keep in sync when updating puppeteer
    options,
    stop,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const createTracker = () => {
  const callbackArray = []

  const registerCleanupCallback = (callback) => {
    if (typeof callback !== "function")
      throw new TypeError(`callback must be a function
callback: ${callback}`)
    callbackArray.push(callback)
  }

  const cleanup = async (reason) => {
    const localCallbackArray = callbackArray.slice()
    await Promise.all(localCallbackArray.map((callback) => callback(reason)))
  }

  return { registerCleanupCallback, cleanup }
}

const errorToSourceError = (error, { sourceOrigin, compileServerOrigin }) => {
  if (error.code === "MODULE_PARSE_ERROR") return error

  // does not truly work
  // error stack should be remapped either client side or here
  // error is correctly remapped inside chrome devtools
  // but the error we receive here is not remapped
  // client side would be better but here could be enough
  const remoteRootRegexp = new RegExp(regexpEscape(compileServerOrigin), "g")
  error.stack = error.stack.replace(remoteRootRegexp, sourceOrigin)
  error.message = error.message.replace(remoteRootRegexp, sourceOrigin)
  return error
}

const createPageTracker = (browser, { onError, onConsole }) => {
  const { registerCleanupCallback, cleanup } = createTracker()

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
        const childPageTracker = createPageTracker(childBrowser, { onError, onConsole })

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
              const stack = await errorHandle.executionContext().evaluate((value) => {
                if (value instanceof Error) {
                  return value.stack
                }
                return value
              }, errorHandle)
              onConsole({
                type: "error",
                text: appendNewLine(stack),
              })
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

const createTargetTracker = (browser) => {
  const { registerCleanupCallback, cleanup } = createTracker()

  const targetcreatedCallback = (target) => {
    const type = target.type()

    if (type === "browser") {
      const childBrowser = target.browser()
      const childTargetTracker = createTargetTracker(childBrowser)
      registerCleanupCallback(childTargetTracker.stop)
    }

    if (type === "page" || type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      registerCleanupCallback(async () => {
        const page = await target.page()
        return page.close()
      })
    }
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
  browser.on("targetcreated", targetcreatedCallback)
  registerCleanupCallback(() => {
    browser.removeListener("targetcreated", targetcreatedCallback)
  })

  return { stop: cleanup }
}

const startIndexRequestInterception = async ({
  cancellationToken,
  protocol,
  ip,
  port,
  page,
  body,
}) => {
  const origin = originAsString({ protocol, ip, port })

  const interceptionOperation = createStoppableOperation({
    cancellationToken,
    start: () => page.setRequestInterception(true),
    stop: () => page.setRequestInterception(false),
  })
  await interceptionOperation

  page.on("request", (interceptedRequest) => {
    const url = new URL(interceptedRequest.url())
    if (url.origin !== origin) return

    interceptedRequest.respond({
      status: 200,
      contentType: "text/html",
      headers: {
        "content-type": "text/html",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
      },
      body,
    })
  })

  const stop = interceptionOperation.stop

  return {
    origin,
    stop,
  }
}

const appendNewLine = (string) => {
  return `${string}
`
}
