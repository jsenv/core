// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import { uneval } from "@dmail/uneval"
import { regexpEscape } from "../stringHelper.js"
import {
  registerProcessInterruptCallback,
  registerUngaranteedProcessTeardown,
} from "../process-signal/index.js"
import { startChromiumServer } from "./start-chromium-server.js"
import { trackRessources } from "./ressource-tracker.js"
import { trackBrowserTargets } from "./browser-target-tracker.js"
import { trackBrowserPages } from "./browser-page-tracker.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"

const puppeteer = import.meta.require("puppeteer")

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  compileInto,
  sourceOrigin,
  compileServerOrigin,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  headless = true,
}) => {
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

  const { registerCleanupCallback, cleanup } = trackRessources()

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

      const targetTracker = trackBrowserTargets(browser)
      registerCleanupCallback(targetTracker.stop)

      const pageTracker = trackBrowserPages(browser, {
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
    const [page, chromiumServer] = await Promise.all([
      browser.newPage(),
      startChromiumServer({
        cancellationToken,
        protocol,
        ip,
        port,
        page,
      }),
    ])
    registerCleanupCallback(chromiumServer.stop)

    const execute = async () => {
      await page.goto(`${chromiumServer.origin}/${filenameRelative}`)
      const IIFEString = createClientIIFEString({
        compileInto,
        compileServerOrigin,
        filenameRelative,
        collectNamespace,
        collectCoverage,
      })
      // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
      // yes evaluate supports passing a function directly
      // but when I do that, istanbul will put coverage statement inside it
      // and I don't want that because function is evaluated client side
      return await page.evaluate(IIFEString)
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
        e.message.match(/^Protocol error \(Runtime.[\w]+\): Target closed.$/) &&
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

const createClientIIFEString = ({
  compileInto,
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
}) => `(() => {
  return window.System.import(${uneval(
    `${compileServerOrigin}${WELL_KNOWN_BROWSER_PLATFORM_PATHNAME}`,
  )}).then(({ executeCompiledFile }) => {
    return executeCompiledFile({
      compileInto: ${uneval(compileInto)},
      compileServerOrigin: ${uneval(compileServerOrigin)},
      filenameRelative: ${uneval(filenameRelative)},
      collectNamespace: ${uneval(collectNamespace)},
      collectCoverage: ${uneval(collectCoverage)},
    })
  })
})()`
