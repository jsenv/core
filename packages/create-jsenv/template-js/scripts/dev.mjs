/*
 * This file uses "@jsenv/core" to start a development server.
 * https://github.com/jsenv/jsenv-core/tree/master/docs/dev_server#jsenv-dev-server
 */

import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

export const server = await startDevServer({
  rootDirectoryUrl,
  port: 3472,
  protocol: "http",
  explorerGroups: {
    "app": {
      "./src/main.html": true,
    },
    "unit tests": {
      "test/**/*.test.html": true,
    },
  },
})
