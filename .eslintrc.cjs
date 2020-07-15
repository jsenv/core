/* global require, __dirname */
const { createEslintConfig } = require("@jsenv/eslint-config")

const config = createEslintConfig({
  projectDirectoryUrl: __dirname,
  importResolutionMethod: "import-map",
  // importResolverOptions: {
  //   logLevel: "debug",
  // },
})

// simulate node 13
config.globals.__filename = "off"
config.globals.__dirname = "off"
config.globals.require = "off"

module.exports = config
