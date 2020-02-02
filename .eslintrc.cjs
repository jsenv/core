/* global require */
const { createEslintConfig } = require("@jsenv/eslint-config")
const jsenvConfig = require("./jsenv.config.js")

const config = createEslintConfig({
  ...jsenvConfig,
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
