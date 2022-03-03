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

export const getBaseBabelPluginStructure = ({ isSupportedOnRuntime }) => {
  const babelPluginStructure = {}
  if (!isSupportedOnRuntime("proposal-numeric-separator")) {
    babelPluginStructure[
      "proposal-numeric-separator"
    ] = require("@babel/plugin-proposal-numeric-separator")
  }
  if (!isSupportedOnRuntime("proposal-json-strings")) {
    babelPluginStructure[
      "proposal-json-strings"
    ] = require("@babel/plugin-proposal-json-strings")
  }
  if (!isSupportedOnRuntime("proposal-object-rest-spread")) {
    babelPluginStructure[
      "proposal-object-rest-spread"
    ] = require("@babel/plugin-proposal-object-rest-spread")
  }
  if (!isSupportedOnRuntime("proposal-optional-catch-binding")) {
    babelPluginStructure[
      "proposal-optional-catch-binding"
    ] = require("@babel/plugin-proposal-optional-catch-binding")
  }
  if (!isSupportedOnRuntime("proposal-unicode-property-regex")) {
    babelPluginStructure[
      "proposal-unicode-property-regex"
    ] = require("@babel/plugin-proposal-unicode-property-regex")
  }
  if (!isSupportedOnRuntime("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      require("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "simple",
      },
    ]
  }
  if (!isSupportedOnRuntime("transform-arrow-functions")) {
    babelPluginStructure[
      "transform-arrow-functions"
    ] = require("@babel/plugin-transform-arrow-functions")
  }
  if (!isSupportedOnRuntime("transform-block-scoped-functions")) {
    babelPluginStructure[
      "transform-block-scoped-functions"
    ] = require("@babel/plugin-transform-block-scoped-functions")
  }
  if (!isSupportedOnRuntime("transform-block-scoping")) {
    babelPluginStructure[
      "transform-block-scoping"
    ] = require("@babel/plugin-transform-block-scoping")
  }
  if (!isSupportedOnRuntime("transform-classes")) {
    babelPluginStructure[
      "transform-classes"
    ] = require("@babel/plugin-transform-classes")
  }
  if (!isSupportedOnRuntime("transform-computed-properties")) {
    babelPluginStructure[
      "transform-computed-properties"
    ] = require("@babel/plugin-transform-computed-properties")
  }
  if (!isSupportedOnRuntime("transform-destructuring")) {
    babelPluginStructure[
      "transform-destructuring"
    ] = require("@babel/plugin-transform-destructuring")
  }
  if (!isSupportedOnRuntime("transform-dotall-regex")) {
    babelPluginStructure[
      "transform-dotall-regex"
    ] = require("@babel/plugin-transform-dotall-regex")
  }
  if (!isSupportedOnRuntime("transform-duplicate-keys")) {
    babelPluginStructure[
      "transform-duplicate-keys"
    ] = require("@babel/plugin-transform-duplicate-keys")
  }
  if (!isSupportedOnRuntime("transform-exponentiation-operator")) {
    babelPluginStructure[
      "transform-exponentiation-operator"
    ] = require("@babel/plugin-transform-exponentiation-operator")
  }
  if (!isSupportedOnRuntime("transform-for-of")) {
    babelPluginStructure[
      "transform-for-of"
    ] = require("@babel/plugin-transform-for-of")
  }
  if (!isSupportedOnRuntime("transform-function-name")) {
    babelPluginStructure[
      "transform-function-name"
    ] = require("@babel/plugin-transform-function-name")
  }
  if (!isSupportedOnRuntime("transform-literals")) {
    babelPluginStructure[
      "transform-literals"
    ] = require("@babel/plugin-transform-literals")
  }
  if (!isSupportedOnRuntime("transform-new-target")) {
    babelPluginStructure[
      "transform-new-target"
    ] = require("@babel/plugin-transform-new-target")
  }
  if (!isSupportedOnRuntime("transform-object-super")) {
    babelPluginStructure[
      "transform-object-super"
    ] = require("@babel/plugin-transform-object-super")
  }
  if (!isSupportedOnRuntime("transform-parameters")) {
    babelPluginStructure[
      "transform-parameters"
    ] = require("@babel/plugin-transform-parameters")
  }
  if (!isSupportedOnRuntime("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      require("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ]
  }
  if (!isSupportedOnRuntime("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      require("@babel/plugin-transform-shorthand-properties"),
    ]
  }
  if (!isSupportedOnRuntime("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      require("@babel/plugin-transform-spread"),
    ]
  }
  if (!isSupportedOnRuntime("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      require("@babel/plugin-transform-sticky-regex"),
    ]
  }
  if (!isSupportedOnRuntime("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      require("@babel/plugin-transform-template-literals"),
    ]
  }
  if (!isSupportedOnRuntime("transform-typeof-symbol")) {
    babelPluginStructure["transform-typeof-symbol"] = [
      require("@babel/plugin-transform-typeof-symbol"),
    ]
  }
  if (!isSupportedOnRuntime("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      require("@babel/plugin-transform-unicode-regex"),
    ]
  }
  return babelPluginStructure
}
