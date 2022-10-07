/*
 * Contains configuration of ESLint rules when using eslint-plugin-react.
 *
 * Check ./jsenvEslintRules.js to see the mindset used  to configure these rules
 */

export const jsenvEslintRulesForReact = {
  "react/display-name": ["error"],
  "react/jsx-key": ["error"],
  "react/jsx-filename-extension": ["error", { extensions: [".jsx"] }],
  "react/jsx-no-comment-textnodes": ["error"],
  "react/jsx-no-duplicate-props": ["error"],
  "react/jsx-no-target-blank": ["off"],
  "react/jsx-no-undef": ["error"],
  "react/jsx-uses-react": ["error"],
  "react/jsx-uses-vars": ["error"],
  "react/no-children-prop": ["error"],
  "react/no-danger-with-children": ["error"],
  "react/no-deprecated": ["error"],
  "react/no-direct-mutation-state": ["error"],
  "react/no-find-dom-node": ["error"],
  "react/no-is-mounted": ["error"],
  "react/no-render-return-value": ["error"],
  "react/no-string-refs": ["error"],
  "react/no-unescaped-entities": ["error"],
  "react/no-unknown-property": ["error"],
  "react/no-unsafe": ["off"],
  "react/prop-types": ["off"],
  "react/react-in-jsx-scope": ["error"],
  "react/require-render-return": ["off"],
}
