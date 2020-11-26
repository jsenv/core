# core

Execute JavaScript on multiple environments for testing.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-core.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-core/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)
[![github ci](https://github.com/jsenv/jsenv-core/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-core/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

# Table of contents

- [Presentation](#Presentation)
- [Example](#Example)
  - [Executing tests](#Executing-tests)
  - [Writing tests](#Writing-tests)
- [Installation](#Installation)
- [Configuration](#Configuration)
  - [jsenv.config.js](#jsenvconfigjs)
  - [CommonJS](#CommonJS)
  - [React](#React)
  - [TypeScript](#TypeScript)
- [API](#API)
- [See also](#See-also)

# Presentation

`@jsenv/core` is a test runner. It focuses on executing many files in parallel and report how it goes.

![test execution terminal screenshot](./docs/main/main-example-testing-terminal.png)

It's main characteristics are:

- Can execute html files in browsers (chromium, firefox, webkit)
- Can execute js files in Node.js
- Easy to debug single file
- Framework agnostic: can be configured to run jsx, typescript and more.
- Can generate coverage from all executions
- Rely on top level await to test asynchronous code

# Example

> In order to show code unrelated to a specific codebase the example below is testing `Math.max`. In reality you wouldn't test `Math.max`.

`Math.max.test.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      const actual = Math.max(2, 4)
      const expected = 4
      if (actual !== expected) {
        throw new Error(`Math.max(2, 4) should return ${expected}, got ${actual}`)
      }
    </script>
  </body>
</html>
```

## Executing tests

Let's create a script that will execute `Math.max.test.html` in chromium and firefox.

`execute-test-plan.js`

```js
import { executeTestPlan, launchChromiumTab, launchFirefoxTab } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "**/*.test.html": {
      chromium: {
        launch: launchChromiumTab,
      },
      firefox: {
        launch: launchFirefoxTab,
      },
    },
  },
})
```

```console
node ./execute-test-plan.js
```

![test execution terminal screenshot](./docs/main/main-example-testing-terminal.png)

As shown by the logs jsenv has launched chromium and firefox and executed `Math.max.test.html`. Check [testing](./docs/testing/readme.md) for detailed documentation around `executeTestPlan`.

## Writing tests

Jsenv also helps to write tests using a development server to execute test in isolation and one at a time. It comes with livereloading and a toolbar.

The following script would start such server.

`start-exploring.js`

```js
import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    source: {
      "**/*.html": true,
    },
  },
  compileServerPort: 3456,
})
```

```console
node ./start-exploring.js
```

![exploring command terminal screenshot](./docs/main/main-example-exploring-terminal.png)

When you open that url in a browser, a page called jsenv exploring index is shown.

![jsenv exploring index page screenshot](./docs/main/main-example-exploring-index.png)

You can click a file to execute it inside the browser. Clicking `Math.max.test.html` loads an other page visible in the following image.

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

As shown in the image above there is an empty blank page. It's because executing `Math.max.test.html` displays nothing on the page and execution did not throw. You can ignore the black toolbar at the bottom of the page for now, it is documented later.

If you update `Math.max.test.html` to make it fail

```diff
- const expected = 4
+ const expected = 3
```

The browser page is reloaded. Now page displays the failure.

![test file failing page screenshot](./docs/main/main-example-exploring-failing.png)

Jsenv also uses [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification) to display a system notification.

![test file failing notification screenshot](./docs/main/main-example-failing-notif.png)

If you revert you changes

```diff
- const expected = 3
+ const expected = 4
```

Browser livereloads again and you can see error is gone.

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

Together with a system notification.

![test file fixed notification screenshot](./docs/main/main-example-fixed-notif.png)

# Installation

```console
npm install --save-dev @jsenv/core
```

`@jsenv/core` is tested on Mac, Windows, Linux on Node.js 14.5.0. Other operating systems and Node.js versions are not tested.

# Configuration

Jsenv can execute standard JavaScript and be configured to run non-standard JavaScript.

Jsenv support standard JavaScript by default: [JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), destructuring, optional chaining and so on.

Jsenv can be configured to execute non-standard JavaScript. For instance using [CommonJS modules](https://code-trotter.com/web/understand-the-different-javascript-modules-formats/#commonjs-cjs), [JSX](https://reactjs.org/docs/introducing-jsx.html) or [TypeScript](https://www.typescriptlang.org).

> Keep in mind one of your dependency may use non-standard JavaScript. For instance react uses CommonJS modules.

## jsenv.config.js

We recommend to regroup configuration in a `jsenv.config.js` file at the root of your working directory.

To get a better idea see [jsenv.config.js](./jsenv.config.js). The file is imported by [script/test/test.js](https://github.com/jsenv/jsenv-core/blob/e44e362241e8e2142010322cb4552983b3bc9744/script/test/test.js#L2) and configuration is passed [using spread operator](https://github.com/jsenv/jsenv-core/blob/e44e362241e8e2142010322cb4552983b3bc9744/script/test/test.js#L5). This technic helps to see jsenv custom configuration quickly and share it between files.

That being said it's only a recommendation. There is nothing enforcing or checking the presence of `jsenv.config.js`.

## CommonJS

CommonJS module format is not standard JavaScript. Using it requires some configuration. The following `jsenv.config.js` makes Jsenv compatible with a package written in CommonJS (`module.exports` and `require`).

```js
import { jsenvBabelPluginMap, convertCommonJsWithRollup } from "@jsenv/core"

export const convertMap = {
  "./node_modules/whatever/index.js": convertCommonJsWithRollup,
}
```

## React

React is written in CommonJS and comes with JSX. If you use them it requires some configuration. The following `jsenv.config.js` enables react and JSX.

```js
import { createRequire } from "module"
import { jsenvBabelPluginMap, convertCommonJsWithRollup } from "@jsenv/core"

const require = createRequire(import.meta.url)
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

export const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-react-jsx": [
    transformReactJSX,
    { pragma: "React.createElement", pragmaFrag: "React.Fragment" },
  ],
}

export const convertMap = {
  "./node_modules/react/index.js": convertCommonJsWithRollup,
  "./node_modules/react-dom/index.js": (options) => {
    return convertCommonJsWithRollup({ ...options, external: ["react"] })
  },
}
```

See also

- [babelPluginMap](./docs/shared-parameters.md#babelPluginMap)
- [convertMap](./docs/shared-parameters.md#convertMap)
- [transform-react-jsx on babel](https://babeljs.io/docs/en/next/babel-plugin-transform-react-jsx.html)

## TypeScript

TypeScript needs some configuration if you use it. The following `jsenv.config.js` enable TypeScript.

```js
import { createRequire } from "module"
import { jsenvBabelPluginMap } from "@jsenv/core"

const require = createRequire(import.meta.url)
const transformTypeScript = require("@babel/plugin-transform-typescript")

export const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-typescript": [transformTypeScript, { allowNamespaces: true }],
}
```

See also

- [babelPluginMap](./docs/shared-parameters.md#babelPluginMap)
- [transform-typescript on babel](https://babeljs.io/docs/en/next/babel-plugin-transform-typescript.html)

# API

- [Testing](./docs/testing/readme.md)

  Executing many files in parallel and report how it goes.

- [Exploring](./docs/exploring/readme.md)

  Start a development server to execute html files, comes with livereloading and jsenv toolbar.

- [Executing](./docs/executing/readme.md)

  Execute html file in a browser or js file in Node.js, can be used to debug within VS Code.

- [Building](./docs/building/readme.md)

  Generate files compatible with browsers and Node.js.

# See also

- [I am too lazy for a test framework](https://medium.com/@DamienMaillard/i-am-too-lazy-for-a-test-framework-ca08d216ee05): A medium article to write simpler tests introducing jsenv as test runner.
- [@jsenv/assert](https://github.com/jsenv/jsenv-assert): Test anything using one assertion.
