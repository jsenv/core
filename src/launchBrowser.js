/* eslint-disable import/max-dependencies */
// https://github.com/microsoft/playwright/blob/master/docs/api.md

import {
  createCancellationToken,
  createStoppableOperation,
} from "@jsenv/cancellation"
import { createDetailedMessage } from "@jsenv/logger"
import { teardownSignal } from "@jsenv/node-signals"

import { trackRessources } from "./internal/trackRessources.js"
import { fetchUrl } from "./internal/fetchUrl.js"
import { validateResponse } from "./internal/response_validation.js"
import { trackPageToNotify } from "./internal/browser-launcher/trackPageToNotify.js"
import { createSharing } from "./internal/browser-launcher/createSharing.js"
import { executeHtmlFile } from "./internal/browser-launcher/executeHtmlFile.js"
import {
  PLAYWRIGHT_CHROMIUM_VERSION,
  PLAYWRIGHT_FIREFOX_VERSION,
  PLAYWRIGHT_WEBKIT_VERSION,
} from "./playwright_browser_versions.js"

const chromiumSharing = createSharing()
export const chromiumRuntime = {
  runtimeName: "chromium",
  runtimeVersion: PLAYWRIGHT_CHROMIUM_VERSION,
}
chromiumRuntime.launch = async ({
  browserServerLogLevel,
  cancellationToken = createCancellationToken(),
  chromiumExecutablePath,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageConfig,
  coverageForceIstanbul,

  headless = true,
  // about debug check https://github.com/microsoft/playwright/blob/master/docs/api.md#browsertypelaunchserveroptions
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? chromiumSharing.getSharingToken({
        chromiumExecutablePath,
        headless,
        debug,
        debugPort,
      })
    : chromiumSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const { chromium } = await import("playwright")

    const launchOperation = launchBrowser("chromium", {
      browserClass: chromium,
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: chromiumExecutablePath,
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
    sharingToken.setSharedValue(launchOperation)
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
    const { isValid, message, details } = await validateResponse(
      browserResponse,
    )
    if (!isValid) {
      throw new Error(createDetailedMessage(message, details))
    }

    const browserResponseObject = JSON.parse(browserResponse.body)
    const { webSocketDebuggerUrl } = browserResponseObject
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`)
  }

  return {
    browser,
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      browserServerLogLevel,
      cancellationToken,
      ressourceTracker,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,
      coverageForceIstanbul,
      coveragePlaywrightAPIAvailable: true,
    }),
  }
}
export const chromiumTabRuntime = {
  ...chromiumRuntime,
  launch: (params) =>
    chromiumRuntime.launch({
      shared: true,
      ...params,
    }),
}

const firefoxSharing = createSharing()
export const firefoxRuntime = {
  runtimeName: "firefox",
  runtimeVersion: PLAYWRIGHT_FIREFOX_VERSION,
}
firefoxRuntime.launch = async ({
  cancellationToken = createCancellationToken(),
  firefoxExecutablePath,
  browserServerLogLevel,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageConfig,
  coverageForceIstanbul,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? firefoxSharing.getSharingToken({ firefoxExecutablePath, headless })
    : firefoxSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const { firefox } = await import("playwright")
    const launchOperation = launchBrowser("firefox", {
      browserClass: firefox,
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: firefoxExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  return {
    browser,
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      browserServerLogLevel,
      cancellationToken,
      ressourceTracker,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      collectPerformance,
      measurePerformance,
      collectCoverage,
      coverageConfig,
      coverageForceIstanbul,
    }),
  }
}
export const firefoxTabRuntime = {
  ...firefoxRuntime,
  launch: (params) =>
    firefoxRuntime.launch({
      shared: true,
      ...params,
    }),
}

const webkitSharing = createSharing()
export const webkitRuntime = {
  runtimeName: "webkit",
  runtimeVersion: PLAYWRIGHT_WEBKIT_VERSION,
}
webkitRuntime.launch = async ({
  browserServerLogLevel,
  cancellationToken = createCancellationToken(),
  webkitExecutablePath,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageConfig,
  coverageForceIstanbul,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? webkitSharing.getSharingToken({ webkitExecutablePath, headless })
    : webkitSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const { webkit } = await import("playwright")
    const launchOperation = launchBrowser("webkit", {
      browserClass: webkit,
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: webkitExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  return {
    browser,

    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      browserServerLogLevel,
      cancellationToken,
      ressourceTracker,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      collectPerformance,
      measurePerformance,
      collectCoverage,
      coverageConfig,
      coverageForceIstanbul,
    }),
  }
}
export const webkitTabRuntime = {
  ...webkitRuntime,
  launch: (params) =>
    webkitRuntime.launch({
      shared: true,
      ...params,
    }),
}

const launchBrowser = async (
  browserName,
  { cancellationToken, browserClass, ressourceTracker, options, stopOnExit },
) => {
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      if (stopOnExit) {
        const unregisterProcessTeardown = teardownSignal.addCallback(
          (reason) => {
            unregisterProcessTeardown()
            launchOperation.stop(`process ${reason}`)
          },
        )
        ressourceTracker.registerCleanupCallback(unregisterProcessTeardown)
        cancellationToken.register(unregisterProcessTeardown)
      }

      try {
        const browser = await browserClass.launch({
          ...options,
          // let's handle them to close properly browser + remove listener
          // instead of relying on playwright to do so
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        })
        return browser
      } catch (e) {
        if (cancellationToken.cancellationRequested && isTargetClosedError(e)) {
          return e
        }
        throw e
      }
    },
    stop: async (browser) => {
      const disconnected = browser.isConnected()
        ? new Promise((resolve) => {
            const disconnectedCallback = () => {
              browser.removeListener("disconnected", disconnectedCallback)
              resolve()
            }
            browser.on("disconnected", disconnectedCallback)
          })
        : Promise.resolve()

      // for some reason without this 100ms timeout
      // browser.close() never resolves (playwright does not like something)
      await new Promise((resolve) => setTimeout(resolve, 100))

      await browser.close()
      await disconnected
    },
  })
  ressourceTracker.registerCleanupCallback(launchOperation.stop)

  return launchOperation
}

const browserToRuntimeHooks = (
  browser,
  {
    cancellationToken,
    ressourceTracker,

    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    collectPerformance,
    measurePerformance,
    collectCoverage,
    coverageConfig,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable = false,
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

  const execute = async ({
    fileRelativeUrl,
    // because we use a self signed certificate
    ignoreHTTPSErrors = true,
  }) => {
    // open a tab to execute to the file
    const browserContext = await browser.newContext({ ignoreHTTPSErrors })
    const page = await browserContext.newPage()
    ressourceTracker.registerCleanupCallback(async () => {
      try {
        await browserContext.close()
      } catch (e) {
        if (isTargetClosedError(e)) {
          return
        }
        throw e
      }
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
    return executeHtmlFile(fileRelativeUrl, {
      cancellationToken,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      page,
      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,
      coverageForceIstanbul,
      coveragePlaywrightAPIAvailable,
    })
  }

  return {
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    execute,
  }
}

const isTargetClosedError = (error) => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true
  }
  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true
  }
  if (error.message.includes("browserContext.close: Browser closed")) {
    return true
  }
  return false
}
