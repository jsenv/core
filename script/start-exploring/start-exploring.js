import { startExploring, jsenvExplorableConfig } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

startExploring({
  ...jsenvConfig,
  babelPluginMap: {},
  port: 3456,
  explorableConfig: {
    ...jsenvExplorableConfig,

    // temp as jsenvExplorableConfig is undefined for now
    "./index.js": false,
    "./src/**/*.js": false,
    "./test/**/*.js": false,
    "./test-manual/**/*.js": true,

    "./**/docs/**/*.js": false,
    "./**/.jsenv/": false,
    "./**/node_modules/": false,
  },
})
