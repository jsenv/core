import babelParser from "@babel/eslint-parser";
import html from "eslint-plugin-html";
import pluginImportX from "eslint-plugin-import-x";
import * as regexpPlugin from "eslint-plugin-regexp";
import globals from "globals";
import { explicitGlobals } from "./explicit_globals.js";
import { rulesImportRelax } from "./rules_import_relax.js";
import { rulesOffPrettier } from "./rules_off_prettier.js";
import { rulesRegexpRelax } from "./rules_regexp_relax.js";
import { rulesRelax } from "./rules_relax.js";

export const eslintConfigRelax = ({
  rootDirectoryUrl,
  type = "browser",
  prettier = true,
  prettierSortImport = false,

  browserFiles = [],
  browserAndNodeFiles = [],
} = {}) => {
  const isBrowser = type === "browser";

  return [
    {
      files: ["**/*.js", "**/*.mjs"],
      env: {
        es2022: true,
      },
      // use "@babel/eslint-parser" until top level await is supported by ESLint default parser
      // + to support import assertions in some files
      // node only
      languageOptions: {
        parser: babelParser,
        parserOptions: {
          sourceType: "module",
          requireConfigFile: false,
        },
      },
    },
    // Files in this repository are all meant to be executed in Node.js
    // and we want to tell this to ESLint.
    // As a result ESLint can consider `window` as undefined
    // and `global` as an existing global variable.
    // package is "type": "module" so:
    // 1. disable commonjs globals by default
    // 2. Re-enable commonjs into *.cjs files
    {
      languageOptions: {
        globals: {
          ...globals.node,
          __filename: "off",
          __dirname: "off",
          require: "off",
          exports: "off",
        },
      },
    },
    {
      files: ["**/*.cjs"],
      languageOptions: {
        sourceType: "commonjs",
        // inside *.cjs files. restore commonJS "globals"
        globals: {
          __filename: true,
          __dirname: true,
          require: true,
          exports: true,
        },
      },
    },
    // browser only
    {
      files: [
        "**/*.html",
        "**/client/",
        "**/www/",
        "**/public/",
        ...(isBrowser ? ["./src/"] : []),
        ...browserFiles,
      ],
      languageOptions: {
        globals: globals.browser,
      },
      settings: {
        "import/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl,
            packageConditions: ["browser", "import"],
          },
        },
      },
    },
    // browser and node
    {
      files: browserAndNodeFiles,
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.browser,
        },
      },
    },
    {
      languageOptions: {
        globals: explicitGlobals,
      },
    },
    // Reuse jsenv eslint rules
    {
      rules: {
        ...rulesRelax,
        // We are using prettier, disable all eslint rules
        // already handled by prettier.
        ...(prettier ? rulesOffPrettier : {}),
      },
    },
    // plugins
    {
      plugins: {
        "import-x": pluginImportX,
      },
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl,
            packageConditions: ["node", "development", "import"],
          },
        },
        "import-x/extensions": [".js", ".mjs"],
        // https://github.com/import-js/eslint-plugin-import/issues/1753
        "import-x/ignore": ["node_modules/playwright/"],
      },
      rules: {
        ...rulesImportRelax,
        // already handled by prettier-plugin-organize-imports}
        ...(prettierSortImport ? { "import-x/no-duplicates": ["off"] } : {}),
      },
    },
    {
      plugins: {
        regexp: regexpPlugin,
      },
      rules: {
        ...rulesRegexpRelax,
      },
    },
    {
      files: ["**/*.html"],
      plugins: { html },
    },
    {
      ignores: [
        "**/.*/**",
        "!**/.github/",
        "**/node_modules/",
        "**/git_ignored/",
        "**/old/",
        "**/dist/",
        "**/*.noeslint.*",
        "**/tests/**/**syntax_error**.*",
        "**/tests/**/**syntax_error**/main.html",
        "**/tests/**/snapshots/",
        "**/tests/**/output/",
        "**/tests/**/_*test.*/",
      ],
    },
  ];
};
