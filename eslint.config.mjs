import {
  composteEslintFlatConfig,
  eslintConfigBase,
  eslintConfigForPrettier,
  eslintConfigToPreferExplicitGlobals,
  jsenvEslintRules,
  jsenvEslintRulesForImport,
} from "@jsenv/eslint-config";
// import html from "eslint-plugin-html";
// import * as regexpPlugin from "eslint-plugin-regexp";

export default composteEslintFlatConfig(
  eslintConfigBase,

  // use "@babel/eslint-parser" until top level await is supported by ESLint default parser
  // + to support import assertions in some files
  // {
  //   parser: "@babel/eslint-parser",
  //   parserOptions: {
  //     requireConfigFile: false,
  //   },
  // },

  // Files in this repository are all meant to be executed in Node.js
  // and we want to tell this to ESLint.
  // As a result ESLint can consider `window` as undefined
  // and `global` as an existing global variable.
  {
    env: {
      node: true,
    },
  },

  // Enable import plugin
  // {
  //   plugins: ["import"],
  //   settings: {
  //     "import/resolver": {
  //       "@jsenv/eslint-import-resolver": {
  //         rootDirectoryUrl: __dirname,
  //         packageConditions: ["node", "development", "import"],
  //       },
  //     },
  //     "import/extensions": [".js", ".mjs"],
  //     // https://github.com/import-js/eslint-plugin-import/issues/1753
  //     "import/ignore": ["node_modules/playwright/"],
  //   },
  //   rules: {
  //     ...jsenvEslintRulesForImport,
  //     "import/no-duplicates": ["off"], // already handled by prettier-plugin-organize-imports
  //   },
  // },

  // {
  //   plugins: { regexp: regexpPlugin },
  //   rules: {
  //     "regexp/prefer-d": ["off"],
  //     "regexp/prefer-w": ["off"],
  //     "regexp/use-ignore-case": ["off"],
  //   },
  // },

  // {
  //   files: ["**/*.html"],
  //   plugins: { html },
  // },

  // Reuse jsenv eslint rules
  // {
  //   rules: {
  //     ...jsenvEslintRules,
  //     // Example of code changing the ESLint configuration to enable a rule:
  //     "camelcase": ["off"],
  //     "dot-notation": ["off"],
  //     "spaced-comment": ["off"],
  //   },
  // },

  // // package is "type": "module" so:
  // // 1. disable commonjs globals by default
  // // 2. Re-enable commonjs into *.cjs files
  // {
  //   globals: {
  //     __filename: "off",
  //     __dirname: "off",
  //     require: "off",
  //     exports: "off",
  //   },
  // },
  // {
  //   files: ["**/*.cjs"],
  //   env: {
  //     commonjs: true,
  //   },
  //   // inside *.cjs files. restore commonJS "globals"
  //   globals: {
  //     __filename: true,
  //     __dirname: true,
  //     require: true,
  //     exports: true,
  //   },
  // },

  // // several files are written for browsers, not Node.js
  // {
  //   files: [
  //     "**/**/*.html",
  //     "dev_exploring/**/*.js",
  //     "**/client/**/*.js",
  //     "**/browser/**/*.js",
  //     "./docs/**/*.js",
  //     "**/babel_helpers/**/*.js",
  //     "test/dev_server/**/*.js",
  //     "./packages/**/pwa/**/*.js",
  //     "./packages/**/custom-elements-redefine/**/*.js",
  //     "**/jsenv_service_worker.js",
  //   ],
  //   env: {
  //     browser: true,
  //     node: false,
  //   },
  //   settings: {
  //     "import/resolver": {
  //       "@jsenv/eslint-import-resolver": {
  //         rootDirectoryUrl: __dirname,
  //         packageConditions: ["browser", "import"],
  //         // logLevel: "debug",
  //       },
  //     },
  //   },
  // },

  // // browser and node
  // {
  //   files: ["./packages/**/assert/**/*.js"],
  //   env: {
  //     browser: true,
  //     node: true,
  //   },
  // },

  eslintConfigToPreferExplicitGlobals,

  // We are using prettier, disable all eslint rules
  // already handled by prettier.
  eslintConfigForPrettier,
);
