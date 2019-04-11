const { bundleNode } = require("@jsenv/core")
const { readImportMap, projectFolder } = require("../../jsenv.config.js")

bundleNode({
  importMap: readImportMap(),
  projectFolder,
  into: "dist/node",
  babelConfigMap: {},
  entryPointMap: {
    main: "index.js",
  },
  verbose: true,
  compileGroupCount: 1,
})
