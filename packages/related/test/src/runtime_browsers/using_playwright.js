import { writeFileSync, readFileSync } from "node:fs";
import { createDetailedMessage } from "@jsenv/log";
import { Abort, raceCallbacks } from "@jsenv/abort";
import { urlIsInsideOf } from "@jsenv/urls";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";

import { WEB_URL_CONVERTER } from "../helpers/web_url_converter.js";
import { filterV8Coverage } from "../coverage/v8_coverage.js";
import { composeTwoFileByFileIstanbulCoverages } from "../coverage/istanbul_coverage_composition.js";
import { initJsSupervisorMiddleware } from "./middleware_js_supervisor.js";
import { initIstanbulMiddleware } from "./middleware_istanbul.js";

const browserPromiseCache = new Map();

export const createRuntimeUsingPlaywright = ({
  browserName,
  coveragePlaywrightAPIAvailable = false,
  memoryUsageAPIAvailable = false,
  shouldIgnoreError = () => false,
  transformErrorHook = (error) => error,
  isolatedTab = false,
  headful,
  playwrightLaunchOptions = {},
  ignoreHTTPSErrors = true,
}) => {
  const browserVersion = getBrowserVersion(browserName);
  const label = `${browserName}${browserVersion}`;
  const runtime = {
    type: "browser",
    name: browserName,
    version: browserVersion,
    capabilities: {
      coverageV8: coveragePlaywrightAPIAvailable,
    },
  };

  runtime.run = async ({
    signal = new AbortController().signal,
    logger,
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,

    keepRunning,
    stopSignal,
    onConsole,
    onRuntimeStarted,
    onRuntimeStopped,
    teardownCallbackSet,
    isTestPlan,

    measureMemoryUsage,
    onMeasureMemoryAvailable,
    collectPerformance,
    coverageEnabled = false,
    coverageInclude,
    coverageMethodForBrowsers,
    coverageFileUrl,
  }) => {
    const fileUrl = new URL(fileRelativeUrl, rootDirectoryUrl).href;
    if (!urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      throw new Error(`Cannot execute file that is outside web server root directory
--- file --- 
${fileUrl}
--- web server root directory url ---
${webServer.rootDirectoryUrl}`);
    }
    const fileServerUrl = WEB_URL_CONVERTER.asWebUrl(fileUrl, webServer);
    const cleanupCallbackSet = new Set();
    const cleanup = memoize(async (reason) => {
      const promises = [];
      for (const cleanupCallback of cleanupCallbackSet) {
        promises.push(cleanupCallback({ reason }));
      }
      cleanupCallbackSet.clear();
      await Promise.all(promises);
    });

    const isBrowserDedicatedToExecution = isolatedTab || !isTestPlan;
    let browserAndContextPromise = isBrowserDedicatedToExecution
      ? null
      : browserPromiseCache.get(label);
    if (!browserAndContextPromise) {
      browserAndContextPromise = (async () => {
        const options = {
          ...playwrightLaunchOptions,
          headless: headful === undefined ? !keepRunning : !headful,
        };
        if (memoryUsageAPIAvailable && measureMemoryUsage) {
          const { ignoreDefaultArgs, args } = options;
          if (ignoreDefaultArgs) {
            if (!ignoreDefaultArgs.includes("--headless")) {
              ignoreDefaultArgs.push("--headless");
            }
          } else {
            options.ignoreDefaultArgs = ["--headless"];
          }
          if (args) {
            if (!args.includes("--headless=new")) {
              args.push("--headless=new");
            }
          } else {
            options.args = ["--headless=new"];
          }
        }
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          playwrightLaunchOptions: options,
        });
        // if (browser._initializer.version) {
        //   runtime.version = browser._initializer.version;
        // }
        const browserContext = await browser.newContext({ ignoreHTTPSErrors });
        return { browser, browserContext };
      })();
      if (!isBrowserDedicatedToExecution) {
        browserPromiseCache.set(label, browserAndContextPromise);
        cleanupCallbackSet.add(() => {
          browserPromiseCache.delete(label);
        });
      }
    }
    const { browser, browserContext } = await browserAndContextPromise;
    const closeBrowser = async () => {
      const disconnected = browser.isConnected()
        ? new Promise((resolve) => {
            const disconnectedCallback = () => {
              browser.removeListener("disconnected", disconnectedCallback);
              resolve();
            };
            browser.on("disconnected", disconnectedCallback);
          })
        : Promise.resolve();
      // for some reason without this timeout
      // browser.close() never resolves (playwright does not like something)
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        await browser.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }
        throw e;
      }
      await disconnected;
    };
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    if (isBrowserDedicatedToExecution) {
      cleanupCallbackSet.add(closeBrowser);
      browser.on("disconnected", async () => {
        onRuntimeStopped();
      });
    } else {
      const disconnectedCallback = async () => {
        throw new Error("browser disconnected during execution");
      };
      browser.on("disconnected", disconnectedCallback);
      cleanupCallbackSet.add(() => {
        browser.removeListener("disconnected", disconnectedCallback);
      });
      teardownCallbackSet.add(async () => {
        browser.removeListener("disconnected", disconnectedCallback);
        logger.debug(`testPlan teardown -> closing ${browserName}`);
        await closeBrowser();
      });
    }

    const page = await browserContext.newPage();
    if (!isBrowserDedicatedToExecution) {
      page.on("close", () => {
        onRuntimeStopped();
      });
    }
    onRuntimeStarted();
    cleanupCallbackSet.add(async () => {
      try {
        await page.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }
        throw e;
      }
    });

    const istanbulInstrumentationEnabled =
      coverageEnabled &&
      (!runtime.capabilities.coverageV8 ||
        coverageMethodForBrowsers === "istanbul");
    if (istanbulInstrumentationEnabled) {
      await initIstanbulMiddleware(page, {
        webServer,
        rootDirectoryUrl,
        coverageInclude,
      });
    }
    if (!webServer.isJsenvDevServer) {
      await initJsSupervisorMiddleware(page, {
        webServer,
        fileUrl,
        fileServerUrl,
      });
    }

    const result = {
      status: "pending",
      errors: [],
      namespace: null,
      timings: {},
      memoryUsage: null,
      performance: null,
    };
    const callbackSet = new Set();
    if (coverageEnabled) {
      if (
        runtime.capabilities.coverageV8 &&
        coverageMethodForBrowsers === "playwright"
      ) {
        await page.coverage.startJSCoverage({
          // reportAnonymousScripts: true,
        });
        callbackSet.add(async () => {
          const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage();
          // we convert urls starting with http:// to file:// because we later
          // convert the url to filesystem path in istanbulCoverageFromV8Coverage function
          const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(
            (v8CoveragesWithWebUrl) => {
              const fsUrl = WEB_URL_CONVERTER.asFileUrl(
                v8CoveragesWithWebUrl.url,
                webServer,
              );
              return {
                ...v8CoveragesWithWebUrl,
                url: fsUrl,
              };
            },
          );
          const coverage = await filterV8Coverage(
            { result: v8CoveragesWithFsUrls },
            {
              rootDirectoryUrl,
              coverageInclude,
            },
          );
          writeFileSync(
            new URL(coverageFileUrl),
            JSON.stringify(coverage, null, "  "),
          );
        });
      } else {
        callbackSet.add(() => {
          const scriptExecutionResults = result.namespace;
          if (scriptExecutionResults) {
            const coverage =
              generateCoverageForPage(scriptExecutionResults) || {};
            writeFileSync(
              new URL(coverageFileUrl),
              JSON.stringify(coverage, null, "  "),
            );
          }
        });
      }
    } else {
      callbackSet.add(() => {
        const scriptExecutionResults = result.namespace;
        if (scriptExecutionResults) {
          Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
            delete scriptExecutionResults[fileRelativeUrl].coverage;
          });
        }
      });
    }

    if (memoryUsageAPIAvailable) {
      const getMemoryUsage = async () => {
        const memoryUsage = await page.evaluate(
          /* eslint-env browser */
          /* istanbul ignore next */
          async () => {
            const { performance } = window;
            if (!performance) {
              return null;
            }
            // performance.memory is less accurate but way faster
            // https://web.dev/articles/monitor-total-page-memory-usage#legacy-api
            if (performance.memory) {
              return performance.memory.totalJSHeapSize;
            }
            // https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
            if (
              performance.measureUserAgentSpecificMemory &&
              window.crossOriginIsolated
            ) {
              const memorySample =
                await performance.measureUserAgentSpecificMemory();
              return memorySample;
            }
            return null;
          },
          /* eslint-env node */
        );
        return memoryUsage;
      };

      if (onMeasureMemoryAvailable) {
        onMeasureMemoryAvailable(getMemoryUsage);
      }
      if (memoryUsageAPIAvailable && measureMemoryUsage) {
        callbackSet.add(async () => {
          const memoryUsage = await getMemoryUsage();
          result.memoryUsage = memoryUsage;
        });
      }
    }

    if (collectPerformance) {
      callbackSet.add(async () => {
        const performance = await page.evaluate(
          /* eslint-env browser */
          /* istanbul ignore next */
          () => {
            const { performance } = window;
            if (!performance) {
              return null;
            }
            const measures = {};
            const measurePerfEntries = performance.getEntriesByType("measure");
            measurePerfEntries.forEach((measurePerfEntry) => {
              measures[measurePerfEntry.name] = measurePerfEntry.duration;
            });
            return {
              timeOrigin: performance.timeOrigin,
              timing: performance.timing.toJSON(),
              navigation: performance.navigation.toJSON(),
              measures,
            };
          },
          /* eslint-env node */
        );
        result.performance = performance;
      });
    }

    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console
    const removeConsoleListener = registerEvent({
      object: page,
      eventType: "console",
      // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
      callback: async (consoleMessage) => {
        onConsole({
          type: consoleMessage.type(),
          text: `${extractTextFromConsoleMessage(consoleMessage)}\n`,
        });
      },
    });
    cleanupCallbackSet.add(removeConsoleListener);
    const actionOperation = Abort.startOperation();
    actionOperation.addAbortSignal(signal);

    try {
      const winnerPromise = new Promise((resolve, reject) => {
        raceCallbacks(
          {
            aborted: (cb) => {
              return actionOperation.addAbortCallback(cb);
            },
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
            error: (cb) => {
              return registerEvent({
                object: page,
                eventType: "error",
                callback: (error) => {
                  if (shouldIgnoreError(error, "error")) {
                    return;
                  }
                  cb(transformErrorHook(error));
                },
              });
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
              if (isBrowserDedicatedToExecution) {
                browser.on("disconnected", async () => {
                  cb({ reason: "browser disconnected" });
                });
              } else {
                page.on("close", () => {
                  cb({ reason: "page closed" });
                });
              }
            },
            response: async (cb) => {
              try {
                await page.goto(fileServerUrl, { timeout: 0 });
                const returnValue = await page.evaluate(
                  /* eslint-env browser */
                  /* istanbul ignore next */
                  async () => {
                    if (!window.__supervisor__) {
                      throw new Error("window.__supervisor__ is undefined");
                    }
                    const executionResultFromJsenvSupervisor =
                      await window.__supervisor__.getDocumentExecutionResult();
                    return {
                      type: "window_supervisor",
                      timings: executionResultFromJsenvSupervisor.timings,
                      executionResults:
                        executionResultFromJsenvSupervisor.executionResults,
                    };
                  },
                  /* eslint-env node */
                );
                cb(returnValue);
              } catch (e) {
                reject(e);
              }
            },
          },
          resolve,
        );
      });
      const raceHandlers = {
        aborted: () => {
          result.status = "aborted";
        },
        error: (error) => {
          result.status = "failed";
          result.errors.push(error);
        },
        // pageerror: (error) => {
        //   result.status = "failed";
        //   result.errors.push(error);
        // },
        closed: () => {
          result.status = "failed";
          result.errors.push(
            isBrowserDedicatedToExecution
              ? new Error(`browser disconnected during execution`)
              : new Error(`page closed during execution`),
          );
        },
        response: ({ executionResults, timings }) => {
          result.status = "completed";
          result.namespace = executionResults;
          result.timings = timings;
          Object.keys(executionResults).forEach((key) => {
            const executionResult = executionResults[key];
            if (executionResult.status === "failed") {
              result.status = "failed";
              if (executionResult.exception) {
                result.errors.push(executionResult.exception);
              } else {
                result.errors.push(executionResult.error);
              }
            }
          });
        },
      };
      const winner = await winnerPromise;
      raceHandlers[winner.name](winner.data);
      for (const callback of callbackSet) {
        await callback();
      }
      callbackSet.clear();
    } catch (e) {
      result.status = "failed";
      result.errors = [e];
    } finally {
      if (keepRunning) {
        stopSignal.notify = cleanup;
      } else {
        await cleanup("execution done");
      }
      return result;
    }
  };
  return runtime;
};

