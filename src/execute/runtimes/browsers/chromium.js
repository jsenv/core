import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const chromium = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "108.0.5359.29", // to update, check https://github.com/microsoft/playwright/releases
  coveragePlaywrightAPIAvailable: true,
})
export const chromiumIsolatedTab = chromium.isolatedTab
