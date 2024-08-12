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

const patternForEachExtension = (pattern, extensions) => {
  return extensions.map((extension) =>
    pattern.replaceAll("[extension]", extension),
  );
};

export const eslintConfigRelax = ({
  rootDirectoryUrl,
  type = "browser",
  prettier = true, // ideally check presence of prettier config files, or in package.json dev deps
  prettierSortImport = false, // check presence in package deps
  jsxPragmaAuto = false,
  importResolutionLogLevel,

  browserFiles = [],
  browserAndNodeFiles = [],
} = {}) => {
  const isBrowser = type === "browser";
  const browserExtensions = [".js", ".jsx"];
  browserFiles = [
    "**/*.html",
    ...patternForEachExtension("**/client/**/*[extension]", browserExtensions),
    ...patternForEachExtension("**/www/**/*[extension]", browserExtensions),
    ...patternForEachExtension("**/browser/**/*[extension]", browserExtensions),
    ...(isBrowser
      ? patternForEachExtension("src/**/*[extension]", browserExtensions)
      : []),
    ...browserFiles,
  ];
  browserAndNodeFiles = [...browserAndNodeFiles];
  const parserOptions = {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  };
  const globalsForNodeModule = {
    ...globals.node,
    __filename: "off",
    __dirname: "off",
    require: "off",
    exports: "off",
    ...explicitGlobals,
  };
  const globalsForNodeCommonJs = {
    ...globals.node,
    __filename: false,
    __dirname: false,
    require: false,
    exports: false,
    ...explicitGlobals,
  };

  return [
    // import plugin
    {
      plugins: {
        "import-x": pluginImportX,
      },
      rules: {
        ...rulesImportRelax,
        // already handled by prettier-plugin-organize-imports}
        ...(prettierSortImport ? { "import-x/no-duplicates": ["off"] } : {}),
      },
      settings: {
        "import-x/extensions": [".js", ".mjs", ".jsx", ".ts", ".tsx"],
        // https://github.com/import-js/eslint-plugin-import/issues/1753
        "import-x/ignore": ["node_modules/playwright/"],
      },
    },
    // node "module" files
    {
      files: ["**/*.js", "**/*.mjs", "**/*.jsx"],
      languageOptions: {
        parser: babelParser,
        parserOptions: {
          ...parserOptions,
          requireConfigFile: false,
        },
        globals: globalsForNodeModule,
      },
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: String(rootDirectoryUrl),
            packageConditions: ["node", "development", "import"],
            logLevel: importResolutionLogLevel,
          },
        },
      },
    },
    // node "commonjs" files
    {
      files: ["**/*.cjs"],
      languageOptions: {
        parserOptions: {
          ...parserOptions,
          sourceType: "commonjs",
        },
        globals: globalsForNodeCommonJs,
      },
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: String(rootDirectoryUrl),
            packageConditions: ["node", "development"],
            logLevel: importResolutionLogLevel,
          },
        },
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
    // jsx plugin
    {
      files: ["**/*.jsx"],
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
        ...(jsxPragmaAuto ? { "react/react-in-jsx-scope": ["off"] } : {}),
      },
    },
    // browser files
    {
      files: browserFiles,
      languageOptions: {
        // use "@babel/eslint-parser" because of
        // - top level await
        // - import attributes
        // - decorators
        parser: babelParser,
        parserOptions: {
          ...parserOptions,
          requireConfigFile: false,
        },
        globals: {
          ...globals.browser,
          ...explicitGlobals,
        },
      },
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: String(
              isBrowser
                ? new URL("./src/", rootDirectoryUrl)
                : rootDirectoryUrl,
            ),
            packageConditions: ["browser", "import"],
            logLevel: importResolutionLogLevel,
          },
        },
      },
    },
    // browser and node files
    ...(browserAndNodeFiles.length
      ? [
          {
            files: browserAndNodeFiles,
            languageOptions: {
              parser: babelParser,
              parserOptions: {
                ...parserOptions,
              },
              globals: {
                ...globals.node,
                ...globals.browser,
                ...explicitGlobals,
              },
            },
          },
        ]
      : []),
    {
      rules: {
        ...rulesRelax,
        // We are using prettier, disable all eslint rules
        // already handled by prettier.
        ...(prettier ? rulesOffPrettier : {}),
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
    {
      ignores: [
        "**/.*/",
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
