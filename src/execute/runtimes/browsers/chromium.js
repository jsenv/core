import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const chromium = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "109.0.5414.46", // to update, check https://github.com/microsoft/playwright/releases
  coveragePlaywrightAPIAvailable: true,
})
export const chromiumIsolatedTab = chromium.isolatedTab
