const { execute, launchNode } = require("../../dist/commonjs/main.js")
const { projectDirectoryPath } = require("../../jsenv.config.js")

execute({
  projectDirectoryPath,
  launch: (options) => launchNode({ ...options, debugPort: 40000 }),
  fileRelativeUrl: process.argv[2],
})
