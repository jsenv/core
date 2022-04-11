import { createRuntimeFromPlaywright } from "./from_playwright.js"

export const firefox = createRuntimeFromPlaywright({
  browserName: "firefox",
  browserVersion: "93.0",
})
export const firefoxIsolatedTab = firefox.isolatedTab
