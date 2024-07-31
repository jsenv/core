import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

export const executeBuildHtmlInBrowser = async (
  rootDirectoryUrl,
  htmlFileRelativeUrl = "main.html",
) => {
  const server = await startFileServer({
    rootDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/${htmlFileRelativeUrl}`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  return returnValue;
};
