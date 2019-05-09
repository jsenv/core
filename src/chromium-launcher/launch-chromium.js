// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { uneval } from "@dmail/uneval"
import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import { regexpEscape } from "../stringHelper.js"
import {
  registerProcessInterruptCallback,
  registerUngaranteedProcessTeardown,
} from "../process-signal/index.js"
import { startPuppeteerServer } from "./start-puppeteer-server.js"
import { trackRessources } from "./ressource-tracker.js"
import { trackBrowserTargets } from "./browser-target-tracker.js"
import { trackBrowserPages } from "./browser-page-tracker.js"
import {
  DEFAULT_COMPILE_INTO,
  DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
} from "./launch-chromium-constant.js"

const puppeteer = import.meta.require("puppeteer")

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileServerOrigin,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = DEFAULT_COMPILE_INTO,
  browserClientFolderRelative = DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  verbose = false,
  headless = true,
}) => {
  if (typeof projectFolder !== "string")
    throw new TypeError(`projectFolder must be a string, got ${projectFolder}`)
  if (typeof compileServerOrigin !== "string")
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)

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
      startPuppeteerServer({
        cancellationToken,
        projectFolder,
        importMapFilenameRelative,
        browserClientFolderRelative,
        compileInto,
        verbose,
      }),
    ])
    registerCleanupCallback(chromiumServer.stop)

    const execute = async () => {
      await page.goto(`${chromiumServer.origin}`)
      // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
      // yes evaluate supports passing a function directly
      // but when I do that, istanbul will put coverage statement inside it
      // and I don't want that because function is evaluated client side
      return await page.evaluate(
        createBrowserIIFEString({
          compileServerOrigin,
          filenameRelative,
          collectNamespace,
          collectCoverage,
        }),
      )
    }
    try {
      const { status, coverageMap, error, namespace } = await execute()
      if (status === "rejected") {
        return {
          status,
          error: errorToSourceError(error, { projectFolder, compileServerOrigin }),
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

const errorToSourceError = (error, { projectFolder, compileServerOrigin }) => {
  if (error.code === "MODULE_PARSE_ERROR") return error

  // does not truly work
  // error stack should be remapped either client side or here
  // error is correctly remapped inside chrome devtools
  // but the error we receive here is not remapped
  // client side would be better but here could be enough
  const sourceOrigin = `file://${projectFolder}`
  const remoteRootRegexp = new RegExp(regexpEscape(compileServerOrigin), "g")
  error.stack = error.stack.replace(remoteRootRegexp, sourceOrigin)
  error.message = error.message.replace(remoteRootRegexp, sourceOrigin)
  return error
}

const createBrowserIIFEString = ({
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
}) => `(() => {
  return window.execute({
    compileServerOrigin: ${uneval(compileServerOrigin)},
    filenameRelative: ${uneval(filenameRelative)},
    collectNamespace: ${uneval(collectNamespace)},
    collectCoverage: ${uneval(collectCoverage)}
  })
})()`
