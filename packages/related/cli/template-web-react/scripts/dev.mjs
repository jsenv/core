/*
 * Start a development server for files inside source directory
 * Read more in https://github.com/jsenv/core
 */

import open from "open";
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginReact({
      refreshInstrumentation: true,
    }),
  ],
  port: 3400,
});
if (process.argv.includes("--open")) {
  open(`${devServer.origin}`);
}
