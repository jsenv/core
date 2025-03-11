import { createRuntimeUsingPlaywright } from "./using_playwright.js";

export const firefox = (params) => {
  return createFirefoxRuntime(params);
};

export const firefoxIsolatedTab = (params) => {
  return createFirefoxRuntime({
    ...params,
    isolatedTab: true,
  });
};

const createFirefoxRuntime = ({
  disableOnWindowsBecauseFlaky,
  ...params
} = {}) => {
  if (process.platform === "win32") {
    if (disableOnWindowsBecauseFlaky === undefined) {
      // https://github.com/microsoft/playwright/issues/1396
      console.warn(
        `Windows + firefox detected: executions on firefox will be ignored (firefox is flaky on windows).
To disable this warning, use disableOnWindowsBecauseFlaky: true
To ignore potential flakyness, use disableOnWindowsBecauseFlaky: false`,
      );
      disableOnWindowsBecauseFlaky = true;
    }
    if (disableOnWindowsBecauseFlaky) {
      return {
        disabled: true,
        disabledReason: "flaky on windows",
      };
    }
  }

  return createRuntimeUsingPlaywright({
    browserName: "firefox",
    isolatedTab: true,
    ...params,
  });
};
