/*
 * Start a development server for files inside src/
 * - npm run dev
 * - npm start
 */

import open from "open"
import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

export const devServer = await startDevServer({
  rootDirectoryUrl,
  port: 3400,
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
