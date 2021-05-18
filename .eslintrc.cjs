const {
  composeEslintConfig,
  eslintConfigBase,
  eslintConfigForPrettier,
  eslintConfigToPreferExplicitGlobals,
  jsenvEslintRules,
  jsenvEslintRulesForImport,
} = require("@jsenv/eslint-config")

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  {
    plugins: ["import"],
    settings: {
      "import/resolver": {
        "@jsenv/importmap-eslint-resolver": {
          projectDirectoryUrl: __dirname,
          importMapFileRelativeUrl: "./import-map.importmap",
          node: true,
        },
      },
    },
    rules: jsenvEslintRulesForImport,
  },
  {
    plugins: ["html"],
    settings: {
      extensions: [".html"],
    },
  },
  {
    rules: jsenvEslintRules,
  },
  {
    // package is "type": "module"
    // disable commonjs globals by default
    env: {
      node: true,
    },
    globals: {
      __filename: "off",
      __dirname: "off",
      require: "off",
    },
    overrides: [
      {
        files: ["**/*.cjs"],
        // inside *.cjs files. restore commonJS "globals"
        env: {
          commonjs: true,
        },
        globals: {
          __filename: true,
          __dirname: true,
          require: true,
        },
        // inside *.cjs files, use commonjs module resolution
        settings: {
          "import/resolver": {
            node: {},
          },
        },
      },
    ],
  },
  {
    // several files are written for browsers, not Node.js
    overrides: [
      {
        files: [
          "**/createBrowserRuntime/**/*.js",
          "**/exploring/**/*.js",
          "**/toolbar/**/*.js",
          "**/browser-utils/**/*.js",
          "**/detectBrowser/**/*.js",
        ],
        env: {
          browser: true,
          node: false,
        },
      },
    ],
  },
  eslintConfigToPreferExplicitGlobals,
  eslintConfigForPrettier,
)

module.exports = eslintConfig
