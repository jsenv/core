/* eslint-disable import/max-dependencies */
// https://github.com/microsoft/playwright/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@jsenv/cancellation"
import { teardownSignal } from "@jsenv/node-signals"
import { trackRessources } from "./internal/trackRessources.js"
import { require } from "./internal/require.js"
import { fetchUrl } from "./internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "./internal/validateResponseStatusIsOk.js"
import { trackPageToNotify } from "./internal/browser-launcher/trackPageToNotify.js"
import { createSharing } from "./internal/browser-launcher/createSharing.js"
import { startBrowserServer } from "./internal/browser-launcher/startBrowserServer.js"
import { evaluateImportExecution } from "./internal/browser-launcher/evaluateImportExecution.js"

const {
  chromium,
  // firefox, webkit
} = require("playwright")

const chromiumSharing = createSharing()
const executionServerSharing = createSharing()

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  browserServerLogLevel,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  headless = true,
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? chromiumSharing.getSharingToken({ headless, debug, debugPort })
    : chromiumSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser(chromium, {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        ...(debug ? { devtools: true } : {}),
        args: [
          // https://github.com/GoogleChrome/puppeteer/issues/1834
          // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
          // "--disable-dev-shm-usage",
          ...(debug ? [`--remote-debugging-port=${debugPort}`] : []),
        ],
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation, async () => {
      const { stop } = await launchOperation
      await stop()
    })
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint()
    const webSocketUrl = new URL(webSocketEndpoint)
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`
    const browserResponse = await fetchUrl(browserEndpoint, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const { valid, message } = validateResponseStatusIsOk(browserResponse)
    if (!valid) {
      throw new Error(message)
    }

    const browserResponseObject = JSON.parse(browserResponse.body)
    const { webSocketDebuggerUrl } = browserResponseObject
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`)
  }

  return {
    browser,
    name: "chromium",
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteer-api-tip-of-tree
    // https://github.com/GoogleChrome/puppeteer#q-why-doesnt-puppeteer-vxxx-work-with-chromium-vyyy
    // to keep in sync when updating puppeteer
    version: "82.0.4057.0",
    stop: ressourceTracker.cleanup,
    ...browserToPlatformHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,

      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  }
}

export const launchChromiumTab = (namedArgs) => launchChromium({ share: true, ...namedArgs })

// export const launchFirefox = ({
//   cancellationToken = createCancellationToken(),
//   headless = true,
//   debug = false,
//   stopOnExit = true,
// }) => {}

// export const launchWebkit = ({
//   cancellationToken = createCancellationToken(),
//   headless = true,
//   debug = false,
//   debugPort = 9222,
//   stopOnExit = true,
// }) => {}

const launchBrowser = async (
  browserClass,
  { cancellationToken, ressourceTracker, options, stopOnExit },
) => {
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: () =>
      browserClass.launch({
        ...options,
        // let's handle them to close properly browser, remove listener
        // and so on, instead of relying on puppetter
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      }),
    stop: async (browser) => {
      await browser.close()
      if (browser.isConnected()) {
        await new Promise((resolve) => {
          const disconnectedCallback = () => {
            browser.removeListener("disconnected", disconnectedCallback)
            resolve()
          }
          browser.on("disconnected", disconnectedCallback)
        })
      }
    },
  })
  ressourceTracker.registerCleanupCallback(launchOperation.stop)

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback((reason) => {
      launchOperation.stop(`process ${reason}`)
    })
    ressourceTracker.registerCleanupCallback(unregisterProcessTeadown)
  }

  return launchOperation
}

const browserToPlatformHooks = (
  browser,
  {
    cancellationToken,
    ressourceTracker,
    browserServerLogLevel,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
  },
) => {
  const disconnected = new Promise((resolve) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", resolve)
  })

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }

  const executeFile = async (
    fileRelativeUrl,
    {
      htmlFileRelativeUrl,
      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping = true,
      // because we use a self signed certificate
      ignoreHTTPSErrors = true,
    },
  ) => {
    const sharingToken = executionServerSharing.getSharingToken()
    if (!sharingToken.isUsed()) {
      const executionServerPromise = startBrowserServer({
        cancellationToken,
        logLevel: browserServerLogLevel,

        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      })
      sharingToken.setSharedValue(executionServerPromise, async () => {
        const server = await executionServerPromise
        await server.stop()
      })
    }
    const [executionServerPromise, stopUsingExecutionServer] = sharingToken.useSharedValue()
    ressourceTracker.registerCleanupCallback(stopUsingExecutionServer)
    const executionServer = await executionServerPromise

    // open a tab to execute to the file
    const browserContext = await browser.newContext({ ignoreHTTPSErrors })
    const page = await browserContext.newPage()
    ressourceTracker.registerCleanupCallback(async () => {
      await browserContext.close()
    })
    // track tab error and console
    const stopTrackingToNotify = trackPageToNotify(page, {
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
    ressourceTracker.registerCleanupCallback(stopTrackingToNotify)
    // import the file
    return evaluateImportExecution({
      cancellationToken,

      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      htmlFileRelativeUrl,
      fileRelativeUrl,
      compileServerOrigin,
      executionServerOrigin: executionServer.origin,

      page,

      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping,
    })
  }

  return {
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}
