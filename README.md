# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> Collection of developments tools providing a unified workflow to write JavaScript for the web, node.js or both at the same time. jsenv is designed to be reusable on different project.

WARNING: latest npm version is failing. 5.70.0 is safe.

## Introduction

`jsenv-core` is the entry point where you can find most of the code and the documentation.<br />
`jsenv` is a github organization used to manage repositories. Most repositories have a corresponding package published on npm.<br />

## How to use

The list below presents what tool jsenv provides. They are independent, you can use them according to your needs.

- explore your project using a browser.<br/>
  — see [exploring server](./docs/exploring-server/exploring-server.md)

- execute one of your file on a browser or node.js process.<br/>
  — see [execution](./docs/execution/execution.md)

- execute your unit test files on a browser and/or node.js.<br/>
  — see [testing](./docs/testing/testing.md)

- generate coverage of your unit test files.<br/>
  — see [coverage](./docs/coverage/coverage.md)

- generate bundle compatible with browsers and/or node.js.<br/>
  — see [bundling](./docs/bundling/bundling.md)

All of the above can be achieved using babel, systemjs, rollup and istanbul separately. This project makes them work together.

Alongside these things jsenv can do, it also provides:

- project relative import, import starting with `/`<br />
  — see [project relative import](./docs/project-relative-import/project-relative-import.md)
- cross platform access to `global`<br />
  — see [cross platform global](./docs/cross-platform-global/cross-platform-global.md)
- `import.meta.url`
- top level `await`
- dynamic `import()`

## Example

A good way to see how something works is to see it in application on a concrete example. I recommend to check one of my project using jsenv: `@dmail/assert`.<br />
This is an npm package providing a browser and node.js entry point. It also runs unit test in a browser and node.js to ensure continuous integration in both environments.<br />

I encourage you to check `@dmail/assert` to see how it uses jsenv.<br />
— see [package.json scripts source](https://github.com/dmail/assert/blob/f05d400ae0ac849503f1b56d4d5971b5ad6b587f/package.json#L38-L52)

## Main dependencies

jsenv uses internally, among others, these three projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to the people behind them, they helped me a lot.
