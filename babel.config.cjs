// Jsenv uses many standard features such as const, spread operator, arrow function etc
// Jsenv internal files might execute in old environments without these features
// And we don't jnow in advance in which environments
// This is why the babel config below enables every standard babel plugins

module.exports = {
  plugins: [
    "@babel/plugin-proposal-json-strings",
    "@babel/plugin-proposal-numeric-separator",
    "@babel/plugin-proposal-object-rest-spread",
    "@babel/plugin-proposal-optional-catch-binding",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-unicode-property-regex",
    "@babel/plugin-syntax-object-rest-spread",
    "@babel/plugin-syntax-optional-catch-binding",
    "@babel/plugin-transform-arrow-functions",
    "babel-plugin-transform-async-to-promises",
    "@babel/plugin-transform-block-scoped-functions",
    "@babel/plugin-transform-block-scoping",
    "@babel/plugin-transform-classes",
    "@babel/plugin-transform-computed-properties",
    "@babel/plugin-transform-destructuring",
    "@babel/plugin-transform-dotall-regex",
    "@babel/plugin-transform-duplicate-keys",
    "@babel/plugin-transform-exponentiation-operator",
    "@babel/plugin-transform-for-of",
    "@babel/plugin-transform-function-name",
    "@babel/plugin-transform-literals",
    "@babel/plugin-transform-new-target",
    "@babel/plugin-transform-object-super",
    "@babel/plugin-transform-parameters",
    [
      "@babel/plugin-transform-regenerator",
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ],
    "@babel/plugin-transform-shorthand-properties",
    "@babel/plugin-transform-spread",
    "@babel/plugin-transform-sticky-regex",
    "@babel/plugin-transform-template-literals",
    "@babel/plugin-transform-typeof-symbol",
    "@babel/plugin-transform-unicode-regex",
  ],
}
