const { execute } = require("@jsenv/execution")
// eslint-disable-next-line import/no-unresolved
const { launchNode } = require("../../dist/commonjs/main.js")
const { projectPath } = require("../../jsenv.config.js")

execute({
  projectPath,
  launch: (options) => launchNode({ ...options, debugPort: 40000 }),
  fileRelativeUrl: `/test/manual/file.js`,
})
