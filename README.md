# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> jsenv helps a developper to code, test and build a JavaScript project. It's designed for a full stack project where front-end and back-end are written in JavaScript.

> jsenv can also be used for a project exclusively front-end or back-end.

## Main dependencies

jsenv uses internally, among others, these three projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to the people behind them, they helped me a lot.

## History behind jsenv

What I like the most about JavaScript is that you can write a full stack project using JavaScript only.<br /><br />
But on such a project, I always thought there were too many obstacles when switching between front-end and back-end environments.<br /><br />
That's why I started to think about a solution that would help me to code in an enviroment where back and front would be closer to each other.<br />

## What jsenv can do ?

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
