const { prettierCheckProject, jsenvPrettifyMap } = require("@jsenv/prettier-check-project")
const { projectPath } = require("../../jsenv.config.js")

prettierCheckProject({
  projectPath,
  prettifyMap: {
    ...jsenvPrettifyMap,
    "/**/.dist/": false,
    "/**/.jsenv/": false,
    "/**/dist/": false,
    "/docs/**/node_modules/": false,
  },
})
