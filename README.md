# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> Developper tool providing a unified workflow to write JavaScript for the web, node.js or both at the same time. jsenv is designed to be reusable on different project.

## Why jsenv?

I have several npm packages that I want to maintain.<br />
Setuping tools for each of them takes times and is hard to maintain accross all of them.<br />

I made jsenv to use it inside all my JavaScript projects which can be front-end, back-end or fullstack.<br />

## What jsenv can do ?

The list below presents what jsenv provides. You may want to use only some of them.

- start a server sending self executing html source for every file of your project.<br/>
  — see [browser explorer server](./docs/browser-explorer-server/browser-explorer-server.md)

- launch a platform, like a browser or a node.js process, then execute a file inside it and return the result.<br/>
  — see [execution](./docs/execution/execution.md)

- execute unit test files on different platforms and return the result.<br/>
  — see [testing](./docs/testing/testing.md)

- generate coverage for your unit test files.<br/>
  — see [coverage](./docs/coverage/coverage.md)

- Generate bundle compatible with one or several platforms.<br/>
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

A concrete example using jsenv: `@dmail/assert`.<br />
It is a npm package meant to be used either on front-end or back-end.<br />
So it needs to be usable in both browsers and node.js.<br />
And it would like to run unit tests on a browser and node.js.<br />

I encourage you to check `@dmail/assert` to see how it uses jsenv.<br />
— see [package.json scripts source](https://github.com/dmail/assert/blob/3a308d2e78b9ea217807e27ed4597fbf71f3903f/package.json#L38-L52)

## Main dependencies

jsenv uses internally, among others, these three projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to the people behind them, they helped me a lot.
