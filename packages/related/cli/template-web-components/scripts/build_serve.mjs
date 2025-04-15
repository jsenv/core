/*
 * Start a server serving files into dist/
 * Read more in https://github.com/jsenv/core
 */

import open from "open";
import { startBuildServer } from "@jsenv/core";

const buildServer = await startBuildServer({
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  port: 3500,
});
if (process.argv.includes("--open")) {
  open(buildServer.origin);
}
