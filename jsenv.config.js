const { babelConfigMap } = require("./node_modules/@jsenv/babel-config-map/index.js")

exports.readImportMap = () => {
  const importMap = require("./importMap.json")
  delete require.cache[require.resolve("./importMap.json")]
  return importMap
}

const projectFolder = __dirname
exports.projectFolder = projectFolder

const compileInto = ".dist"
exports.compileInto = compileInto

exports.babelConfigMap = babelConfigMap
