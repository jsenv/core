import { createRuntimeUsingPlaywright } from "./using_playwright.js"

const chromiumParams = {
  browserName: "chromium",
  // browserVersion will be set by "browser._initializer.version"
  // see also https://github.com/microsoft/playwright/releases
  browserVersion: "unset",
  coveragePlaywrightAPIAvailable: true,
}

export const chromium = (params) => {
  return createRuntimeUsingPlaywright({
    ...chromiumParams,
    ...params,
  })
}

export const chromiumIsolatedTab = (params) => {
  return createRuntimeUsingPlaywright({
    ...chromiumParams,
    isolatedTab: true,
    ...params,
  })
}
