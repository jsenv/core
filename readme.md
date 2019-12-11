# core

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-core.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-core/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)
[![github ci](https://github.com/jsenv/jsenv-core/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-core/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

Unified developer experience to write and maintain JavaScript projects.

# Table of contents

- [Presentation](#Presentation)
- [How to use](#How-to-use)
- [Examples](#Examples)

## Presentation

`jsenv-core` github repository corresponds to `@jsenv/core` package published on github and npm package registries.

Once upon a time `@jsenv/core` was a test runner able to execute tests in browsers and Node.js.<br />
Being capable to execute test files, it became possible to launch any file to debug it. From that point `@jsenv/core` naturally evolved to provide more tooling like a dev server with livereloading or bundling.<br />

`@jsenv/core` focuses on a developper experience that would be conceivable if latest standards were available in browsers and Node.js.

`@jsenv/core` polyfills developer experience on a JavaScript project.

In that regard future `@jsenv/core` versions will become lighter as standard gets adopted.

## How to use

The list below presents the main tools `@jsenv/core` provides. They are independent and you can use them according to your project needs.

- explore your project using a browser.<br/>
  — see [./docs/exploring/readme.md](./docs/exploring/readme.md)

- execute your project test files on a browser and/or node.js.<br/>
  — see [./docs/testing/readme.md](./docs/testing/readme.md)

- execute any of your project file on a browser or node.js.<br/>
  — see [./docs/executing/readme.md](./docs/executing/readme.md)

- bundle your project into a format compatible with browsers and/or node.js.<br/>
  — see [./docs/bundling/readme.md](./docs/bundling/readme.md)

The above could be achieved using babel, systemjs and rollup separately. jsenv makes them work together.

## Examples

I recommend to check jsenv starters repository on github.<br />
It regroups some basic setup to start coding using jsenv from an empty project.<br />

— see [jsenv starters on github](https://github.com/jsenv/jsenv-starters)
