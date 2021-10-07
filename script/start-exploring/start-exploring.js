import { startExploring } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

startExploring({
  ...jsenvConfig,
  babelPluginMap: {},
  compileServerPort: 3456,
  explorableConfig: {
    source: {
      "./index.html": false,
      "./src/**/*.html": false,
      "./**/docs/**/*.html": false,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
    test: {
      "./test/**/*.html": false,
      "./**/docs/**/*.html": false,
      "./test-manual/**/*.html": true,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
  },
})
