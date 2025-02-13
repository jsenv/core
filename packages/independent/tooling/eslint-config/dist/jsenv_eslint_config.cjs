'use strict';

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const composeTwoObjects = (first, second, composerMap) => {
  const composed = {};

  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  Object.keys(first).forEach((key) => {
    composed[key] = secondKeys.includes(key)
      ? composeTwoValues(first[key], second[key], composerMap[key])
      : first[key];
  });
  Object.keys(second).forEach((key) => {
    if (!firstKeys.includes(key)) {
      composed[key] = second[key];
    }
  });

  return composed;
};

const composeTwoValues = (firstValue, secondValue, composer) => {
  if (composer) {
    return composer(firstValue, secondValue);
  }
  return secondValue;
};

const composeEslintConfig = (...eslintConfigs) => {
  return eslintConfigs.reduce((previous, current) => {
    const next = composeTwoEslintConfigs(previous, current);
    return next;
  }, {});
};

const composeTwoEslintConfigs = (firstEslintConfig, secondEslintConfig) => {
  return composeTwoObjects(firstEslintConfig, secondEslintConfig, {
    parserOptions: (firstParserOptions, secondParserOptions) => {
      return composeTwoObjects(firstParserOptions, secondParserOptions, {
        ecmaFeatures: (firstEcmaFeatures, secondEcmaFeatures) => {
          return {
            ...firstEcmaFeatures,
            ...secondEcmaFeatures,
          };
        },
      });
    },
    env: (firstEnv, secondEnv) => {
      return {
        ...firstEnv,
        ...secondEnv,
      };
    },
    globals: (firstGlobals, secondGlobals) => {
      return {
        ...firstGlobals,
        ...secondGlobals,
      };
    },
    plugins: (firstPlugins, secondPlugins) => {
      return [...firstPlugins, ...secondPlugins];
    },
    settings: (firstSettings, secondSettings) => {
      return composeTwoObjects(firstSettings, secondSettings, {
        extensions: (firstExtensions, secondExtensions) => {
          return [...firstExtensions, ...secondExtensions];
        },
      });
    },
    rules: (firstRules, secondRules) => {
      return {
        ...firstRules,
        ...secondRules,
      };
    },
    overrides: (firstOverrides, secondOverrides) => {
      return [...firstOverrides, ...secondOverrides];
    },
  });
};

/**
 * This super basic ESLint configuration to parse latest js
 */

const eslintConfigBase = {
  parserOptions: {
    sourceType: "module",
  },
  env: {
    es2022: true,
  },
  settings: {
    extensions: [".js", ".mjs"],
  },
};

/**
 * This ESLint config object is setting a list of rules to "off" as they will be already handled by prettier.
 * To ensure rules remains configured to "off", keep eslintConfigForPrettier low, ideally last during eslint composition
 *
 * See also https://github.com/prettier/eslint-config-prettier/blob/master/index.js
 */

