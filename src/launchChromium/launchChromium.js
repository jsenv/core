// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { URL } from "url"
import puppeteer from "puppeteer"
import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import { startIndexServer } from "../server-index/startIndexServer.js"
import { originAsString } from "../server/index.js"
import { getBrowserPlatformRemoteURL } from "../platform/browser/remoteURL.js"
import { regexpEscape } from "../stringHelper.js"

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  remoteRoot,
  compileInto,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  startIndexRequestHandler = startIndexServer,
  headless = true,
  generateHTML = ({ browserPlatformRemoteURL }) => {
    return `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${browserPlatformRemoteURL}"></script>
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
    // handleSIGINT: true,
    // handleSIGTERM: true,
    // handleSIGHUP: true,
    // because the 3 above are true by default pupeeter will auto close browser
    // so we apparently don't have to use listenNodeBeforeExit in order to close browser
    // as we do for server
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

  let stopIndexServer = () => {}
  const browserOperation = createStoppableOperation({
    cancellationToken,
    start: () => puppeteer.launch(options),
    stop: async (browser, reason) => {
      const targetTracker = createTargetTracker(browser)

      await Promise.all([targetTracker.stop(reason), stopIndexServer(reason)])
      await browser.close()
    },
  })
  const { stop } = browserOperation
  const browser = await browserOperation

  const registerDisconnectCallback = (callback) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", callback)
  }

  const emitError = (error) => {
    errorCallbackArray.forEach((callback) => {
      callback(error)
    })
  }

  const trackPage = (browser) => {
    browser.on("targetcreated", async (target) => {
      const type = target.type()
      if (type === "browser") {
        const childBrowser = target.browser()
        trackPage(childBrowser)
      }

      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
      if (type === "page") {
        const page = await target.page()
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
        page.on("error", emitError)
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
        page.on("pageerror", emitError)

        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
        page.on("console", (message) => {
          // there is also message._args
          // which is an array of JSHandle{ _context, _client _remoteObject }

          consoleCallbackArray.forEach(async (callback) => {
            const type = message.type()
            const text = message.text()
            // https://github.com/GoogleChrome/puppeteer/issues/3397#issuecomment-434970058
            // https://github.com/GoogleChrome/puppeteer/issues/2083
            if (text === "JSHandle@error") {
              const errorHandle = message._args[0]
              const stack = await errorHandle.executionContext().evaluate((value) => {
                if (value instanceof Error) {
                  return value.stack
                }
                return value
              }, errorHandle)
              callback({
                type: "error",
                text: appendNewLine(stack),
              })
            } else {
              callback({
                type,
                text: appendNewLine(text),
              })
            }
          })
        })
      }
    })
  }
  trackPage(browser)

  const executeFile = async (file, { collectNamespace, collectCoverage, instrument }) => {
    const [page, html] = await Promise.all([
      browser.newPage(),
      generateHTML({
        remoteRoot,
        compileInto,
        browserPlatformRemoteURL: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }),
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
    stopIndexServer = indexStop

    const execute = async () => {
      await page.goto(indexOrigin)
      return await page.evaluate(
        ({ compileInto, remoteRoot, file, collectNamespace, collectCoverage, instrument }) => {
          return window.__platform__.executeCompiledFile({
            compileInto,
            remoteRoot,
            file,
            collectNamespace,
            collectCoverage,
            instrument,
          })
        },
        { compileInto, remoteRoot, file, collectNamespace, collectCoverage, instrument },
      )
    }
    try {
      const { status, coverageMap, error, namespace } = await execute()
      if (status === "rejected") {
        return {
          status,
          error: errorToLocalError(error, { localRoot, remoteRoot }),
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
    options,
    stop,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const errorToLocalError = (error, { remoteRoot, localRoot }) => {
  // does not truly work
  // error stack should be remapped either client side or here
  // error is correctly remapped inside chrome devtools
  // but the error we receive here is not remapped
  // client side would be better but here could be enough
  const remoteRootRegexp = new RegExp(regexpEscape(remoteRoot), "g")
  error.stack = error.stack.replace(remoteRootRegexp, localRoot)
  error.message = error.message.replace(remoteRootRegexp, localRoot)
  return error
}

const createTargetTracker = (browser) => {
  let stopCallbackArray = []

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
  browser.on("targetcreated", (target) => {
    const type = target.type()
    if (type === "browser") {
      const childBrowser = target.browser()
      const childTargetTracker = createTargetTracker(childBrowser)
      stopCallbackArray = [...stopCallbackArray, (reason) => childTargetTracker.stop(reason)]
    }
    if (type === "page" || type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      stopCallbackArray = [
        ...stopCallbackArray,
        async () => {
          const page = await target.page()
          return page.close()
        },
      ]
      return
    }
  })

  const stop = async (reason) => {
    const callbacks = stopCallbackArray.slice()
    stopCallbackArray.length = 0
    await Promise.all(callbacks.map((callback) => callback(reason)))
  }

  return { stop }
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
