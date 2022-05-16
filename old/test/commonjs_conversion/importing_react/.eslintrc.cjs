const { resolve } = require("path")
const { jsenvEslintRulesForReact } = require("@jsenv/eslint-config")

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
  settings: {
    react: {
      version: "detect",
    },
    extensions: [".jsx"],
  },
  plugins: ["react"],
  rules: {
    ...jsenvEslintRulesForReact,
  },
}
