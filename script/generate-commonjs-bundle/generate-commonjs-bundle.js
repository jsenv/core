const { generateCommonJsBundle } = require("@jsenv/bundling")
const { projectPath } = require("../../jsenv.config.js")

generateCommonJsBundle({
  projectPath,
  // it is because of for of
  // when using for of bundling fails
  // (there is for/of usage in forked babel-plugin-transform-modules-systemjs )
  babelPluginMap: {},
})
