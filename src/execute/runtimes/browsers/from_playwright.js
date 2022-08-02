import { writeFileSync } from "node:fs"

import { createDetailedMessage } from "@jsenv/log"
import {
  Abort,
  createCallbackListNotifiedOnce,
  raceProcessTeardownEvents,
  raceCallbacks,
} from "@jsenv/abort"
import { moveUrl } from "@jsenv/urls"
import { memoize } from "@jsenv/utils/src/memoize/memoize.js"

import { filterV8Coverage } from "@jsenv/core/src/test/coverage/v8_coverage.js"
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/core/src/test/coverage/istanbul_coverage_composition.js"

export const createRuntimeFromPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  ignoreErrorHook = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
}) => {
  const runtime = {
    type: "browser",
    name: browserName,
    version: browserVersion,
  }
  let browserAndContextPromise
  runtime.run = async ({
    signal = new AbortController().signal,
    logger,
    rootDirectoryUrl,
    fileRelativeUrl,
    devServerOrigin,

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

    executablePath,
    headful = keepRunning,
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
    const coverageInHeaders =
      coverageEnabled &&
      (!coveragePlaywrightAPIAvailable ||
        coverageMethodForBrowsers !== "playwright_api")
    const page = await browserContext.newPage({
      extraHTTPHeaders: {
        ...(coverageInHeaders
          ? {
              "x-coverage-istanbul": JSON.stringify(coverageConfig),
            }
          : {}),
      },
    })
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

    const result = {}
    const callbacks = []
    if (coverageEnabled) {
      if (
        coveragePlaywrightAPIAvailable &&
        coverageMethodForBrowsers === "playwright_api"
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
              const fsUrl = moveUrl({
                url: v8CoveragesWithWebUrl.url,
                from: `${devServerOrigin}/`,
                to: rootDirectoryUrl,
                preferAbsolute: true,
              })
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

    const fileClientUrl = new URL(fileRelativeUrl, `${devServerOrigin}/`).href

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
                if (ignoreErrorHook(error)) {
                  return
                }
                cb(transformErrorHook(error))
              },
            })
          },
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
          // pageerror: (cb) => {
          //   return registerEvent({
          //     object: page,
          //     eventType: "pageerror",
          //     callback: (error) => {
          //       if (ignoreErrorHook(error)) {
          //         return
          //       }
          //       cb(transformErrorHook(error))
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
              await page.goto(fileClientUrl, { timeout: 0 })
              const returnValue = await page.evaluate(
                /* eslint-disable no-undef */
                /* istanbul ignore next */
                () => {
                  if (!window.__supervisor__) {
                    throw new Error(`window.__supervisor__ not found`)
                  }
                  return window.__supervisor__.getScriptExecutionResults()
                },
                /* eslint-enable no-undef */
              )
              const { status, executionResults } = returnValue
              if (status === "errored") {
                cb({
                  status: "errored",
                  error: returnValue.error,
                  namespace: executionResults,
                })
              } else {
                cb({
                  status: "completed",
                  namespace: executionResults,
                })
              }
            } catch (e) {
              reject(e)
            }
          },
        },
        resolve,
      )
    })

    const getResult = async () => {
      const winner = await winnerPromise
      if (winner.name === "aborted") {
        return {
          status: "aborted",
        }
      }
      if (winner.name === "error" || winner.name === "pageerror") {
        const error = winner.data
        return {
          status: "errored",
          error,
          namespace: winner.data.namespace,
        }
      }
      if (winner.name === "closed") {
        return {
          status: "errored",
          error: isBrowserDedicatedToExecution
            ? new Error(`browser disconnected during execution`)
            : new Error(`page closed during execution`),
        }
      }
      return winner.data
    }

    try {
      const { status, error, namespace, performance } = await getResult()
      result.status = status
      result.namespace = namespace
      if (status === "errored") {
        result.error = error
      }
      if (collectPerformance) {
        result.performance = performance
      }
      await callbacks.reduce(async (previous, callback) => {
        await previous
        await callback()
      }, Promise.resolve())
    } catch (e) {
      result.status = "errored"
      result.error = e
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
      ignoreErrorHook,
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
