const {
  babelPluginDescription,
} = require("./node_modules/@jsenv/babel-plugin-description/index.js")

try {
  const importMap = require("./importMap.json")
  exports.importMap = importMap
} catch (e) {
  exports.importMap = {}
}

const projectFolder = __dirname
exports.projectFolder = projectFolder

const compileInto = ".dist"
exports.compileInto = compileInto

exports.babelPluginDescription = babelPluginDescription

// could add nodeUsageMap and browserUsageMap
