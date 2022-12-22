import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const firefox = createRuntimeFromPlaywright({
  browserName: "firefox",
  browserVersion: "107.0", // to update, check https://github.com/microsoft/playwright/releases
})
export const firefoxIsolatedTab = firefox.isolatedTab
