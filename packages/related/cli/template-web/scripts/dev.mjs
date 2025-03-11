/*
 * Start a development server for files inside sourceDirectoryUrl
 * Read more in https://github.com/jsenv/core
 */

import open from "open";
import { startDevServer } from "@jsenv/core";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3400,
});
if (process.argv.includes("--open")) {
  open(`${devServer.origin}`);
}
