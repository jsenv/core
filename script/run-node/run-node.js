const { execute, launchNode } = require("../../dist/commonjs/main.js")
const jsenvConfig = require("../../jsenv.config.js")

execute({
  ...jsenvConfig,
  launch: (options) => launchNode({ ...options, debugPort: 40000 }),
  fileRelativeUrl: process.argv[2],
})
