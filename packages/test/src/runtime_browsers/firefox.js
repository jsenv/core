import { createRuntimeUsingPlaywright } from "./using_playwright.js"

const firefoxParams = {
  browserName: "firefox",
  // browserVersion will be set by "browser._initializer.version"
  // see also https://github.com/microsoft/playwright/releases
  browserVersion: "unset",
}

export const firefox = (params) => {
  return createRuntimeUsingPlaywright({
    ...firefoxParams,
    ...params,
  })
}

export const firefoxIsolatedTab = (params) => {
  return createRuntimeUsingPlaywright({
    ...firefoxParams,
    isolatedTab: true,
    ...params,
  })
}
