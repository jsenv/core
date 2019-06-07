# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> Help to create JavaScript module targeting browsers and/or nodejs

## Main dependencies

jsenv relies mainly on the following projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to people behind these projects, they helped me a lot.

## History behind jsenv

Two annoying things:

- Having to build my entire project to test one file.
- Current tools provide solution for browsers or node, not for both.

jsenv was created to be able to test a file without building the entire project.
And also to make it possible to write modules that can be used inside browsers or nodejs.

## What jsenv can do ?

- execute a file inside browsers and/or node.
- execute unit tests on browsers and/or nodejs.
- generate code coverage of unit tests.
- generate bundle compatible with browsers and node.

All of the above can be done achieved using babel, systemjs, rollup and istanbul separately. But you have to make them work together and it is a lot of work, believe me.

You can also:

- use import starting with / `import from '/src/file.js'`
- use top level await
- use dynamic import
- use import.meta.url

And mainly it's about writing code that can be executed/tested/bundled for browsers and/or nodejs.

## Documentation

List of link to the documentation of jsenv internals:

- [browser explorer server](./docs/browser-explorer-server/browser-explorer-server.md)
- [execution](./docs/execution/execution.md)
- [testing](./docs/testing/testing.md)
- [coverage](./docs/coverage/coverage.md)
- [platform launcher](./docs/platform-launcher/platform-launcher.md)
- [bundling](./docs/bundling/bundling.md)

## Example

A project meant to be used on browsers and node, it is also tested on both environment using jsenv:

https://github.com/dmail/assert

I encourage you to check its package.json [scripts section](https://github.com/dmail/assert/blob/3a308d2e78b9ea217807e27ed4597fbf71f3903f/package.json#L38-L52).
