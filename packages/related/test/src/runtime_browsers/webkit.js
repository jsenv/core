import { createRuntimeUsingPlaywright } from "./using_playwright.js";

export const webkit = (params) => {
  return createWekbitRuntime(params);
};

export const webkitIsolatedTab = (params) => {
  return createWekbitRuntime({
    ...params,
    isolatedTab: true,
  });
};

const createWekbitRuntime = (params) => {
  return createRuntimeUsingPlaywright({
    browserName: "webkit",
    shouldIgnoreError: (error) => {
      // we catch error during execution but safari throw unhandled rejection
      // in a non-deterministic way.
      // I suppose it's due to some race condition to decide if the promise is catched or not
      // for now we'll ignore unhandled rejection on wekbkit
      if (error.name === "Unhandled Promise Rejection") {
        return true;
      }
      return false;
    },
    transformErrorHook: (error) => {
      // Force error stack to contain the error message
      // because it's not the case on webkit
      error.stack = `${error.message}
    at ${error.stack}`;
      return error;
    },
    ...params,
  });
};