const eslintConfigForPrettier = {
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

/*
 * ESLint rightfully consider some globals as available but in practice it prevents to catch bugs.
 * It's better for human devs to configure ESLint so that "close" or "event" are undefined by default.
 * If one day code needs to use the global variable you can still write window.close or window.event.
 *
 * See also
 * - https://github.com/eslint/eslint/blob/00d2c5be9a89efd90135c4368a9589f33df3f7ba/conf/environments.js#L1
 * - https://github.com/sindresorhus/globals/blob/a1d32c7f76e4d1ac3c8883acf075db11bd4d44f9/globals.json#L1
 *
 */

const eslintConfigToPreferExplicitGlobals = {
  globals: {
    alert: "off",
    atob: "off",
    blur: "off",
    btoa: "off",
    caches: "off",
    close: "off",
    closed: "off",
    crypto: "off",
    defaultstatus: "off",
    defaultStatus: "off",
    escape: "off",
    event: "off",
    external: "off",
    focus: "off",
    find: "off",
    frames: "off",
    history: "off",
    length: "off",
    location: "off",
    menubar: "off",
    name: "off",
    navigator: "off",
    open: "off",
    origin: "off",
    print: "off",
    screen: "off",
    scroll: "off",
    status: "off",
    stop: "off",
    top: "off",
    unescape: "off",
    valueOf: "off",
  },
};

/*
 * Contains configuration of many ESLint rules with the following mindset:
 * 1. ESLint should fail only for important things
 * 2. ESLint should be silent as long as nothing critical is detected
 * 3. When code is slighly modified to test/debug something, please ESLint, let me do without
 *    bothering me with "best practices" and stuff
 *
 * Notes:
 * - Point 3. is the reason why rules like "prefer-const" are disabled
 * - It's on purpose that point "2." is an other way of phrasing "1."
 * - There is a few exception to mindset, for example "no-eval" is not really
 *   critical but the rule is still enabled
 *
 * See also:
 * - https://eslint.org/docs/rules/
 */

const jsenvEslintRules = {
  "accessor-pairs": ["error"],
  "array-bracket-spacing": ["error", "never"],
  "array-callback-return": ["error"],
  "arrow-parens": ["error", "as-needed"],
  "arrow-spacing": ["error", { before: true, after: true }],
  "block-scoped-var": ["error"],
  "brace-style": ["error", "stroustrup"],
  "camelcase": [
    "off",
    {
      properties: "always",
    },
  ],
  "comma-dangle": [
    "error",
    {
      arrays: "only-multiline",
      objects: "only-multiline",
      imports: "only-multiline",
      exports: "only-multiline",
      functions: "only-multiline",
    },
  ],
  "comma-spacing": [
    "error",
    {
      before: false,
      after: true,
    },
  ],
  "comma-style": ["error", "last"],
  "computed-property-spacing": ["error", "never"],
  "consistent-return": ["error"],
  "constructor-super": ["error"],
  "curly": ["error"],
  "default-case": ["error"],
  "dot-location": ["error", "property"],
  "dot-notation": ["error"],
  "eol-last": ["off"],
  "eqeqeq": ["error"],
  "generator-star-spacing": ["error", "both"],
  "getter-return": ["error"],
  "grouped-accessor-pairs": ["error"],
  "guard-for-in": ["error"],
  "handle-callback-err": ["warn"],
  /**
   * "tab" is theorically a better option so that people can choose identation width.
   * Because it allow them to decide how much space a tab char takes (2, 4, 100) in their environment
   * But it comes with several issue:
   * - By default github will render a tab with 8 spaces
   * (can be fixed thank to an .editorconfig at the root of the github project (see http://stackoverflow.com/a/33831598)
   * - A user cannot globally defined how much space a tab should take
   * In a perfect world it would be an operating system setting that browser
   * would follow.
   *
   * In practice spaces cause less troubles.
   */
  "indent": ["error", 2, { SwitchCase: 1 }],
  "jsx-quotes": ["error"],
  "key-spacing": [
    "error",
    {
      beforeColon: false,
      afterColon: true,
    },
  ],
  "keyword-spacing": ["error"],
  // disabled otherwise fails when eslint is runned on windows
  // after a git clone
  "linebreak-style": ["off", "unix"],
  "max-len": [
    "warn",
    120,
    4,
    {
      ignoreComments: true,
      ignoreUrls: true,
      ignorePattern: "^\\s*var\\s.+=\\s.+\\/.*?\\/;$",
    },
  ],
  "max-nested-callbacks": ["warn", 4],
  "new-cap": [
    "error",
    {
      newIsCap: true,
      capIsNew: false,
    },
  ],
  "new-parens": ["error"],
  "no-alert": ["error"],
  "no-array-constructor": ["error"],
  "no-caller": ["error"],
  "no-case-declarations": ["error"],
  "no-class-assign": ["error"],
  "no-cond-assign": ["error"],
  "no-confusing-arrow": ["error"],
  "no-const-assign": ["error"],
  "no-constant-condition": ["error"],
  "no-constant-binary-expression": ["error"],
  "no-constructor-return": ["error"],
  "no-control-regex": ["error"],
  "no-debugger": process.env.CI ? ["error"] : ["off"],
  "no-delete-var": ["error"],
  "no-div-regex": ["error"],
  "no-dupe-args": ["error"],
  "no-duplicate-case": ["error"],
  "no-dupe-class-members": ["error"],
  "no-dupe-else-if": ["error"],
  "no-dupe-keys": ["error"],
  "no-else-return": ["error"],
  "no-empty-character-class": ["error"],
  "no-empty-pattern": ["error"],
  "no-eq-null": ["error"],
  "no-extend-native": ["error"],
  "no-ex-assign": ["error"],
  "no-extra-bind": ["error"],
  "no-extra-boolean-cast": ["error"],
  "no-extra-label": ["error"],
  "no-extra-semi": ["off"],
  // At first I wanted to disable "no-eval" because every one knows eval is a bad idea
  // so when it's used it's always for a good reason.
  // But on second thought it's better to disable the rule
  // locally using "//eslint-disable-next-line no-eval" in that case
  "no-eval": ["error"],
  "no-fallthrough": ["error"],
  "no-floating-decimal": ["error"],
  "no-func-assign": ["error"],
  "no-inner-declarations": ["error"],
  "no-invalid-regexp": ["error"],
  "no-implicit-coercion": ["error"],
  "no-implicit-globals": ["error"],
  "no-implied-eval": ["error"],
  "no-irregular-whitespace": ["error"],
  "no-iterator": ["error"],
  "no-label-var": ["error"],
  "no-labels": ["off"], // https://gist.github.com/getify/706e5e10822a298375da40f9cc1fa295
  "no-lone-blocks": ["off"], // https://gist.github.com/getify/706e5e10822a298375da40f9cc1fa295
  "no-lonely-if": ["error"],
  "no-loop-func": ["error"],
  "no-magic-numbers": ["off"],
  "no-mixed-requires": ["error", { grouping: true, allowCall: true }],
  "no-mixed-spaces-and-tabs": ["error"],
  "no-multi-spaces": ["error"],
  "no-multi-str": ["error"],
  "no-multiple-empty-lines": ["off", { max: 1 }],
  "no-native-reassign": ["error"],
  "no-negated-condition": ["error"],
  // disabled because deprecated in favor of no-unsafe-negation
  // https://eslint.org/docs/rules/no-negated-in-lhs
  "no-negated-in-lhs": ["off"],
  // I prefer when ESLint really has something to say
  // nested ternary are not wrong, especially when prettier
  // format them correctly
  // In the end, they often gets transformed to helper function
  // but in the meantime eslint is complaining
  "no-nested-ternary": ["off"],
  "no-new": ["error"],
  "no-new-func": ["error"],
  "no-new-require": ["error"],
  "no-new-object": ["error"],
  "no-new-symbol": ["error"],
  "no-new-wrappers": ["error"],
  "no-obj-calls": ["error"],
  "no-octal": ["error"],
  "no-octal-escape": ["error"],
  "no-path-concat": ["error"],
  "no-proto": ["error"],
  "no-redeclare": ["error"],
  "no-regex-spaces": ["error"],
  "no-restricted-imports": [
    "error",
    "domain",
    "freelist",
    "smalloc",
    "sys",
    "colors",
  ],
  "no-restricted-modules": [
    "error",
    "domain",
    "freelist",
    "smalloc",
    "sys",
    "colors",
  ],
  "no-restricted-syntax": ["error", "WithStatement"],
  "no-return-assign": ["error", "always"],
  "no-setter-return": ["error"],
  "no-script-url": ["error"],
  "no-self-assign": ["error"],
  "no-self-compare": ["error"],
  "no-sequences": ["error"],
  "no-shadow-restricted-names": ["error"],
  "no-spaced-func": ["error"],
  "no-sparse-arrays": ["error"],
  "no-this-before-super": ["error"],
  "no-throw-literal": ["error"],
  "no-trailing-spaces": ["error"],
  "no-undef": ["error", { typeof: true }],
  "no-undef-init": ["error"],
  "no-undefined": ["off"],
  "no-unexpected-multiline": ["error"],
  "no-unmodified-loop-condition": ["error"],
  "no-unneeded-ternary": ["error"],
  "no-unreachable": ["error"],
  "no-unused-expressions": ["error"],
  "no-unused-labels": ["off"], // https://gist.github.com/getify/706e5e10822a298375da40f9cc1fa295
  "no-unused-private-class-members": ["error"],
  "no-unused-vars": ["error"],
  "no-use-before-define": [
    "error",
    /*
     * "no-use-before-define" is great to prevent a common mistake
     * where code tries to use a variable before it's actually available.
     * In practice this rule fails even on valid code.
     * Enabling the default options of this rule would
     * force variables,functions and classes to be declared in specific order
     * which is very annoying because:
     * - code is valid in the first place
     * - it's SUPER NICE to put variables and functions that are
     *   implementation details at the bottom of the file to make
     *   important code more accesible
     */
    {
      functions: false,
      variables: false,
      classes: false,
      allowNamedExports: true,
    },
  ],
  "no-useless-call": ["error"],
  "no-useless-concat": ["error"],
  "no-useless-constructor": ["error"],
  "no-void": ["error"],
  "no-warning-comments": ["off"],
  "no-whitespace-before-property": ["error"],
  "no-with": ["error"],
  "object-curly-spacing": ["error", "always"],
  "object-shorthand": ["warn", "always"],
  "one-var": ["error", "never"],
  "one-var-declaration-per-line": ["error"],
  // Sometimes I prefer to write toto = toto + 1
  // instead of toto++ for whatever reason
  // and having ESLint to complain is annoying
  // I prefer when ESLint really has something to say
  "operator-assignment": ["off", "always"],
  "operator-linebreak": [
    "error",
    "after",
    {
      overrides: { "?": "ignore", ":": "ignore" },
    },
  ],
  "padded-blocks": ["error", "never"],
  // I prefer to use const to indicate immediatly to the reader
  // that this variable is never re-assigned. let becomes
  // the exception and it helps to understand the code.
  // However during development a variable gets used once
  // and should be const, then you reuse it, and should be let.
  // I prefer ESLint to stay quiet during these moments.
  // I already got the habit of using const and would not care
  // if some let where to stay by mistake.
  "prefer-const": [
    "off",
    {
      destructuring: "all",
      ignoreReadBeforeAssign: true,
    },
  ],
  // Math.pow is cool, why being so strict ?
  "prefer-exponentiation-operator": ["off"],
  "prefer-rest-params": ["warn"],
  "prefer-spread": ["warn"],
  "prefer-template": ["warn"],
  "quote": [
    // disabled because it becomes painfull when switching
    // between "" and `` (template literals)
    "off",
    // double because closer to .json, this it increase compatibility between .js and .json
    // also because ' are often used in english and '' would lead to 'I\'m' VS "I'm"
    "double",
  ],
  "quote-props": [
    "error",
    "as-needed",
    {
      keywords: false,
      numbers: true,
      // unnecessary: false so that when you fall into edge cases
      // you can use the quoting style you want
      unnecessary: false,
    },
  ],
  "semi": ["error", "always"],
  "semi-spacing": [
    "error",
    {
      before: false,
      after: true,
    },
  ],
  "space-before-blocks": ["error", "always"],
  "space-before-function-paren": ["error", "never"],
  "space-in-parens": ["error", "never"],
  "space-infix-ops": ["error"],
  "space-unary-ops": ["error"],
  "spaced-comment": [
    "error",
    "always",
    {
      markers: ["!"],
    },
  ],
  "template-curly-spacing": ["error"],
  "use-isnan": ["error"],
  "valid-jsdoc": [
    "off",
    {
      requireReturn: false,
      prefer: {
        returns: "return",
      },
    },
  ],
  "valid-typeof": ["error"],
  "wrap-iife": ["error", "inside"],
  "yield-star-spacing": ["error", "both"],
  "yoda": ["error"],
};

/*
 * Contains configuration of ESLint rules when using eslint-plugin-import.
 *
 * Check ./jsenvEslintRules.js to see the mindset used  to configure these rules
 */

const jsenvEslintRulesForImport = {
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
};

/*
 * Contains configuration of ESLint rules when using eslint-plugin-react.
 *
 * Check ./jsenvEslintRules.js to see the mindset used  to configure these rules
 */

const jsenvEslintRulesForReact = {
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
};

exports.composeEslintConfig = composeEslintConfig;
exports.eslintConfigBase = eslintConfigBase;
exports.eslintConfigForPrettier = eslintConfigForPrettier;
exports.eslintConfigToPreferExplicitGlobals = eslintConfigToPreferExplicitGlobals;
exports.jsenvEslintRules = jsenvEslintRules;
exports.jsenvEslintRulesForImport = jsenvEslintRulesForImport;
exports.jsenvEslintRulesForReact = jsenvEslintRulesForReact;
//# sourceMappingURL=jsenv_eslint_config.cjs.map
