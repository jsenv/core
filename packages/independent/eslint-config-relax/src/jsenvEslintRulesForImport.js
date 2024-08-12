/*
 * Contains configuration of ESLint rules when using eslint-plugin-import.
 *
 * Check ./jsenvEslintRules.js to see the mindset used  to configure these rules
 */

export const jsenvEslintRulesForImport = {
  "import-x/default": ["error"],
  "import-x/no-unresolved": [
    "error",
    {
      commonjs: true,
      amd: false,
      caseSensitive: false,
    },
  ],
  "import-x/named": ["error"],
  "import-x/namespace": ["error", { allowComputed: true }],
  "import-x/no-absolute-path": ["off"],
  "import-x/no-dynamic-require": ["error"],
  "import-x/export": ["error"],
  "import-x/no-named-as-default": ["warn"],
  "import-x/first": ["warn"],
  "import-x/no-duplicates": ["warn"],
  "import-x/newline-after-import": ["warn"],
  // "import-x/max-dependencies" is not super useful
  // Either you will disable the eslint rule because it's "normal"
  // to have a lot of dependencies or feel compelled to reduce the number of imports.
  // It's already visible that a file has many imports and that ideally they should be
  // less imports, no need for ESLint, let's keep ESLint for more valuable things.
  "import-x/max-dependencies": ["off", { max: 10 }],
  "import-x/no-anonymous-default-export": [
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
  "import-x/no-self-import": ["error"],
  "import-x/no-cycle": ["error"],
  "import-x/no-useless-path-segments": ["error"],
  "import-x/no-default-export": ["error"],
};
