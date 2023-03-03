import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const firefox = createRuntimeFromPlaywright({
  browserName: "firefox",
  // browserVersion will be set by "browser._initializer.version"
  // see also https://github.com/microsoft/playwright/releases
  browserVersion: "unset",
})
export const firefoxIsolatedTab = firefox.isolatedTab
