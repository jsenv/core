/*
 * Start a development server for files inside src/
 * - npm run dev
 */

import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

export const devServer = await startDevServer({
  rootDirectoryUrl,
  plugins,
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
