/*
 * Start a development server for files inside src/
 * - npm run dev
 */

import open from "open"
import { startDevServer } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/plugin-preact"

export const devServer = await startDevServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: { "./**/*.jsx": true },
    }),
  ],
  port: 3401,
  explorer: {
    groups: {
      src: {
        "./src/main.html": true,
      },
      tests: {
        "tests/**/*.test.html": true,
      },
    },
  },
})
if (process.argv.includes("--open")) {
  open(`${devServer.origin}/src/main.html`)
}
