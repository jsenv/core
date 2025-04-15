/*
 * Start a development server for files inside sourceDirectoryUrl
 * Read more in https://github.com/jsenv/core
 */

import open from "open";
import { startDevServer } from "@jsenv/core";

export const devServer = await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  port: 3400,
});
if (process.argv.includes("--open")) {
  open(`${devServer.origin}`);
}
