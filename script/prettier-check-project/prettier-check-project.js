const {
  prettierCheckProject,
  extendDefaultPrettifyMetaMap,
} = require("@jsenv/prettier-check-project")
const { projectFolder } = require("../../jsenv.config.js")

prettierCheckProject({
  projectFolder,
  prettifyMetaMap: extendDefaultPrettifyMetaMap({
    "/**/.dist/": false,
    "/**/dist/": false,
    "/**/**syntax-error**.js": false,
  }),
})
