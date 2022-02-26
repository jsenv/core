/*
 * This file is used to configure a list of babel plugins as documented in
 * https://babeljs.io/docs/en/presets
 *
 * This list of babel plugins is meant to be used in project using jsenv.
 *
 * Jsenv decides to use a subset of babel plugins with the following logic:
 * - During dev babel plugins natively supported by browsers and Node.js are not used.
 * - During build:
 *   - When "runtimeSupport" is configured, babel plugins already supported by these runtime won't be used
 *     See https://github.com/jsenv/jsenv-template-pwa/blob/main/jsenv.config.mjs#L12
 *   - Otherwise all babel plugins are used
 */

import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// The default list of babel plugins MUST be in compatMap
// https://github.com/jsenv/jsenv-core/blob/master/src/internal/features/babel_plugin_compatibility.js#L11
// Otherwise it means there is no runtime supporting the babel plugins
// and the compilation is always required
export const getBaseBabelPluginStructure = () => {
  const babelPluginStructure = {
    "proposal-numeric-separator": require("@babel/plugin-proposal-numeric-separator"),
    "proposal-json-strings": require("@babel/plugin-proposal-json-strings"),
    "proposal-object-rest-spread": require("@babel/plugin-proposal-object-rest-spread"),
    "proposal-optional-catch-binding": require("@babel/plugin-proposal-optional-catch-binding"),
    "proposal-optional-chaining": require("@babel/plugin-proposal-optional-chaining"),
    "proposal-unicode-property-regex": require("@babel/plugin-proposal-unicode-property-regex"),
    "transform-async-to-promises": [
      require("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "simple",
      },
    ],
    "transform-arrow-functions": require("@babel/plugin-transform-arrow-functions"),
    "transform-block-scoped-functions": require("@babel/plugin-transform-block-scoped-functions"),
    "transform-block-scoping": require("@babel/plugin-transform-block-scoping"),
    "transform-classes": require("@babel/plugin-transform-classes"),
    "transform-computed-properties": require("@babel/plugin-transform-computed-properties"),
    "transform-destructuring": require("@babel/plugin-transform-destructuring"),
    "transform-dotall-regex": require("@babel/plugin-transform-dotall-regex"),
    "transform-duplicate-keys": require("@babel/plugin-transform-duplicate-keys"),
    "transform-exponentiation-operator": require("@babel/plugin-transform-exponentiation-operator"),
    "transform-for-of": require("@babel/plugin-transform-for-of"),
    "transform-function-name": require("@babel/plugin-transform-function-name"),
    "transform-literals": require("@babel/plugin-transform-literals"),
    "transform-new-target": require("@babel/plugin-transform-new-target"),
    "transform-object-super": require("@babel/plugin-transform-object-super"),
    "transform-parameters": require("@babel/plugin-transform-parameters"),
    "transform-regenerator": [
      require("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ],
    "transform-shorthand-properties": require("@babel/plugin-transform-shorthand-properties"),
    "transform-spread": require("@babel/plugin-transform-spread"),
    "transform-sticky-regex": require("@babel/plugin-transform-sticky-regex"),
    "transform-template-literals": require("@babel/plugin-transform-template-literals"),
    "transform-typeof-symbol": require("@babel/plugin-transform-typeof-symbol"),
    "transform-unicode-regex": require("@babel/plugin-transform-unicode-regex"),
  }
  return babelPluginStructure
}
