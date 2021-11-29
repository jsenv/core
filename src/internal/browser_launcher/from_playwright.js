// https://github.com/microsoft/playwright/blob/master/docs/api.md

import { createDetailedMessage } from "@jsenv/logger"
import {
  Abort,
  createCallbackListNotifiedOnce,
  createCallbackList,
  raceProcessTeardownEvents,
} from "@jsenv/abort"
import { memoize } from "@jsenv/filesystem"

import { trackPageToNotify } from "./trackPageToNotify.js"
import { executeHtmlFile } from "./executeHtmlFile.js"

export const createRuntimeFromPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  ignoreErrorHook = () => false,
  transformErrorHook = (error) => error,
  tab = false,
}) => {
  const runtime = {
    name: browserName,
    version: browserVersion,
  }

  let browserAndContextPromise
  runtime.launch = async ({
    signal = new AbortController().signal,
    executablePath,
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
    ignoreHTTPSErrors = true,
    stopAfterAllExecutionCallbackList,
  }) => {
    const stopCallbackList = createCallbackListNotifiedOnce()
    const stoppedCallbackList = createCallbackListNotifiedOnce()
    const errorCallbackList = createCallbackList()
    const outputCallbackList = createCallbackList()

    const stop = memoize(async (reason) => {
      await stopCallbackList.notify({ reason })
      stoppedCallbackList.notify({ reason })
      return { graceful: false }
    })
    const closeBrowser = async () => {
      const { browser } = await browserAndContextPromise
      browserAndContextPromise = null
      await stopBrowser(browser)
    }

    if (
      !browserAndContextPromise ||
      !tab ||
      !stopAfterAllExecutionCallbackList
    ) {
      browserAndContextPromise = (async () => {
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          stopOnExit,
          playwrightOptions: {
            headless,
            executablePath,
          },
        })
        const browserContext = await browser.newContext({ ignoreHTTPSErrors })
        return { browser, browserContext }
      })()

      // when using chromium tab during multiple executions we reuse the chromium browser
      // and only once all executions are done we close the browser
      if (tab && stopAfterAllExecutionCallbackList) {
        stopAfterAllExecutionCallbackList.add(async () => {
          await closeBrowser()
        })
      } else {
        stopCallbackList.add(async () => {
          await closeBrowser()
        })
      }
    }

    const { browser, browserContext } = await browserAndContextPromise
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", () => {
      stop()
    })

    const page = await browserContext.newPage()
    stoppedCallbackList.add(async () => {
      try {
        await page.close()
      } catch (e) {
        if (isTargetClosedError(e)) {
          return
        }
        throw e
      }
    })
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

    const execute = createExecuteHook({
      page,
      runtime,
      browserServerLogLevel,

      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      collectPerformance,
      measurePerformance,
      collectCoverage,
      coverageIgnorePredicate,
      coverageForceIstanbul,

      coveragePlaywrightAPIAvailable,
      transformErrorHook,
    })

    return {
      stopCallbackList,
      stoppedCallbackList,
      errorCallbackList,
      outputCallbackList,
      execute,
      stop,
    }
  }
  if (!tab) {
    runtime.tab = createRuntimeFromPlaywright({
      browserName,
      browserVersion,
      coveragePlaywrightAPIAvailable,
      ignoreErrorHook,
      transformErrorHook,
      tab: true,
    })
  }
  return runtime
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

  try {
    await browser.close()
  } catch (e) {
    if (isTargetClosedError(e)) {
      return
    }
    throw e
  }
  await disconnected
}

const launchBrowserUsingPlaywright = async ({
  signal,
  browserName,
  stopOnExit,
  playwrightOptions,
}) => {
  const launchBrowserOperation = Abort.startOperation()
  launchBrowserOperation.addAbortSignal(signal)
  const playwright = await importPlaywright({ browserName })
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

  const browserClass = playwright[browserName]
  try {
    const browser = await browserClass.launch({
      ...playwrightOptions,
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

const createExecuteHook = ({
  page,
  runtime,
  projectDirectoryUrl,
  compileServerOrigin,
  compileServerId,
  outDirectoryRelativeUrl,

  collectPerformance,
  measurePerformance,
  collectCoverage,
  coverageIgnorePredicate,
  coverageForceIstanbul,

  coveragePlaywrightAPIAvailable,
  transformErrorHook,
}) => {
  const execute = async ({ signal, fileRelativeUrl }) => {
    const executeOperation = Abort.startOperation()
    executeOperation.addAbortSignal(signal)
    executeOperation.throwIfAborted()
    const result = await executeHtmlFile(fileRelativeUrl, {
      runtime,
      executeOperation,

      projectDirectoryUrl,
      compileServerOrigin,
      compileServerId,
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
  return execute
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
