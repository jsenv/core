const { readFileSync } = require("fs")
const { babelConfigMap } = require("./node_modules/@jsenv/babel-config-map/index.js")

exports.readImportMap = () => JSON.parse(String(readFileSync(`${__dirname}/importMap.json`)))

const projectFolder = __dirname
exports.projectFolder = projectFolder

const compileInto = ".dist"
exports.compileInto = compileInto

exports.babelConfigMap = babelConfigMap
