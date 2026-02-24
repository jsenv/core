// TODO: ideally when any dev package condition result in a file not found we should
// warn and fallback to other conditions

import babelParser from "@babel/eslint-parser";
import jsenvPlugin from "@jsenv/eslint-plugin";
import { urlToRelativeUrl } from "@jsenv/urls";
import signalsPlugin from "@preact/eslint-plugin-signals";
import html from "eslint-plugin-html";
import pluginImportX from "eslint-plugin-import-x";
import reactPlugin from "eslint-plugin-react";
import * as regexpPlugin from "eslint-plugin-regexp";
import globals from "globals";
import { existsSync, readFileSync } from "node:fs";
import { explicitGlobals } from "./explicit_globals.js";
import { rulesImportRelax } from "./rules_import_relax.js";
import { rulesOffPrettier } from "./rules_off_prettier.js";
import { rulesReactRelax } from "./rules_react_relax.js";
import { rulesRegexpRelax } from "./rules_regexp_relax.js";
import { rulesRelax } from "./rules_relax.js";
import { rulesSignalsRelax } from "./rules_signals_relax.js";

const patternForEachExtension = (pattern, extensions) => {
  return extensions.map((extension) =>
    pattern.replaceAll("[extension]", extension),
  );
};

/**
 * Creates a comprehensive ESLint flat configuration with relaxed rules and automatic detection
 * of project settings. Supports React/Preact, Prettier integration, browser/Node.js environments,
 * and smart defaults based on your package.json dependencies.
 *
 * @param {Object} parameters - Configuration options
 * @param {string|URL} parameters.rootDirectoryUrl - Directory containing the eslint config file and likely your package.json
 * @param {string|URL} [parameters.browserDirectoryUrl] - Directory containing files that will be executed by a web browser (formerly webDirectoryUrl)
 * @param {boolean} [parameters.prettier] - Enable Prettier integration. Auto-detected from package.json if not specified
 * @param {boolean} [parameters.prettierSortImport] - Enable prettier-plugin-organize-imports integration. Auto-detected if not specified
 * @param {boolean} [parameters.jsxPragmaAuto=false] - Disable react/react-in-jsx-scope rule for automatic JSX pragma
 * @param {boolean} [parameters.preact] - Enable Preact-specific settings. Auto-detected from package.json if not specified
 * @param {string} [parameters.reactVersion="detect"] - React version for eslint-plugin-react. Defaults to auto-detection
 * @param {string} [parameters.reactVersionForPreact="19.2.0"] - React version to use when preact is detected
 * @param {string} [parameters.importResolutionLogLevel] - Log level for import resolution debugging
 * @param {string[]} [parameters.importResolutionDevConditions=[]] - Additional package.json conditions for import resolution in development
 * @param {string[]} [parameters.browserFiles=[]] - Additional glob patterns for files that should use browser environment. Extends default patterns
 * @param {string[]} [parameters.browserAndNodeFiles=[]] - Glob patterns for files that run in both browser and Node.js environments
 *
 * @returns {Array<Object>} Array of ESLint flat config objects configured with:
 *   - Relaxed rules optimized for development productivity
 *   - Automatic browser/Node.js environment detection
 *   - React/Preact JSX support with proper settings
 *   - Import resolution with package.json conditions
 *   - HTML file linting support
 *   - Prettier integration when detected
 *   - Smart ignores for common directories
 *
 * @example
 * // Basic usage with auto-detection
 * import { eslintConfigRelax } from "@jsenv/eslint-config-relax";
 * export default eslintConfigRelax({
 *   rootDirectoryUrl: import.meta.url
 * });
 *
 * @example
 * // With custom browser directory and explicit settings
 * export default eslintConfigRelax({
 *   rootDirectoryUrl: import.meta.url,
 *   browserDirectoryUrl: new URL("./src/client/", import.meta.url),
 *   prettier: true,
 *   preact: true,
 *   browserFiles: ["src/frontend/**"]
 * });
 */
