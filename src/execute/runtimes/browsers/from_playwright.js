import { writeFileSync } from "node:fs"
import { createDetailedMessage } from "@jsenv/log"
import {
  Abort,
  createCallbackListNotifiedOnce,
  raceProcessTeardownEvents,
  raceCallbacks,
} from "@jsenv/abort"
import { urlIsInsideOf } from "@jsenv/urls"
import { memoize } from "@jsenv/utils/src/memoize/memoize.js"

import { WEB_URL_CONVERTER } from "../../../web_url_converter.js"
import { initJsSupervisorMiddleware } from "./middleware_js_supervisor.js"
import { initIstanbulMiddleware } from "./middleware_istanbul.js"
import { filterV8Coverage } from "@jsenv/core/src/test/coverage/v8_coverage.js"
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/core/src/test/coverage/istanbul_coverage_composition.js"

export const createRuntimeFromPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  shouldIgnoreError = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
}) => {
  const runtime = {
    type: "browser",
    name: browserName,
    version: browserVersion,
    capabilities: {
      coverageV8: coveragePlaywrightAPIAvailable,
    },
  }
  let browserAndContextPromise
  runtime.run = async ({
    signal = new AbortController().signal,
    logger,
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,

    // measurePerformance,
    collectPerformance,
    coverageEnabled = false,
    coverageConfig,
    coverageMethodForBrowsers,
    coverageFileUrl,

    stopAfterAllSignal,
    stopSignal,
    keepRunning,
    onConsole,

    headful = keepRunning,
    playwrightLaunchOptions = {},
    ignoreHTTPSErrors = true,
  }) => {
    const fileUrl = new URL(fileRelativeUrl, rootDirectoryUrl).href
    if (!urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      throw new Error(`Cannot execute file that is outside web server root directory
--- file --- 
${fileUrl}
--- web server root directory url ---
${webServer.rootDirectoryUrl}`)
    }
    const fileServerUrl = WEB_URL_CONVERTER.asWebUrl(fileUrl, webServer)
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
          playwrightLaunchOptions: {
            ...playwrightLaunchOptions,
            headless: !headful,
          },
        })
        if (browser._initializer.version) {
          runtime.version = browser._initializer.version
        }
        const browserContext = await browser.newContext({ ignoreHTTPSErrors })
        return { browser, browserContext }
      })()
    }
    const { browser, browserContext } = await browserAndContextPromise
    const closeBrowser = async () => {
      const disconnected = browser.isConnected()
        ? new Promise((resolve) => {
            const disconnectedCallback = () => {
              browser.removeListener("disconnected", disconnectedCallback)
              resolve()
            }
            browser.on("disconnected", disconnectedCallback)
          })
        : Promise.resolve()
      // for some reason without this 150ms timeout
      // browser.close() never resolves (playwright does not like something)
      await new Promise((resolve) => setTimeout(resolve, 150))
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

    const page = await browserContext.newPage()

    const istanbulInstrumentationEnabled =
      coverageEnabled &&
      (!runtime.capabilities.coverageV8 ||
        coverageMethodForBrowsers === "istanbul")
    if (istanbulInstrumentationEnabled) {
      await initIstanbulMiddleware(page, {
        webServer,
        rootDirectoryUrl,
        coverageConfig,
      })
    }
    if (!webServer.isJsenvDevServer) {
      await initJsSupervisorMiddleware(page, {
        webServer,
        fileUrl,
        fileServerUrl,
      })
    }
    const closePage = async () => {
      try {
        await page.close()
      } catch (e) {
        if (isTargetClosedError(e)) {
          return
        }
        throw e
      }
    }

    const result = {
      status: "pending",
      namespace: null,
      errors: [],
    }
    const callbacks = []
    if (coverageEnabled) {
      if (
        runtime.capabilities.coverageV8 &&
        coverageMethodForBrowsers === "playwright"
      ) {
        await page.coverage.startJSCoverage({
          // reportAnonymousScripts: true,
        })
        callbacks.push(async () => {
          const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage()
          // we convert urls starting with http:// to file:// because we later
          // convert the url to filesystem path in istanbulCoverageFromV8Coverage function
          const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(
            (v8CoveragesWithWebUrl) => {
              const fsUrl = WEB_URL_CONVERTER.asFileUrl(
                v8CoveragesWithWebUrl.url,
                webServer,
              )
              return {
                ...v8CoveragesWithWebUrl,
                url: fsUrl,
              }
            },
          )
          const coverage = await filterV8Coverage(
            { result: v8CoveragesWithFsUrls },
            {
              rootDirectoryUrl,
              coverageConfig,
            },
          )
          writeFileSync(
            new URL(coverageFileUrl),
            JSON.stringify(coverage, null, "  "),
          )
        })
      } else {
        callbacks.push(() => {
          const scriptExecutionResults = result.namespace
          if (scriptExecutionResults) {
            const coverage =
              generateCoverageForPage(scriptExecutionResults) || {}
            writeFileSync(
              new URL(coverageFileUrl),
              JSON.stringify(coverage, null, "  "),
            )
          }
        })
      }
    } else {
      callbacks.push(() => {
        const scriptExecutionResults = result.namespace
        if (scriptExecutionResults) {
          Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
            delete scriptExecutionResults[fileRelativeUrl].coverage
          })
        }
      })
    }

    if (collectPerformance) {
      callbacks.push(async () => {
        const performance = await page.evaluate(
          /* eslint-disable no-undef */
          /* istanbul ignore next */
          () => {
            const { performance } = window
            if (!performance) {
              return null
            }
            const measures = {}
            const measurePerfEntries = performance.getEntriesByType("measure")
            measurePerfEntries.forEach((measurePerfEntry) => {
              measures[measurePerfEntry.name] = measurePerfEntry.duration
            })
            return {
              timeOrigin: performance.timeOrigin,
              timing: performance.timing.toJSON(),
              navigation: performance.navigation.toJSON(),
              measures,
            }
          },
          /* eslint-enable no-undef */
        )
        result.performance = performance
      })
    }

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
    cleanupCallbackList.add(removeConsoleListener)
    const actionOperation = Abort.startOperation()
    actionOperation.addAbortSignal(signal)

    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            return actionOperation.addAbortCallback(cb)
          },
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
          error: (cb) => {
            return registerEvent({
              object: page,
              eventType: "error",
              callback: (error) => {
                if (shouldIgnoreError(error, "error")) {
                  return
                }
                cb(transformErrorHook(error))
              },
            })
          },
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
          // pageerror: () => {
          //   return registerEvent({
          //     object: page,
          //     eventType: "pageerror",
          //     callback: (error) => {
          //       if (
          //         webServer.isJsenvDevServer ||
          //         shouldIgnoreError(error, "pageerror")
          //       ) {
          //         return
          //       }
          //       result.errors.push(transformErrorHook(error))
          //     },
          //   })
          // },
          closed: (cb) => {
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
            if (isBrowserDedicatedToExecution) {
              browser.on("disconnected", async () => {
                cb({ reason: "browser disconnected" })
              })
              cleanupCallbackList.add(closePage)
              cleanupCallbackList.add(closeBrowser)
            } else {
              const disconnectedCallback = async () => {
                throw new Error("browser disconnected during execution")
              }
              browser.on("disconnected", disconnectedCallback)
              page.on("close", () => {
                cb({ reason: "page closed" })
              })
              cleanupCallbackList.add(closePage)
              cleanupCallbackList.add(() => {
                browser.removeListener("disconnected", disconnectedCallback)
              })
              const notifyPrevious = stopAfterAllSignal.notify
              stopAfterAllSignal.notify = async () => {
                await notifyPrevious()
                browser.removeListener("disconnected", disconnectedCallback)
                logger.debug(
                  `stopAfterAllSignal notified -> closing ${browserName}`,
                )
                await closeBrowser()
              }
            }
          },
          response: async (cb) => {
            try {
              await page.goto(fileServerUrl, { timeout: 0 })
              const returnValue = await page.evaluate(
                /* eslint-disable no-undef */
                /* istanbul ignore next */
                async () => {
                  let startTime
                  try {
                    startTime = window.performance.timing.navigationStart
                  } catch (e) {
                    startTime = Date.now()
                  }
                  if (!window.__supervisor__) {
                    throw new Error("window.__supervisor__ is undefined")
                  }
                  const executionResultFromJsenvSupervisor =
                    await window.__supervisor__.getDocumentExecutionResult()
                  return {
                    type: "window_supervisor",
                    startTime,
                    endTime: Date.now(),
                    executionResults:
                      executionResultFromJsenvSupervisor.executionResults,
                  }
                },
                /* eslint-enable no-undef */
              )
              cb(returnValue)
            } catch (e) {
              reject(e)
            }
          },
        },
        resolve,
      )
    })

    const writeResult = async () => {
      const winner = await winnerPromise
      if (winner.name === "aborted") {
        result.status = "aborted"
        return
      }
      if (winner.name === "error") {
        let error = winner.data
        result.status = "failed"
        result.errors.push(error)
        return
      }
      if (winner.name === "pageerror") {
        let error = winner.data
        result.status = "failed"
        result.errors.push(error)
        return
      }
      if (winner.name === "closed") {
        result.status = "failed"
        result.errors.push(
          isBrowserDedicatedToExecution
            ? new Error(`browser disconnected during execution`)
            : new Error(`page closed during execution`),
        )
        return
      }
      // winner.name === "response"
      const { executionResults } = winner.data
      result.status = "completed"
      result.namespace = executionResults
      Object.keys(executionResults).forEach((key) => {
        const executionResult = executionResults[key]
        if (executionResult.status === "failed") {
          result.status = "failed"
          if (executionResult.exception) {
            result.errors.push({
              ...executionResult.exception,
              stack: executionResult.exception.text,
            })
          } else {
            result.errors.push({
              ...executionResult.error,
              stack: executionResult.error.stack,
            })
          }
        }
      })
    }

    try {
      await writeResult()
      if (collectPerformance) {
        result.performance = performance
      }
      await callbacks.reduce(async (previous, callback) => {
        await previous
        await callback()
      }, Promise.resolve())
    } catch (e) {
      result.status = "failed"
      result.errors = [e]
    }
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
      shouldIgnoreError,
      transformErrorHook,
      isolatedTab: true,
    })
  }
  return runtime
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

const launchBrowserUsingPlaywright = async ({
  signal,
  browserName,
  stopOnExit,
  playwrightLaunchOptions,
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
      ...playwrightLaunchOptions,
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
  return error.message.includes("browserContext.close: Browser closed")
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
