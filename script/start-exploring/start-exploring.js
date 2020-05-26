import { startExploring } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

startExploring({
  ...jsenvConfig,
  babelPluginMap: {},
  port: 3456,
  explorableConfig: {
    source: {
      "./index.js": false,
      "./src/**/*.js": false,
      "./**/docs/**/*.js": false,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
    test: {
      "./test/**/*.js": false,
      "./**/docs/**/*.js": false,
      "./test-manual/**/*.js": true,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
  },
})