export const eslintConfigRelax = ({
  rootDirectoryUrl,
  browserDirectoryUrl,
  prettier,
  prettierSortImport,
  jsxPragmaAuto = false,
  preact,
  reactVersion = "detect",
  reactVersionForPreact = "19.2.0",
  importResolutionLogLevel,
  importResolutionDevConditions = [],

  browserFiles = [],
  browserAndNodeFiles = [],
} = {}) => {
  const packageJsonFileUrl = new URL("./package.json", rootDirectoryUrl);
  let packageObject = {};
  try {
    const packageBuffer = readFileSync(packageJsonFileUrl);
    packageObject = JSON.parse(String(packageBuffer));
  } catch {}
  const { dependencies = {}, devDependencies = {} } = packageObject;
  if (prettier === undefined) {
    if (devDependencies.prettier || packageObject.prettier) {
      prettier = true;
    } else if (
      existsSync(new URL("./.prettierrc.yml", rootDirectoryUrl)) ||
      existsSync(new URL(".prettierignore", rootDirectoryUrl))
    ) {
      prettier = true;
    }
  }
  if (prettierSortImport === undefined) {
    if (devDependencies["prettier-plugin-organize-imports"]) {
      prettierSortImport = true;
    }
  }
  if (preact === undefined) {
    if (dependencies.preact || devDependencies.preact) {
      preact = true;
    }
  }

  const browserExtensions = [".js", ".jsx"];
  const defaultBrowserFiles = [
    "**/*.html",
    ...patternForEachExtension("**/client/**/*[extension]", browserExtensions),
    ...patternForEachExtension("**/www/**/*[extension]", browserExtensions),
    ...patternForEachExtension("**/browser/**/*[extension]", browserExtensions),
  ];
  if (browserDirectoryUrl) {
    let browserDirectoryUrlString = String(browserDirectoryUrl);
    if (!browserDirectoryUrlString.endsWith("/")) {
      browserDirectoryUrlString += "/";
    }
    const relativeBrowserDir = urlToRelativeUrl(
      browserDirectoryUrl,
      rootDirectoryUrl,
    );
    defaultBrowserFiles.push(
      ...patternForEachExtension(
        `${relativeBrowserDir}**/*[extension]`,
        browserExtensions,
      ),
    );
  }
  browserFiles = [...defaultBrowserFiles, ...browserFiles];
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
    // jsenv plugin
    {
      plugins: {
        jsenv: jsenvPlugin,
      },
      rules: {
        "jsenv/no-unknown-params": ["off"], // Default: only report likely typos
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
            packageConditions: [
              "node",
              "development",
              ...importResolutionDevConditions,
              "import",
            ],
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
            packageConditions: [
              "node",
              "development",
              ...importResolutionDevConditions,
            ],
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
    // preact signals plugin
    {
      plugins: {
        signals: signalsPlugin,
      },
      rules: rulesSignalsRelax,
    },

    // jsx plugin
    {
      files: ["**/*.jsx"],
      plugins: {
        react: reactPlugin,
      },
      settings: {
        react: {
          version: preact ? reactVersionForPreact : reactVersion,
        },
      },
      rules: {
        ...rulesReactRelax,
        ...(jsxPragmaAuto ? { "react/react-in-jsx-scope": ["off"] } : {}),
        ...(preact
          ? {
              "react/no-unknown-property": [
                "error",
                {
                  ignore: [
                    "clip-path",
                    "clip-rule",
                    "dominant-baseline",
                    "fill-opacity",
                    "fill-rule",
                    "font-family",
                    "font-size",
                    "font-weight",
                    "font-style",
                    "font-variant",
                    "letter-spacing",
                    "stroke-width",
                    "stroke-dasharray",
                    "stroke-dashoffset",
                    "stroke-opacity",
                    "stroke-linejoin",
                    "stroke-linecap",
                    "stroke-miterlimit",
                    "text-anchor",
                    "text-decoration",
                    "text-rendering",
                    "transform-origin",
                    "underline-position",
                    "underline-thickness",
                    "word-spacing",
                    "onFocusOut",
                    "shape-rendering",
                    "stop-color",
                    "stop-opacity",
                  ],
                },
              ],
            }
          : {}),
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
            rootDirectoryUrl: browserDirectoryUrl || rootDirectoryUrl,
            packageConditions: [
              "browser",
              "development",
              ...importResolutionDevConditions,
              "import",
            ],
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
      rules: {
        // Ignore JSX components (start with uppercase)
        // https://github.com/BenoitZugmeyer/eslint-plugin-html/issues/295
        "no-unused-vars": [
          rulesRelax["no-unused-vars"][0],
          {
            ...rulesRelax["no-unused-vars"][1],
            varsIgnorePattern: "^[A-Z]",
          },
        ],
      },
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
