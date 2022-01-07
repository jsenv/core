## Configuring jsenv for TypeScript (experimental)

```console
npm i --save-dev @babel/plugin-transform-typescript
```

_babel.config.cjs for TypeScript_:

```js
module.exports = {
  presets: ["@jsenv/babel-preset"],
  plugins: [
    [
      "@babel/plugin-transform-typescript",
      {
        allowNamespaces: true,
      },
    ],
  ],
}
```
