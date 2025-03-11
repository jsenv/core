const { resolve } = require("path")

const babelConfigFilePath = resolve(__dirname, "./babel.config.cjs")

module.exports = {
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    babelOptions: {
      configFile: babelConfigFilePath,
    },
  },
}
