/*
 * Ensure server errors are dispatched to clients only if this page is responsible
 * for the error; unrelated pages must not display an error.
 */

import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
});
