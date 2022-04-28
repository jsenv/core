import { Script } from "node:vm"
import { createDetailedMessage } from "@jsenv/logger"
import {
  Abort,
  createCallbackListNotifiedOnce,
  raceProcessTeardownEvents,
} from "@jsenv/abort"
import { moveUrl } from "@jsenv/filesystem"

import { memoize } from "@jsenv/utils/memoize/memoize.js"
import { filterV8Coverage } from "@jsenv/utils/coverage/v8_coverage_from_directory.js"
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/utils/coverage/istanbul_coverage_composition.js"
import { escapeRegexpSpecialChars } from "@jsenv/utils/string/escape_regexp_special_chars.js"

export const createRuntimeFromPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  ignoreErrorHook = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
}) => {
  const runtime = {
    name: browserName,
    version: browserVersion,
    needsServer: true,
  }
  let browserAndContextPromise
  runtime.run = async ({
    signal = new AbortController().signal,
    // logger,
    rootDirectoryUrl,
    fileRelativeUrl,
    server,

    // measurePerformance,
    // collectPerformance,
    collectCoverage = false,
    coverageForceIstanbul,
    urlShouldBeCovered,

    stopAfterAllSignal,
    stopSignal,
    keepRunning,
    onStop,
    onError,
    onConsole,
    onResult,

    executablePath,
    headful = false,
    ignoreHTTPSErrors = true,
  }) => {
    const cleanupCallbackList = createCallbackListNotifiedOnce()
    const cleanup = memoize(async (reason) => {
      await cleanupCallbackList.notify({ reason })
    })

    const isBrowserDedicatedToExecution = isolatedTab || !stopAfterAllSignal
    if (isBrowserDedicatedToExecution || !browserAndContextPromise) {
      browserAndContextPromise = (async () => {
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          stopOnExit: true,
          playwrightOptions: {
            headless: !headful,
            executablePath,
          },
        })
        const browserContext = await browser.newContext({ ignoreHTTPSErrors })
        return { browser, browserContext }
      })()
    }
    const { browser, browserContext } = await browserAndContextPromise
    const closeBrowser = async () => {
      try {
        await stopBrowser(browser)
      } catch (e) {
        onError(e)
      }
    }
    const page = await browserContext.newPage()
    const closePage = async () => {
      try {
        await page.close()
      } catch (e) {
        if (isTargetClosedError(e)) {
          return
        }
        onError(e)
      }
    }
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    if (isBrowserDedicatedToExecution) {
      browser.on("disconnected", async () => {
        await cleanup("browser disconnected")
        onStop({ reason: "browser disconnected" })
      })
      cleanupCallbackList.add(closePage)
      cleanupCallbackList.add(closeBrowser)
    } else {
      const disconnectedCallback = async () => {
        await cleanup("browser disconnected")
        onError(new Error("browser disconnected during execution"))
      }
      browser.on("disconnected", disconnectedCallback)
      page.on("close", () => {
        onStop({ reason: "page closed" })
      })
      cleanupCallbackList.add(closePage)
      const notifyPrevious = stopAfterAllSignal.notify
      stopAfterAllSignal.notify = async () => {
        await notifyPrevious()
        browser.removeListener("disconnected", disconnectedCallback)
        await closeBrowser()
      }
    }
    const stopTrackingToNotify = trackPageToNotify(page, {
      onError: (error) => {
        error = transformErrorHook(error)
        if (!ignoreErrorHook(error)) {
          onError(error)
        }
      },
      onConsole,
    })
    cleanupCallbackList.add(stopTrackingToNotify)

    let resultTransformer = (result) => result
    if (collectCoverage) {
      if (coveragePlaywrightAPIAvailable && !coverageForceIstanbul) {
        await page.coverage.startJSCoverage({
          // reportAnonymousScripts: true,
        })
        resultTransformer = composeTransformer(
          resultTransformer,
          async (result) => {
            const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage()
            // we convert urls starting with http:// to file:// because we later
            // convert the url to filesystem path in istanbulCoverageFromV8Coverage function
            const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(
              (v8CoveragesWithWebUrl) => {
                const fsUrl = moveUrl({
                  url: v8CoveragesWithWebUrl.url,
                  from: `${server.origin}/`,
                  to: rootDirectoryUrl,
                  preferAbsolute: true,
                })
                return {
                  ...v8CoveragesWithWebUrl,
                  url: fsUrl,
                }
              },
            )
            const coverage = filterV8Coverage(
              { result: v8CoveragesWithFsUrls },
              {
                urlShouldBeCovered,
              },
            )
            return {
              ...result,
              coverage,
            }
          },
        )
      } else {
        resultTransformer = composeTransformer(
          resultTransformer,
          async (result) => {
            result.coverage = generateCoverageForPage(result.namespace)
            return result
          },
        )
      }
    } else {
      resultTransformer = composeTransformer(resultTransformer, (result) => {
        const { namespace: fileExecutionResultMap } = result
        Object.keys(fileExecutionResultMap).forEach((fileRelativeUrl) => {
          delete fileExecutionResultMap[fileRelativeUrl].coverage
        })
        return result
      })
    }
    const fileClientUrl = new URL(fileRelativeUrl, `${server.origin}/`).href
    let result
    try {
      await page.goto(fileClientUrl, { timeout: 0 })
      result = await getResult({
        page,
        rootDirectoryUrl,
        server,
        transformErrorHook,
      })
      result = await resultTransformer(result)
    } catch (e) {
      await cleanup("execution error")
      throw e
    }
    onResult(result)
    if (keepRunning) {
      stopSignal.notify = cleanup
    } else {
      await cleanup("execution done")
    }
    return result
  }

  if (!isolatedTab) {
    runtime.isolatedTab = createRuntimeFromPlaywright({
      browserName,
      browserVersion,
      coveragePlaywrightAPIAvailable,
      ignoreErrorHook,
      transformErrorHook,
      isolatedTab: true,
    })
  }
  return runtime
}

