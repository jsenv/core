/*
 * Contains configuration of ESLint rules when using eslint-plugin-import.
 *
 * Check ./jsenvEslintRules.js to see the mindset used  to configure these rules
 */

export const jsenvEslintRulesForImport = {
  "import/default": ["error"],
  "import/no-unresolved": [
    "error",
    {
      commonjs: true,
      amd: false,
      caseSensitive: false,
    },
  ],
  "import/named": ["error"],
  "import/namespace": ["error", { allowComputed: true }],
  "import/no-absolute-path": ["off"],
  "import/no-dynamic-require": ["error"],
  "import/export": ["error"],
  "import/no-named-as-default": ["warn"],
  "import/first": ["warn"],
  "import/no-duplicates": ["warn"],
  "import/newline-after-import": ["warn"],
  // "import/max-dependencies" is not super useful
  // Either you will disable the eslint rule because it's "normal"
  // to have a lot of dependencies or feel compelled to reduce the number of imports.
  // It's already visible that a file has many imports and that ideally they should be
  // less imports, no need for ESLint, let's keep ESLint for more valuable things.
  "import/max-dependencies": ["off", { max: 10 }],
  "import/no-anonymous-default-export": [
    "off",
    {
      allowArray: true,
      allowArrowFunction: false,
      allowAnonymousClass: false,
      allowAnonymousFunction: false,
      allowLiteral: true,
      allowObject: true,
    },
  ],
  "import/no-self-import": ["error"],
  "import/no-cycle": ["error"],
  "import/no-useless-path-segments": ["error"],
  "import/no-default-export": ["error"],
}
