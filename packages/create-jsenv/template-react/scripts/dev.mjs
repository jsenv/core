/*
 * This file uses "@jsenv/core" to start a development server.
 * https://github.com/jsenv/jsenv-core/tree/master/docs/dev_server#jsenv-dev-server
 */

import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

export const server = await startDevServer({
  rootDirectoryUrl,
  plugins,
  port: 3472,
  explorerGroups: {
    "app": {
      "./src/main.html": true,
    },
    "unit tests": {
      "test/**/*.test.html": true,
    },
  },
})
