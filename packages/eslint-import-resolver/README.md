# @jsenv/eslint-import-resolver [![npm package](https://img.shields.io/npm/v/@jsenv/eslint-import-resolver.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/eslint-import-resolver)

Implement Node.js import resolution algorithm for ESLint.

# Usage

This section shows how to create a very basic ESLint configuration doing the following:

1. Enable [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import)
2. Enable [import/no-unresolved](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-unresolved.md)
3. Configure [import/resolver](https://github.com/import-js/eslint-plugin-import#resolvers) with `@jsenv/eslint-import-resolver`

```console
npm install --save-dev eslint-plugin-import
npm install --save-dev @jsenv/eslint-import-resolver
```

```cjs
// .eslintrc.cjs
module.exports = {
  plugins: ["import"],
  rules: {
    "import/no-unresolved": ["error"],
  },
  settings: {
    "import/resolver": {
      "@jsenv/eslint-import-resolver": {
        rootDirectoryUrl: __dirname,
        packageConditions: ["browser", "import"],
      },
    },
  },
}
```

See also https://github.com/jsenv/eslint-config#advanced-configuration-example
