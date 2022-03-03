import { createRuntimeFromPlaywright } from "@jsenv/core/src/internal/browser_launcher/from_playwright.js"

export const chromiumRuntime = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "97.0.4666.0",
  coveragePlaywrightAPIAvailable: true,
})
export const chromiumTabRuntime = chromiumRuntime.tab

export const firefoxRuntime = createRuntimeFromPlaywright({
  browserName: "firefox",
  browserVersion: "93.0",
})
export const firefoxTabRuntime = firefoxRuntime.tab

export const webkitRuntime = createRuntimeFromPlaywright({
  browserName: "webkit",
  browserVersion: "15.4",
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
export const webkitTabRuntime = webkitRuntime.tab
