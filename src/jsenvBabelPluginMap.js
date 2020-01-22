/* eslint-disable import/max-dependencies */

import { require } from "./internal/require.js"

const proposalJSONStrings = require("@babel/plugin-proposal-json-strings")
const proposalObjectRestSpread = require("@babel/plugin-proposal-object-rest-spread")
const proposalOptionalCatchBinding = require("@babel/plugin-proposal-optional-catch-binding")
const proposalUnicodePropertyRegex = require("@babel/plugin-proposal-unicode-property-regex")
const syntaxObjectRestSpread = require("@babel/plugin-syntax-object-rest-spread")
const syntaxOptionalCatchBinding = require("@babel/plugin-syntax-optional-catch-binding")
const transformArrowFunction = require("@babel/plugin-transform-arrow-functions")
const transformAsyncToPromises = require("babel-plugin-transform-async-to-promises")
const transformBlockScopedFunctions = require("@babel/plugin-transform-block-scoped-functions")
const transformBlockScoping = require("@babel/plugin-transform-block-scoping")
const transformClasses = require("@babel/plugin-transform-classes")
const transformComputedProperties = require("@babel/plugin-transform-computed-properties")
const transformDestructuring = require("@babel/plugin-transform-destructuring")
const transformDotAllRegex = require("@babel/plugin-transform-dotall-regex")
const transformDuplicateKeys = require("@babel/plugin-transform-duplicate-keys")
const transformExponentiationOperator = require("@babel/plugin-transform-exponentiation-operator")
const transformForOf = require("@babel/plugin-transform-for-of")
const transformFunctionName = require("@babel/plugin-transform-function-name")
const transformLiterals = require("@babel/plugin-transform-literals")
const transformNewTarget = require("@babel/plugin-transform-new-target")
const transformObjectSuper = require("@babel/plugin-transform-object-super")
const transformParameters = require("@babel/plugin-transform-parameters")
const transformRegenerator = require("@babel/plugin-transform-regenerator")
const transformShorthandProperties = require("@babel/plugin-transform-shorthand-properties")
const transformSpread = require("@babel/plugin-transform-spread")
const transformStickyRegex = require("@babel/plugin-transform-sticky-regex")
const transformTemplateLiterals = require("@babel/plugin-transform-template-literals")
const transformTypeOfSymbol = require("@babel/plugin-transform-typeof-symbol")
const transformUnicodeRegex = require("@babel/plugin-transform-unicode-regex")

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
