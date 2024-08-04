import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

export const executeHtml = async (
  htmlUrl,
  {
    /* eslint-disable no-undef */
    pageFunction = () => window.resultPromise,
    /* eslint-enable no-undef */
    pageFunctionArg = undefined,
    ...options
  } = {},
) => {
  const { returnValue } = await executeInBrowser(htmlUrl, {
    pageFunction,
    pageArguments: [pageFunctionArg],
    ...options,
  });
  return returnValue;
};
