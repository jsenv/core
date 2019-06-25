const { prettierCheckProject, jsenvPrettifyMap } = require("@jsenv/prettier-check-project")
const { projectPath } = require("../../jsenv.config.js")

prettierCheckProject({
  projectPath,
  prettifyMap: {
    ...jsenvPrettifyMap,
    "/**/.dist/": false,
    "/**/dist/": false,
    "/**/**syntax-error**.js": false,
  },
})
