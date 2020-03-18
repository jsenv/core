# core

Execute JavaScript on multiple environments for testing.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-core.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-core/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)
[![github ci](https://github.com/jsenv/jsenv-core/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-core/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

# Table of contents

- [Presentation](#Presentation)
- [Installation](#Installation)
- [Documentation](#Documentation)

# Presentation

`@jsenv/core` is above all a testing framework. It executes your tests on a browser, nodejs or both and can generate the combined coverage from all executions.

> In reality you would never test `Math.max`, the code below is testing it to show an example unrelated to a specific codebase.

`Math.max.test.js`

```js
const actual = Math.max(2, 4)
const expected = 4
if (actual !== expected) {
  throw new Error(`Math.max(2, 4) should return ${expected}, got ${actual}`)
}
```

`execute-test-plan.js`

```js
import { executeTestPlan, launchNode, launchChromiumTab } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./**/*.test.js": {
      chromium: {
        launch: launchChromiumTab,
      },
      node: {
        launch: launchNode,
      },
    },
  },
})
```

![test execution terminal screenshot](./docs/testing/main-example-terminal-screenshot.png)

There is a detailed documentation about testing at [./docs/testing/readme.md](./docs/testing/readme.md). `@jsenv/core` can also bring you more as shown in the [Documentation](#Documentation) part.

# Installation

```console
npm install --save-dev @jsenv/core
```

`@jsenv/core` is tested on Mac, Windows, Linux on Node.js 13.7.0 and 12.8.0. Other operating systems and Node.js versions are not tested.

# Documentation

`@jsenv/core` exports functions needed during the life of a typical JavaScript project. These functions are independant, you can use them according to each project requirements. Using every `@jsenv/core` functions results in a unified developer experience.

- execute test files on a browser and/or node.js.<br/>
  — see [./docs/testing/readme.md](./docs/testing/readme.md)

- explore files using a browser.<br/>
  — see [./docs/exploring/readme.md](./docs/exploring/readme.md)

- execute file on a browser or node.js.<br/>
  — see [./docs/executing/readme.md](./docs/executing/readme.md)

- bundle your package into a format compatible with browsers and/or node.js.<br/>
  — see [./docs/bundling/readme.md](./docs/bundling/readme.md)
