import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const firefox = createRuntimeFromPlaywright({
  browserName: "firefox",
  browserVersion: "100.0.2", // to update, check https://github.com/microsoft/playwright/releases
})
export const firefoxIsolatedTab = firefox.isolatedTab
