import { createRuntimeUsingPlaywright } from "./using_playwright.js";

export const chromium = (params) => {
  return createChromiumRuntine(params);
};

export const chromiumIsolatedTab = (params) => {
  return createChromiumRuntine({
    ...params,
    isolatedTab: true,
  });
};

const createChromiumRuntine = (params) => {
  return createRuntimeUsingPlaywright({
    browserName: "chromium",
    // browserVersion will be set by "browser._initializer.version"
    // see also https://github.com/microsoft/playwright/releases
    browserVersion: "unset",
    coveragePlaywrightAPIAvailable: true,
    memoryUsageAPIAvailable: true,
    ...params,
  });
};
