/*
 * Start a development server for files inside src/
 * - npm run dev
 */

import open from "open";
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginReact({
      refreshInstrumentation: { "file://**/*.jsx": true },
    }),
  ],
  port: 3401,
});
if (process.argv.includes("--open")) {
  open(`${devServer.origin}/main.html`);
}
