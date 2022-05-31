const { composeEslintConfig } = require("@jsenv/eslint-config")

const eslintConfig = composeEslintConfig(
  // package is "type": "module" so:
  // 1. disable commonjs globals by default
  // 2. Re-enable commonjs into *.cjs files
  {
    overrides: [
      {
        files: ["**/*.js"],
        env: {
          browser: true,
        },
      },
    ],
  },
)

module.exports = eslintConfig