// see also https://github.com/microsoft/playwright/releases
const getBrowserVersion = (browserName) => {
  const playwrightPackageJsonFileUrl = import.meta.resolve(
    "playwright-core/package.json",
  );
  const playwrightBrowsersJsonFileUrl = new URL(
    "./browsers.json",
    playwrightPackageJsonFileUrl,
  );
  const browsersJson = JSON.parse(
    readFileSync(playwrightBrowsersJsonFileUrl, "utf8"),
  );
  const { browsers } = browsersJson;
  for (const browser of browsers) {
    if (browser.name === browserName) {
      return browser.browserVersion;
    }
  }
  return "unkown";
};

const generateCoverageForPage = (scriptExecutionResults) => {
  let istanbulCoverageComposed = null;
  Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
    const istanbulCoverage = scriptExecutionResults[fileRelativeUrl].coverage;
    istanbulCoverageComposed = istanbulCoverageComposed
      ? composeTwoFileByFileIstanbulCoverages(
          istanbulCoverageComposed,
          istanbulCoverage,
        )
      : istanbulCoverage;
  });
  return istanbulCoverageComposed;
};

const launchBrowserUsingPlaywright = async ({
  signal,
  browserName,
  playwrightLaunchOptions,
}) => {
  const launchBrowserOperation = Abort.startOperation();
  launchBrowserOperation.addAbortSignal(signal);
  const playwright = await importPlaywright({ browserName });
  const browserClass = playwright[browserName];
  try {
    const browser = await browserClass.launch({
      ...playwrightLaunchOptions,
      // let's handle them to close properly browser + remove listener
      // instead of relying on playwright to do so
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    launchBrowserOperation.throwIfAborted();
    return browser;
  } catch (e) {
    if (launchBrowserOperation.signal.aborted && isTargetClosedError(e)) {
      // rethrow the abort error
      launchBrowserOperation.throwIfAborted();
    }
    throw e;
  } finally {
    await launchBrowserOperation.end();
  }
};

const importPlaywright = async ({ browserName }) => {
  try {
    const namespace = await import("playwright");
    return namespace;
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      const dependencyName = `@playwright/browser-${browserName}`;
      throw new Error(
        createDetailedMessage(
          `"playwright" not found. You need ${dependencyName} in your dependencies to use "${browserName}"`,
          {
            suggestion: `npm install --save-dev ${dependencyName}`,
          },
        ),
        { cause: e },
      );
    }
    throw e;
  }
};

const isTargetClosedError = (error) => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true;
  }
  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true;
  }
  return error.message.includes("browserContext.close: Browser closed");
};

const extractTextFromConsoleMessage = (consoleMessage) => {
  return consoleMessage.text();
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
};

const registerEvent = ({ object, eventType, callback }) => {
  object.on(eventType, callback);
  return () => {
    object.removeListener(eventType, callback);
  };
};
