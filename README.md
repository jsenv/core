# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> Help to create JavaScript module targeting browsers and/or node.js

## Main dependencies

jsenv relies mainly on the following projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to people behind these projects, they helped me a lot.

## History behind jsenv

Two annoying things:

- Tool provides solutions for browsers or node.js, not for both.
- Having to build an entire project to test one file.

The jsenv project was created to help writing modules that can be used inside browsers and node.js.<br />
It also exists to be able to test a file without having to build an entire project.

## What jsenv can do ?

- execute file on browsers, node.js.
- execute unit tests on browsers, node.js.
- generate code coverage of unit tests.
- generate bundle for browsers, node.js.
- use import starting with `/`
- use top level `await`
- use dynamic `import()`
- use `import.meta.url`

All of the above can be achieved using babel, systemjs, rollup and istanbul separately. This project make them  work together to provide debugging, code coverage and bundling for browsers and node.js.

## Documentation

List of link to the documentation of jsenv internals:

- [browser explorer server](./docs/browser-explorer-server/browser-explorer-server.md)
- [execution](./docs/execution/execution.md)
- [testing](./docs/testing/testing.md)
- [coverage](./docs/coverage/coverage.md)
- [platform launcher](./docs/platform-launcher/platform-launcher.md)
- [bundling](./docs/bundling/bundling.md)

## Example

The `@dmail/assert` module is emblematic of what jsenv can do:

- It can be used on browsers and node.js.
- It needs to run unit tests on a browser and node.js.
- It needs to export bundle that can be used inside a browser or node.js.

Link to `@dmail/assert` on github https://github.com/dmail/assert.<br />
I encourage you to check its [package.json scripts](https://github.com/dmail/assert/blob/3a308d2e78b9ea217807e27ed4597fbf71f3903f/package.json#L38-L52).
