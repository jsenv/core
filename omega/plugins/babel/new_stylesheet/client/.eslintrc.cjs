const eslintConfig = require("../../.eslintrc.cjs")

// babel helpers are copy pasted from the babel repository
Object.assign(eslintConfig.rules, {
  "eqeqeq": ["off"],
  "no-eq-null": ["off"],
  "no-undef-init": ["off"],
  "dot-notation": ["off"],
  "consistent-return": ["off"],
  "one-var": ["off"],
  "object-shorthand": ["off"],
  "no-return-assign": ["off"],
  "prefer-template": ["off"],
  "prefer-rest-params": ["off"],
  "no-void": ["off"],
  "no-implicit-coercion": ["off"],
  "prefer-spread": ["off"],
  "no-loop-func": ["off"],
  "no-negated-condition": ["off"],
  "no-func-assign": ["off"],
  "no-else-return": ["off"],
})

module.exports = eslintConfig
