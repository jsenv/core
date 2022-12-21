/*
 * Start a development server for files inside src/
 * - npm run dev
 */

import open from "open"
import { startDevServer } from "@jsenv/core"
import { jsenvPluginReact } from "@jsenv/plugin-react"

export const devServer = await startDevServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  plugins: [
    jsenvPluginReact({
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
