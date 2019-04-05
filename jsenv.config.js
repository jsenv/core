const { babelConfigMap } = require("./node_modules/@jsenv/babel-config-map/index.js")

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

exports.babelConfigMap = babelConfigMap
