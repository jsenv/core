import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const chromium = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "110.0.5481.38", // to update, check https://github.com/microsoft/playwright/releases
  coveragePlaywrightAPIAvailable: true,
})
export const chromiumIsolatedTab = chromium.isolatedTab
