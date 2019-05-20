const {
  prettierCheckProject,
  extendDefaultPrettifyMetaMap,
} = require("@jsenv/prettier-check-project")
const { projectPath } = require("../../jsenv.config.js")

prettierCheckProject({
  projectFolder: projectPath,
  prettifyMetaMap: extendDefaultPrettifyMetaMap({
    "/**/.dist/": false,
    "/**/dist/": false,
    "/**/**syntax-error**.js": false,
  }),
})
