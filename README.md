# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> Collection of developments tools providing a unified workflow to write JavaScript for the web, node.js or both at the same time. jsenv is designed to be reusable on different project.

## Introduction

`jsenv-core` is the entry point where you can find most of the code and the documentation.<br />
`jsenv` is a github organization used to manage repositories. Most repositories have a package published on npm.<br />

## How to use

The list below presents what tool jsenv provides. They are independent and you can use them according to your project needs.

- explore your project using a browser.<br/>
  — see [@jsenv/exploring server](https://github.com/jsenv/jsenv-exploring-server)

- execute your test files on a browser and/or node.js.<br/>
  — see [@jsenv/testing](https://github.com/jsenv/jsenv-testing)

- execute one of your file on a browser or node.js process.<br/>
  — see [execution](./docs/execution/execution.md)

- generate bundle compatible with browsers and/or node.js.<br/>
  — see [@jsenv/bundling](https://github.com/jsenv/jsenv-bundling)

The above could be achieved using babel, systemjs and rollup separately. jsenv makes them work together.

## Example

I recommend to check a concrete example of a project using jsenv: `@dmail/assert`.<br />
This is an npm package providing a browser and node.js entry point. It also runs unit test in a browser and node.js to ensure continuous integration in both environments.<br />

I encourage you to check `@dmail/assert` to see how it uses jsenv.<br />
— see [package.json scripts source](https://github.com/dmail/assert/blob/81eae260b515850dadecbc8e723d5fde5827f81e/package.json#L44-L53)

## Main dependencies

jsenv uses internally, among others, these three projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to the people behind them, they helped me a lot.
