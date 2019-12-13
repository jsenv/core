const { startExploring, jsenvExplorableConfig } = require("@jsenv/core")
const jsenvConfig = require("../../jsenv.config.js")

startExploring({
  ...jsenvConfig,
  port: 3456,
  explorableConfig: {
    ...jsenvExplorableConfig,

    // temp as jsenvExplorableConfig is undefined for now
    "./index.js": true,
    "./src/**/*.js": true,
    "./test/**/*.js": true,

    "./**/docs/**/*.js": true,
    "./**/.jsenv/": false,
    "./**/node_modules/": false,
  },
})
