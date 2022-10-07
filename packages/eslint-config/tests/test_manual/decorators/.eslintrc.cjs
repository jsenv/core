const { resolve } = require("path")
const {
  composeEslintConfig,
  eslintConfigForPrettier,
  jsenvEslintRules,
  eslintConfigBase,
} = require("@jsenv/eslint-config")

const babelConfigFilePath = resolve(__dirname, "./babel.config.cjs")

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  {
    parser: "@babel/eslint-parser",
    parserOptions: {
      babelOptions: {
        configFile: babelConfigFilePath,
      },
    },
  },
  {
    rules: jsenvEslintRules,
  },
  eslintConfigForPrettier,
)

module.exports = eslintConfig
