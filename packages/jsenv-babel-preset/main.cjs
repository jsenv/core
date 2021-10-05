/*
 * This file is used to configure a list of babel plugins as documented in
 * https://babeljs.io/docs/en/presets
 *
 * This list of babel plugins is meant to be used in project using jsenv.
 * It's almost equivalent to @babel/preset-env with the following differences:
 * - Prefer "transform-async-to-promises" over "transform-async-to-generator"
 *   It's because generator are more verbose and slow, see https://github.com/babel/babel/issues/8121
 * - List only babel plugins with at least one browser/runtime supporting the feature natively
 *
 * Jsenv decides to use a subset of babel plugins with the following logic:
 * - During dev babel plugins natively supported by browsers and Node.js are not used.
 * - During build:
 *   - When "runtimeSupport" is configured, babel plugins already supported by these runtime won't be used
 *     See https://github.com/jsenv/jsenv-template-pwa/blob/main/jsenv.config.mjs#L12
 *   - Otherwise all babel plugins are used
 */

module.exports = (api, { transformRegeneratorOptions = {} } = {}) => {
  const plugins = []

  plugins.push(
    "@babel/proposal-numeric-separator",
    "@babel/proposal-json-strings",
    "@babel/proposal-object-rest-spread",
    "@babel/proposal-optional-catch-binding",
    "@babel/proposal-optional-chaining",
    "@babel/proposal-unicode-property-regex",
    "babel-plugin-transform-async-to-promises",
    "@babel/transform-arrow-functions",
    "@babel/transform-block-scoped-functions",
    "@babel/transform-block-scoping",
    "@babel/transform-classes",
    "@babel/transform-computed-properties",
    "@babel/transform-destructuring",
    "@babel/transform-dotall-regex",
    "@babel/transform-duplicate-keys",
    "@babel/transform-exponentiation-operator",
    "@babel/transform-for-of",
    "@babel/transform-function-name",
    "@babel/transform-literals",
    "@babel/transform-new-target",
    "@babel/transform-object-super",
    "@babel/transform-parameters",
  )

  const {
    asyncGenerators = true,
    generators = true,
    async = false,
  } = transformRegeneratorOptions
  plugins.push([
    "@babel/transform-regenerator",
    {
      asyncGenerators,
      generators,
      async,
    },
  ])

  plugins.push(
    "@babel/transform-shorthand-properties",
    "@babel/transform-spread",
    "@babel/transform-sticky-regex",
    "@babel/transform-template-literals",
    "@babel/transform-typeof-symbol",
    "@babel/transform-unicode-regex",
  )

  return { plugins }
}
