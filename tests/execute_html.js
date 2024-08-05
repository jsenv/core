import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

export const executeHtml = async (
  htmlUrl,
  {
    /* eslint-env browser */
    pageFunction = () => window.resultPromise,
    /* eslint-env node */
    pageFunctionArg = undefined,
    ...options
  } = {},
) => {
  const { returnValue } = await executeInBrowser(htmlUrl, {
    pageFunction,
    pageArguments: [pageFunctionArg],
    mirrorConsole: true,
    ...options,
  });
  return returnValue;
};
