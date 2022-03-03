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

import { babelPluginCompatMap } from "./babel_plugins_compatibility.js"
import { babelHelperNameFromUrl } from "./babel_helper/babel_helper_directory.js"

const require = createRequire(import.meta.url)

export const getBaseBabelPluginStructure = ({ url, isSupportedOnRuntime }) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupportedOnRuntime(
      babelPluginName,
      babelPluginCompatMap[babelPluginName],
    )
  }

  const babelPluginStructure = {}
  if (isBabelPluginNeeded("proposal-numeric-separator")) {
    babelPluginStructure[
      "proposal-numeric-separator"
    ] = require("@babel/plugin-proposal-numeric-separator")
  }
  if (isBabelPluginNeeded("proposal-json-strings")) {
    babelPluginStructure[
      "proposal-json-strings"
    ] = require("@babel/plugin-proposal-json-strings")
  }
  if (isBabelPluginNeeded("proposal-object-rest-spread")) {
    babelPluginStructure[
      "proposal-object-rest-spread"
    ] = require("@babel/plugin-proposal-object-rest-spread")
  }
  if (isBabelPluginNeeded("proposal-optional-catch-binding")) {
    babelPluginStructure[
      "proposal-optional-catch-binding"
    ] = require("@babel/plugin-proposal-optional-catch-binding")
  }
  if (isBabelPluginNeeded("proposal-unicode-property-regex")) {
    babelPluginStructure[
      "proposal-unicode-property-regex"
    ] = require("@babel/plugin-proposal-unicode-property-regex")
  }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      require("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "simple",
      },
    ]
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure[
      "transform-arrow-functions"
    ] = require("@babel/plugin-transform-arrow-functions")
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure[
      "transform-block-scoped-functions"
    ] = require("@babel/plugin-transform-block-scoped-functions")
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure[
      "transform-block-scoping"
    ] = require("@babel/plugin-transform-block-scoping")
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure[
      "transform-classes"
    ] = require("@babel/plugin-transform-classes")
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure[
      "transform-computed-properties"
    ] = require("@babel/plugin-transform-computed-properties")
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure[
      "transform-destructuring"
    ] = require("@babel/plugin-transform-destructuring")
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure[
      "transform-dotall-regex"
    ] = require("@babel/plugin-transform-dotall-regex")
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure[
      "transform-duplicate-keys"
    ] = require("@babel/plugin-transform-duplicate-keys")
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure[
      "transform-exponentiation-operator"
    ] = require("@babel/plugin-transform-exponentiation-operator")
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure[
      "transform-for-of"
    ] = require("@babel/plugin-transform-for-of")
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure[
      "transform-function-name"
    ] = require("@babel/plugin-transform-function-name")
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure[
      "transform-literals"
    ] = require("@babel/plugin-transform-literals")
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure[
      "transform-new-target"
    ] = require("@babel/plugin-transform-new-target")
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure[
      "transform-object-super"
    ] = require("@babel/plugin-transform-object-super")
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure[
      "transform-parameters"
    ] = require("@babel/plugin-transform-parameters")
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      require("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ]
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      require("@babel/plugin-transform-shorthand-properties"),
    ]
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      require("@babel/plugin-transform-spread"),
    ]
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      require("@babel/plugin-transform-sticky-regex"),
    ]
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      require("@babel/plugin-transform-template-literals"),
    ]
  }
  if (isBabelPluginNeeded("transform-typeof-symbol")) {
    const babelHelperName = babelHelperNameFromUrl(url)
    // prevent babel to retransform "typeof" itself
    if (babelHelperName !== "typeof") {
      babelPluginStructure["transform-typeof-symbol"] = [
        require("@babel/plugin-transform-typeof-symbol"),
      ]
    }
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      require("@babel/plugin-transform-unicode-regex"),
    ]
  }
  return babelPluginStructure
}
