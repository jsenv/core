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
    coveragePlaywrightAPIAvailable: true,
    memoryUsageAPIAvailable: true,
    ...params,
  });
};
