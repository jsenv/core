/*
 * Start a development server for files inside source directory url
 * Read more in https://github.com/jsenv/core
 */

import open from "open";
import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: { "file://**/*.jsx": true },
    }),
  ],
  port: 3400,
});
if (process.argv.includes("--open")) {
  open(`${devServer.origin}`);
}
