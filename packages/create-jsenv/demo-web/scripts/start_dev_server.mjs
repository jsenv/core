/*
 * Start a development server for files inside src/
 * - npm run dev
 */

import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

await startDevServer({
  rootDirectoryUrl,
  port: 3400,
  explorerGroups: {
    "app": {
      "./src/main.html": true,
    },
    "unit tests": {
      "tests/**/*.test.html": true,
    },
  },
})
