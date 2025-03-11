import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeHtml } from "./execute_html.js";

export const executeBuildHtmlInBrowser = async (
  rootDirectoryUrl,
  htmlFileRelativeUrl = "main.html",
  options,
) => {
  const server = await startFileServer({ rootDirectoryUrl });
  return executeHtml(`${server.origin}/${htmlFileRelativeUrl}`, options);
};
