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
    "proposal-numeric-separator",
    "proposal-json-strings",
    "proposal-object-rest-spread",
    "proposal-optional-catch-binding",
    "proposal-optional-chaining",
    "proposal-unicode-property-regex",
    "transform-async-to-promises",
    "transform-arrow-functions",
    "transform-block-scoped-functions",
    "transform-block-scoping",
    "transform-classes",
    "transform-computed-properties",
    "transform-destructuring",
    "transform-dotall-regex",
    "transform-duplicate-keys",
    "transform-exponentiation-operator",
    "transform-for-of",
    "transform-function-name",
    "transform-literals",
    "transform-new-target",
    "transform-object-super",
    "transform-parameters",
  )

  const {
    asyncGenerators = true,
    generators = true,
    async = false,
  } = transformRegeneratorOptions
  plugins.push([
    "transform-regenerator",
    {
      asyncGenerators,
      generators,
      async,
    },
  ])

  plugins.push(
    "transform-shorthand-properties",
    "transform-spread",
    "transform-sticky-regex",
    "transform-template-literals",
    "transform-typeof-symbol",
    "transform-unicode-regex",
  )

  return { plugins }
}
