const { resolve } = require("path");
const {
  composeEslintConfig,
  eslintConfigBase,
  eslintConfigForPrettier,
  jsenvEslintRules,
  jsenvEslintRulesForReact,
} = require("@jsenv/eslint-config");

const babelConfigFilePath = resolve(__dirname, "./babel.config.cjs");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  {
    rules: jsenvEslintRules,
  },

  // react
  {
    plugins: ["react"],
    settings: {
      react: {
        version: "17",
      },
    },
    rules: jsenvEslintRulesForReact,
  },

  // jsx
  {
    parser: "@babel/eslint-parser",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      babelOptions: {
        configFile: babelConfigFilePath,
      },
    },
    settings: {
      extensions: [".jsx"],
    },
  },

  eslintConfigForPrettier,
);

module.exports = eslintConfig;
