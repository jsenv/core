/* eslint-disable import/max-dependencies */
const proposalJSONStrings = import.meta.require("@babel/plugin-proposal-json-strings")
const proposalObjectRestSpread = import.meta.require("@babel/plugin-proposal-object-rest-spread")
const proposalOptionalCatchBinding = import.meta.require(
  "@babel/plugin-proposal-optional-catch-binding",
)
const proposalUnicodePropertyRegex = import.meta.require(
  "@babel/plugin-proposal-unicode-property-regex",
)
const syntaxObjectRestSpread = import.meta.require("@babel/plugin-syntax-object-rest-spread")
const syntaxOptionalCatchBinding = import.meta.require(
  "@babel/plugin-syntax-optional-catch-binding",
)
const transformArrowFunction = import.meta.require("@babel/plugin-transform-arrow-functions")
const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const transformBlockScopedFunctions = import.meta.require(
  "@babel/plugin-transform-block-scoped-functions",
)
const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const transformClasses = import.meta.require("@babel/plugin-transform-classes")
const transformComputedProperties = import.meta.require(
  "@babel/plugin-transform-computed-properties",
)
const transformDestructuring = import.meta.require("@babel/plugin-transform-destructuring")
const transformDotAllRegex = import.meta.require("@babel/plugin-transform-dotall-regex")
const transformDuplicateKeys = import.meta.require("@babel/plugin-transform-duplicate-keys")
const transformExponentiationOperator = import.meta.require(
  "@babel/plugin-transform-exponentiation-operator",
)
const transformForOf = import.meta.require("@babel/plugin-transform-for-of")
const transformFunctionName = import.meta.require("@babel/plugin-transform-function-name")
const transformLiterals = import.meta.require("@babel/plugin-transform-literals")
const transformNewTarget = import.meta.require("@babel/plugin-transform-new-target")
const transformObjectSuper = import.meta.require("@babel/plugin-transform-object-super")
const transformParameters = import.meta.require("@babel/plugin-transform-parameters")
const transformRegenerator = import.meta.require("@babel/plugin-transform-regenerator")
const transformShorthandProperties = import.meta.require(
  "@babel/plugin-transform-shorthand-properties",
)
const transformSpread = import.meta.require("@babel/plugin-transform-spread")
const transformStickyRegex = import.meta.require("@babel/plugin-transform-sticky-regex")
const transformTemplateLiterals = import.meta.require("@babel/plugin-transform-template-literals")
const transformTypeOfSymbol = import.meta.require("@babel/plugin-transform-typeof-symbol")
const transformUnicodeRegex = import.meta.require("@babel/plugin-transform-unicode-regex")

export const jsenvBabelPluginMap = {
  "proposal-object-rest-spread": [proposalObjectRestSpread],
  "proposal-optional-catch-binding": [proposalOptionalCatchBinding],
  "proposal-unicode-property-regex": [proposalUnicodePropertyRegex],
  "proposal-json-strings": [proposalJSONStrings],
  "syntax-object-rest-spread": [syntaxObjectRestSpread],
  "syntax-optional-catch-binding": [syntaxOptionalCatchBinding],
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-arrow-functions": [transformArrowFunction],
  "transform-block-scoped-functions": [transformBlockScopedFunctions],
  "transform-block-scoping": [transformBlockScoping],
  "transform-classes": [transformClasses],
  "transform-computed-properties": [transformComputedProperties],
  "transform-destructuring": [transformDestructuring],
  "transform-dotall-regex": [transformDotAllRegex],
  "transform-duplicate-keys": [transformDuplicateKeys],
  "transform-exponentiation-operator": [transformExponentiationOperator],
  "transform-for-of": [transformForOf],
  "transform-function-name": [transformFunctionName],
  "transform-literals": [transformLiterals],
  "transform-new-target": [transformNewTarget],
  "transform-object-super": [transformObjectSuper],
  "transform-parameters": [transformParameters],
  "transform-regenerator": [
    transformRegenerator,
    {
      asyncGenerators: true,
      generators: true,
      async: false,
    },
  ],
  "transform-shorthand-properties": [transformShorthandProperties],
  "transform-spread": [transformSpread],
  "transform-sticky-regex": [transformStickyRegex],
  "transform-template-literals": [transformTemplateLiterals],
  "transform-typeof-symbol": [transformTypeOfSymbol],
  "transform-unicode-regex": [transformUnicodeRegex],
}
