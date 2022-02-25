# @jsenv/babel-preset [![npm package](https://img.shields.io/npm/v/@jsenv/babel-preset.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/babel-preset)

`@jsenv/babel-preset` is equivalent to [@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env) with the following differences:

1 - Prefer [transform-async-to-promises](https://www.npmjs.com/package/babel-plugin-transform-async-to-promises) over [transform-async-to-generator](https://babeljs.io/docs/en/babel-plugin-transform-async-to-generator) [^1]

2 - List only babel plugins with at least one browser implementing the feature

[^1]: This is because generator are more verbose and slow than promises. See https://github.com/babel/babel/issues/8121

## Usage

```console
npm install --save-dev @jsenv/babel-preset
```

_babel.config.cjs:_

```js
module.exports = {
  presets: ["@jsenv/babel-preset"],
}
```
