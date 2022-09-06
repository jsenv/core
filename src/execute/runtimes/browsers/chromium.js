import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const chromium = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "105.0.5195.19", // to update, check https://github.com/microsoft/playwright/releases
  coveragePlaywrightAPIAvailable: true,
})
export const chromiumIsolatedTab = chromium.isolatedTab
