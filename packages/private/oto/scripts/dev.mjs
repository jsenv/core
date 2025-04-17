/*
 * Start a development server for files inside source directory url
 * Read more in https://github.com/jsenv/core
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import open from "open";

export const devServer = await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
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
