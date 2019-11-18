const { execute } = require("@jsenv/execution")
const { launchNode } = require("@jsenv/node-launcher")
const { projectPath } = require("../../jsenv.config.js")

execute({
  projectPath,
  launch: (options) => launchNode({ ...options, debugPort: 40000 }),
  fileRelativeUrl: `/${process.argv[2]}`,
})
