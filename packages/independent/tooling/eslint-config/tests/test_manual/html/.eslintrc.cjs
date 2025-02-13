const {
  composeEslintConfig,
  eslintConfigForPrettier,
  jsenvEslintRules,
  eslintConfigBase,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  {
    rules: jsenvEslintRules,
  },
  {
    plugins: ["html"],
    settings: {
      extensions: [".html"],
    },
  },
  eslintConfigForPrettier,
);

module.exports = eslintConfig;