const getResult = async ({
  page,
  rootDirectoryUrl,
  server,
  transformErrorHook,
}) => {
  const result = await page.evaluate(
    /* eslint-disable no-undef */
    /* istanbul ignore next */
    () => {
      return window.__html_supervisor__.getScriptExecutionResults()
    },
    /* eslint-enable no-undef */
  )
  const { status, scriptExecutionResults } = result
  if (status === "errored") {
    const { exceptionSource } = result
    const error = evalException(exceptionSource, {
      rootDirectoryUrl,
      server,
      transformErrorHook,
    })
    return {
      status: "errored",
      error,
      namespace: scriptExecutionResults,
    }
  }
  return {
    status: "completed",
    namespace: scriptExecutionResults,
  }
}

const generateCoverageForPage = (scriptExecutionResults) => {
  let istanbulCoverageComposed = null
  Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
    const istanbulCoverage = scriptExecutionResults[fileRelativeUrl].coverage
    istanbulCoverageComposed = istanbulCoverageComposed
      ? composeTwoFileByFileIstanbulCoverages(
          istanbulCoverageComposed,
          istanbulCoverage,
        )
      : istanbulCoverage
  })
  return istanbulCoverageComposed
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
          `"playwright" not found. You need playwright in your dependencies to use "${browserName}"`,
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

const trackPageToNotify = (page, { onError, onConsole }) => {
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
  const removeErrorListener = registerEvent({
    object: page,
    eventType: "error",
    callback: onError,
  })
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
  const removePageErrorListener = registerEvent({
    object: page,
    eventType: "pageerror",
    callback: onError,
  })
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
  const removeConsoleListener = registerEvent({
    object: page,
    eventType: "console",
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
    callback: async (consoleMessage) => {
      onConsole({
        type: consoleMessage.type(),
        text: `${extractTextFromConsoleMessage(consoleMessage)}
`,
      })
    },
  })
  return () => {
    removeErrorListener()
    removePageErrorListener()
    removeConsoleListener()
  }
}

const composeTransformer = (previousTransformer, transformer) => {
  return async (value) => {
    const transformedValue = await previousTransformer(value)
    return transformer(transformedValue)
  }
}

const extractTextFromConsoleMessage = (consoleMessage) => {
  return consoleMessage.text()
  // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
}

const registerEvent = ({ object, eventType, callback }) => {
  object.on(eventType, callback)
  return () => {
    object.removeListener(eventType, callback)
  }
}

const evalException = (
  exceptionSource,
  { rootDirectoryUrl, server, transformErrorHook },
) => {
  const script = new Script(exceptionSource, { filename: "" })
  const error = script.runInThisContext()
  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(
      escapeRegexpSpecialChars(`${server.origin}/`),
      "g",
    )
    error.stack = error.stack.replace(remoteRootRegexp, rootDirectoryUrl)
    error.message = error.message.replace(remoteRootRegexp, rootDirectoryUrl)
  }
  return transformErrorHook(error)
}
