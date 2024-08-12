import babelParser from "@babel/eslint-parser";
import html from "eslint-plugin-html";
import pluginImportX from "eslint-plugin-import-x";
import reactPlugin from "eslint-plugin-react";
import * as regexpPlugin from "eslint-plugin-regexp";
import globals from "globals";
import { explicitGlobals } from "./explicit_globals.js";
import { rulesImportRelax } from "./rules_import_relax.js";
import { rulesOffPrettier } from "./rules_off_prettier.js";
import { rulesReactRelax } from "./rules_react_relax.js";
import { rulesRegexpRelax } from "./rules_regexp_relax.js";
import { rulesRelax } from "./rules_relax.js";

const SUPPORTED_EXTENSIONS = [".js", ".cjs", ".mjs", ".jsx", ".html"];
const patternForEachExtension = (pattern, extensions) => {
  return extensions.map((extension) =>
    pattern.replaceAll("[extension]", extension),
  );
};

export const eslintConfigRelax = ({
  rootDirectoryUrl,
  type = "browser",
  prettier = true,
  prettierSortImport = false,
  reactJsxAuto = false,

  browserFiles = [],
  browserAndNodeFiles = [],
} = {}) => {
  const isBrowser = type === "browser";

  const files = patternForEachExtension(
    "**/*[extension]",
    SUPPORTED_EXTENSIONS,
  );
  browserFiles = [
    ...patternForEachExtension(
      "**/client/**/*[extension]",
      SUPPORTED_EXTENSIONS,
    ),
    ...patternForEachExtension("**/www/**/*[extension]", SUPPORTED_EXTENSIONS),
    ...patternForEachExtension(
      "**/browser/**/*[extension]",
      SUPPORTED_EXTENSIONS,
    ),
    ...(isBrowser
      ? patternForEachExtension("./src/**/*[extension]", SUPPORTED_EXTENSIONS)
      : []),
    ...browserFiles,
    "**/*.html",
  ];
  browserAndNodeFiles = [...browserAndNodeFiles];

  return [
    {
      files,
      // use "@babel/eslint-parser" until top level await is supported by ESLint default parser
      // + to support import assertions in some files
      languageOptions: {
        parser: babelParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          requireConfigFile: false,
          ecmaFeatures: { jsx: true },
        },
      },
    },
    // node "module" files
    {
      files,
      languageOptions: {
        // Files in this repository are all meant to be executed in Node.js
        // and we want to tell this to ESLint.
        // As a result ESLint can consider `window` as undefined
        // and `global` as an existing global variable.
        // package is "type": "module" so:
        // 1. disable commonjs globals by default
        // 2. Re-enable commonjs into *.cjs files
        globals: {
          ...globals.node,
          __filename: "off",
          __dirname: "off",
          require: "off",
          exports: "off",
        },
      },
    },
    // node "commonjs" files
    {
      files: ["**/*.cjs"],
      languageOptions: {
        sourceType: "commonjs",
        // inside *.cjs files. restore commonJS "globals"
        globals: {
          ...globals.node,
          __filename: true,
          __dirname: true,
          require: true,
          exports: true,
        },
      },
    },

    // browser files
    {
      files: browserFiles,
      languageOptions: {
        globals: globals.browser,
      },
      settings: {
        "import/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: isBrowser
              ? new URL("./src/", rootDirectoryUrl)
              : rootDirectoryUrl,
            packageConditions: ["browser", "import"],
          },
        },
      },
    },
    // browser and node files
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
    // import plugin
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
    // regexp plugin
    {
      plugins: {
        regexp: regexpPlugin,
      },
      rules: {
        ...rulesRegexpRelax,
      },
    },
    // html plugin
    {
      files: ["**/*.html"],
      plugins: { html },
      settings: {
        "html/javascript-mime-types": [
          "text/javascript",
          "module",
          "text/jsx",
          "module/jsx",
        ],
      },
    },
    // jsx plugins
    {
      files: ["**/*.jsx", "**/*.tsx"],
      plugins: {
        react: reactPlugin,
      },
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        ...rulesReactRelax,
        ...(reactJsxAuto ? { "react/react-in-jsx-scope": ["off"] } : {}),
      },
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
