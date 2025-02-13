/**
 * This ESLint config object is setting a list of rules to "off" as they will be already handled by prettier.
 * To ensure rules remains configured to "off", keep eslintConfigForPrettier low, ideally last during eslint composition
 *
 * See also https://github.com/prettier/eslint-config-prettier/blob/master/index.js
 */

export const eslintConfigForPrettier = {
  rules: {
    "arrow-parens": ["off"],
    "arrow-spacing": ["off"],
    "brace-style": ["off"],
    "comma-dangle": ["off"],
    "comma-style": ["off"],
    "computed-property-spacing": ["off"],
    "curly": ["off"],
    "dot-location": ["off"],
    "eol-last": ["off"],
    "generator-star-spacing": ["off"],
    "indent": ["off"],
    "jsx-quotes": ["off"],
    "key-spacing": ["off"],
    "keyword-spacing": ["off"],
    "max-len": ["off"],
    "no-confusing-arrow": ["off"], // prettier makes it non confusing
    "no-extra-semi": ["off"],
    "no-floating-decimal": ["off"],
    "no-mixed-spaces-and-tabs": ["off"],
    "no-multi-spaces": ["off"],
    "no-multi-str": ["off"],
    "no-multiple-empty-lines": ["off"],
    "no-trailing-spaces": ["off"],
    "no-unexpected-multiline": ["off"],
    "no-whitespace-before-property": ["off"],
    "object-curly-spacing": ["off"],
    "one-var-declaration-per-line": ["off"],
    "operator-linebreak": ["off"],
    "padded-blocks": ["off"],
    "quote": ["off"],
    "quote-props": ["off"],
    "semi": ["off"],
    "semi-spacing": ["off"],
    "space-before-blocks": ["off"],
    "space-before-function-paren": ["off"],
    "space-in-parens": ["off"],
    "space-infix-ops": ["off"],
    "template-curly-spacing": ["off"],
    "wrap-iife": ["off"],
    "yield-star-spacing": ["off"],
  },
};
