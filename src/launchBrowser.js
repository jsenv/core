// https://github.com/microsoft/playwright/blob/master/docs/api.md

import { createDetailedMessage } from "@jsenv/logger"
import {
  Abort,
  createCallbackListNotifiedOnce,
  createCallbackList,
  raceProcessTeardownEvents,
} from "@jsenv/abort"
import { memoize } from "@jsenv/filesystem"

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
  name: "chromium",
  version: PLAYWRIGHT_CHROMIUM_VERSION,
}
chromiumRuntime.launch = async ({
  signal = new AbortController().signal,
  browserServerLogLevel,
  chromiumExecutablePath,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageIgnorePredicate,
  coverageForceIstanbul,

  headless = true,
  // about debug check https://github.com/microsoft/playwright/blob/master/docs/api.md#browsertypelaunchserveroptions
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false,
}) => {
  const launchBrowserOperation = Abort.startOperation()
  launchBrowserOperation.addAbortSignal(signal)

  const sharingToken = share
    ? chromiumSharing.getSharingToken({
        chromiumExecutablePath,
        headless,
        debug,
        debugPort,
      })
    : chromiumSharing.getUniqueSharingToken()
  if (!sharingToken.isUsed()) {
    const { chromium } = await importPlaywright({ browserName: "chromium" })
    const launchOperation = launchBrowser("chromium", {
      browserClass: chromium,
      launchBrowserOperation,
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

  const [browserPromise, stopUsingBrowser] = sharingToken.useSharedValue()
  launchBrowserOperation.addEndCallback(stopUsingBrowser)
  const browser = await browserPromise

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint()
    const webSocketUrl = new URL(webSocketEndpoint)
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`
    const browserResponse = await fetchUrl(browserEndpoint, {
      signal,
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

  const browserHooks = browserToRuntimeHooks(browser, {
    browserServerLogLevel,

    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    collectPerformance,
    measurePerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable: true,
  })

  return {
    browser,
    ...browserHooks,
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
  name: "firefox",
  version: PLAYWRIGHT_FIREFOX_VERSION,
}
firefoxRuntime.launch = async ({
  signal = new AbortController().signal,
  firefoxExecutablePath,
  browserServerLogLevel,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageIgnorePredicate,
  coverageForceIstanbul,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const launchBrowserOperation = Abort.startOperation()
  launchBrowserOperation.addAbortSignal(signal)

  const sharingToken = share
    ? firefoxSharing.getSharingToken({ firefoxExecutablePath, headless })
    : firefoxSharing.getUniqueSharingToken()
  if (!sharingToken.isUsed()) {
    const { firefox } = await importPlaywright({ browserName: "firefox" })
    const launchOperation = launchBrowser("firefox", {
      browserClass: firefox,

      launchBrowserOperation,
      options: {
        headless,
        executablePath: firefoxExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [browserPromise, stopUsingBrowser] = sharingToken.useSharedValue()
  launchBrowserOperation.addEndCallback(stopUsingBrowser)
  const browser = await browserPromise

  const browserHooks = browserToRuntimeHooks(browser, {
    launchBrowserOperation,
    browserServerLogLevel,

    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    collectPerformance,
    measurePerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
  })

  return {
    browser,
    ...browserHooks,
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
  name: "webkit",
  version: PLAYWRIGHT_WEBKIT_VERSION,
}
webkitRuntime.launch = async ({
  signal = new AbortController().signal,
  browserServerLogLevel,
  webkitExecutablePath,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageIgnorePredicate,
  coverageForceIstanbul,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const launchBrowserOperation = Abort.startOperation()
  launchBrowserOperation.addAbortSignal(signal)

  const sharingToken = share
    ? webkitSharing.getSharingToken({ webkitExecutablePath, headless })
    : webkitSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const { webkit } = await await importPlaywright({ browserName: "webkit" })
    const launchOperation = launchBrowser("webkit", {
      browserClass: webkit,
      launchBrowserOperation,
      options: {
        headless,
        executablePath: webkitExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [browserPromise, stopUsingBrowser] = sharingToken.useSharedValue()
  launchBrowserOperation.addEndCallback(stopUsingBrowser)
  const browser = await browserPromise

  const browserHooks = browserToRuntimeHooks(browser, {
    launchBrowserOperation,
    browserServerLogLevel,

    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    collectPerformance,
    measurePerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    ignoreErrorHook: (error) => {
      // we catch error during execution but safari throw unhandled rejection
      // in a non-deterministic way.
      // I suppose it's due to some race condition to decide if the promise is catched or not
      // for now we'll ignore unhandled rejection on wekbkit
      if (error.name === "Unhandled Promise Rejection") {
        return true
      }
      return false
    },
    transformErrorHook: (error) => {
      // Force error stack to contain the error message
      // because it's not the case on webkit
      error.stack = `${error.message}
  at ${error.stack}`

      return error
    },
  })

  return {
    browser,
    ...browserHooks,
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
  { launchBrowserOperation, browserClass, options, stopOnExit },
) => {
  if (stopOnExit) {
    launchBrowserOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGHUP: true,
          SIGTERM: true,
          SIGINT: true,
          beforeExit: true,
          exit: true,
        },
        abort,
      )
    })
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
    launchBrowserOperation.throwIfAborted()
    return browser
  } catch (e) {
    if (launchBrowserOperation.signal.aborted && isTargetClosedError(e)) {
      // rethrow the abort error
      launchBrowserOperation.throwIfAborted()
    }
    throw e
  } finally {
    await launchBrowserOperation.end()
  }
}

const importPlaywright = async ({ browserName }) => {
  try {
    const namespace = await import("playwright")
    return namespace
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        createDetailedMessage(
          `"playwright" not found. You need playwright in your dependencies when using "${browserName}Runtime"`,
          {
            suggestion: `npm install --save-dev playwright`,
          },
        ),
        { cause: e },
      )
    }
    throw e
  }
}

const stopBrowser = async (browser) => {
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
}

const browserToRuntimeHooks = (
  browser,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    collectPerformance,
    measurePerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable = false,
    ignoreErrorHook = () => false,
    transformErrorHook = (error) => error,
  },
) => {
  const stopCallbackList = createCallbackListNotifiedOnce()
  const stoppedCallbackList = createCallbackListNotifiedOnce()
  const stop = memoize(async (reason) => {
    await stopCallbackList.notify({ reason })
    stoppedCallbackList.notify({ reason })
    return { graceful: false }
  })

  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
  browser.on("disconnected", () => {
    stop()
  })

  stopCallbackList.add(async () => {
    await stopBrowser(browser)
  })

  const errorCallbackList = createCallbackList()

  const outputCallbackList = createCallbackList()

  const execute = async ({
    signal,
    fileRelativeUrl,
    ignoreHTTPSErrors = true, // we mostly use self signed certificates during tests
  }) => {
    const executeOperation = Abort.startOperation()
    executeOperation.addAbortSignal(signal)
    executeOperation.throwIfAborted()
    // open a tab to execute to the file
    const browserContext = await browser.newContext({ ignoreHTTPSErrors })
    executeOperation.throwIfAborted()
    const page = await browserContext.newPage()
    executeOperation.addEndCallback(async () => {
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
        error = transformErrorHook(error)
        if (!ignoreErrorHook(error)) {
          errorCallbackList.notify(error)
        }
      },
      onConsole: outputCallbackList.notify,
    })
    stoppedCallbackList.add(stopTrackingToNotify)

    const result = await executeHtmlFile(fileRelativeUrl, {
      executeOperation,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      page,
      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageForceIstanbul,
      coveragePlaywrightAPIAvailable,
      coverageIgnorePredicate,
      transformErrorHook,
    })
    return result
  }

  return {
    stoppedCallbackList,
    errorCallbackList,
    outputCallbackList,
    execute,
    stop,
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
