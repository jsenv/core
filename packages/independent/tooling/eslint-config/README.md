# eslint-config [![npm package](https://img.shields.io/npm/v/@jsenv/eslint-config.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/eslint-config)

ESLint config file consists into a single **big** object. This package allows to split this object to compose and reuse them.

- :+1: Part of configuration that belongs together can be regrouped
- :+1: ESLint configuration is easier to read

This is achieved by a function capable to compose subsets of ESLint configuration.

# composeEslintConfig

_composeEslintConfig_ is a function returning an eslint config object being the composition of eslint config objects passed in arguments.

```js
const {
  composeEslintConfig,
  eslintConfigBase,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  // first "group": enable html plugin
  {
    plugins: ["html"],
    settings: {
      extensions: [".html"],
    },
  },
  // second "group": enable react plugin
  {
    plugins: ["react"],
    settings: {
      extensions: [".jsx"],
    },
  },
);

module.exports = eslintConfig;
```

# Composable eslint configs

| ESLint config                                                                       | Description                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [eslintConfigBase](./src/eslintConfigBase.js)                                       | Enable latest js features                                          |
| [eslintConfigForPrettier](./src/eslintConfigForPrettier.js)                         | Disable eslint rules already handled by prettier                   |
| [eslintConfigToPreferExplicitGlobals](./src/eslintConfigToPreferExplicitGlobals.js) | Force code to use global variables explicitly; like `window.event` |

# Advanced configuration example

The following code is meant to be put into an _.eslintrc.cjs_ file and does the following:

1. Reuse jsenv configuration for ESLint rules
2. Use ESLint import plugin with a custom resolver
3. Consider files as written for node by default
4. Consider a subset of files as written for browsers
5. Use html plugin to enable linting of html files
6. Disable ESLint rules already handled by prettier

```cjs
const {
  composeEslintConfig,
  eslintConfigBase,
  jsenvEslintRules,
  jsenvEslintRulesForImport,
  eslintConfigToPreferExplicitGlobals,
  eslintConfigForPrettier,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  {
    rules: {
      ...jsenvEslintRules,
      "operator-assignment": ["error", "always"], // override jsenv rules
    },
  },
  // import plugin
  {
    plugins: ["import"],
    settings: {
      "import/resolver": {
        "@jsenv/eslint-import-resolver": {
          rootDirectoryUrl: __dirname,
          packageConditions: ["node", "import"],
        },
      },
      "import/extensions": [".js", ".mjs"],
    },
    rules: jsenvEslintRulesForImport,
  },
  // files are written for Node.js by default
  {
    env: {
      node: true,
    },
  },
  // package is "type": "module" so:
  // 1. disable commonjs globals by default
  // 2. Re-enable commonjs into *.cjs files
  {
    globals: {
      __filename: "off",
      __dirname: "off",
      require: "off",
      exports: "off",
    },
    overrides: [
      {
        files: ["**/*.cjs"],
        env: {
          commonjs: true,
        },
        // inside *.cjs files. restore commonJS "globals"
        globals: {
          __filename: true,
          __dirname: true,
          require: true,
          exports: true,
        },
      },
    ],
  },
  // several files are written for browsers, not Node.js
  {
    overrides: [
      {
        files: ["**/**/*.html", "**/src/**/*.js"],
        env: {
          browser: true,
          node: false,
        },
        settings: {
          "import/resolver": {
            "@jsenv/eslint-import-resolver": {
              rootDirectoryUrl: __dirname,
              packageConditions: ["browser", "import"],
            },
          },
        },
      },
    ],
  },
  // html plugin
  {
    plugins: ["html"],
    settings: {
      extensions: [".html"],
    },
  },
  eslintConfigToPreferExplicitGlobals,
  // We are using prettier, disable all eslint rules
  // already handled by prettier.
  eslintConfigForPrettier,
);

module.exports = eslintConfig;
```

The above configuration uses [@jsenv/eslint-import-resolver](https://github.com/jsenv/core/tree/main/packages/eslint-import-resolver) to resolve import so it needs to be installed.

```console
npm install --save-dev @jsenv/eslint-import-resolver
```

## Composable ESLint rules

| Rules                                                           | Description                                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [jsenvEslintRules](./src/jsenvEslintRules.js)                   | jsenv rules for ESLint                                                                                          |
| [jsenvEslintRulesForImport](./src/jsenvEslintRulesForImport.js) | jsenv rules for [eslint-plugin-import](https://github.com/benmosher/eslint-plugin-import)                       |
| [jsenvEslintRulesForReact](./src/jsenvEslintRulesForReact.js)   | jsenv rules for project using react and [eslint-plugin-react](https://github.com/yannickcr/eslint-plugin-react) |

# Common use cases

## Top level await

It will be supported by default in ESLint 8. Until then you need:

1. `"@babel/eslint-parser"` and `"@babel/core"` in your devDependencies
2. Configure ESLint parser to `"@babel/eslint-parser"`

```console
npm install --save-dev @babel/eslint-parser
npm install --save-dev @babel/core
```

_.eslintrc.cjs:_

```js
const {
  composeEslintConfig,
  eslintConfigBase,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  // use "@babel/eslint-parser" until top level await is supported by ESLint default parser
  {
    parser: "@babel/eslint-parser",
    parserOptions: {
      requireConfigFile: false,
    },
  },
);

module.exports = eslintConfig;
```

## React

```js
const {
  composeEslintConfig,
  eslintConfigBase,
  jsenvEslintRulesForReact,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  // react
  {
    plugins: ["react"],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: jsenvEslintRulesForReact,
  },
);

module.exports = eslintConfig;
```

## JSX

1. `"@babel/eslint-parser"` and `"@babel/plugin-syntax-jsx"` in your devDependencies
2. Enable `@babel/plugin-syntax-jsx` in babel config file
3. Configure ESLint parser to `"@babel/eslint-parser"`

```console
npm install --save-dev @babel/eslint-parser
npm install --save-dev @babel/plugin-syntax-jsx
```

_babel.config.cjs:_

```js
const babelPluginSyntaxJSX = require("@babel/plugin-syntax-jsx");

module.exports = {
  plugins: [
    [
      babelPluginSyntaxJSX,
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
};
```

_.eslintrc.cjs:_

```js
const {
  composeEslintConfig,
  eslintConfigBase,
  jsenvEslintRulesForReact,
} = require("@jsenv/eslint-config");

const eslintConfig = composeEslintConfig(
  eslintConfigBase,
  // jsx
  {
    parser: "@babel/eslint-parser",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
    settings: {
      extensions: [".jsx"],
    },
  },
);

module.exports = eslintConfig;
```

## HTML in VSCode

In `".vscode/settings.json"` file, add

```json
"eslint.validate": ["javascript", "html"]
```
