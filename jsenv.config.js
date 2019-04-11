const { babelConfigMap } = require("./node_modules/@jsenv/babel-config-map/index.js")

exports.readImportMap = () => require("./importMap.json")

const projectFolder = __dirname
exports.projectFolder = projectFolder

const compileInto = ".dist"
exports.compileInto = compileInto

exports.babelConfigMap = babelConfigMap
