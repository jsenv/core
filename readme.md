# core

Cover core needs of a JavaScript project.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-core.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-core/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)
[![github ci](https://github.com/jsenv/jsenv-core/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-core/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

# Table of contents

- [Presentation](#Presentation)
- [Testing](#Testing)
- [Exploring](#Exploring)
- [Building](#Building)
- [Installation](#Installation)
- [Configuration](#Configuration)
  - [jsenv.config.js](#jsenvconfigjs)
  - [CommonJS](#CommonJS)
  - [React](#React)
  - [TypeScript](#TypeScript)
- [See also](#See-also)

# Presentation

`@jsenv/core` was first created to be able to write tests that could be executed in different browsers and even Node.js. As a result it is a tool capable to execute js inside browsers and Node.js.

`@jsenv/core` cover core needs of a JavaScript project:

- A developer friendly environment with livereloading
- A function to build files for production when you're done developing
- A function to run your test files for non regression.

> Note that it can be used only as a test runner. Or only to build files for production. However using it entirely is simpler for you, prefer this if you can.

Jsenv integrates seamlessly with standard html, css and js. It can be configured to work with things that are not part of web standards such as TypeScript or React.

# Testing

Testing can be described as: executing many files in parallel and report how it goes.

<details>
  <summary>Math.max.test.html</summary>

> In order to show code unrelated to a specific codebase the example below is testing `Math.max`. In reality you wouldn't test `Math.max`.

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

</details>

<details>
  <summary>execute-test-plan.js</summary>

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

</details>

![test execution terminal screenshot](./docs/main/main-example-testing-terminal.png)

Read more on [testing documentation](./docs/testing/readme.md)

# Exploring

Exploring can be described as: starting an environment helping to develop faster on 1 or many html files thanks to livereloading and jsenv toolbar. It can be used to work on test files or your website html file.

> In other words you have the same experience when you are coding for a test file or your application.

You can start this environment by creating a script and executing it with node.

<details>
  <summary>start-exploring.js</summary>

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

</details>

![exploring command terminal screenshot](./docs/main/main-example-exploring-terminal.png)

When you open that url in a browser, a page called jsenv exploring index is shown. You can click a file to execute it inside the browser. Clicking `Math.max.test.html` loads an other empty blank page because executing `Math.max.test.html` displays nothing and does not throw.

<details>
    <summary>Exploring screenshots</summary>

  <img src="./docs/main/main-example-exploring-index.png" alt="jsenv exploring index page screenshot" />

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

> You can ignore the black toolbar at the bottom of the page for now, it is documented later.

</details>

If you update `Math.max.test.html` to make it fail

```diff
- const expected = 4
+ const expected = 3
```

The browser page is reloaded and page displays the failure. Jsenv also uses [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification) to display a system notification.

<details>
    <summary>Failure screenshot</summary>

![test file failing page screenshot](./docs/main/main-example-exploring-failing.png)

![test file failing notification screenshot](./docs/main/main-example-failing-notif.png)

</details>

If you revert you changes

```diff
- const expected = 3
+ const expected = 4
```

Browser livereloads again and error is gone together with a system notification.

<details>
    <summary>Fixed screenshot</summary>

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

![test file fixed notification screenshot](./docs/main/main-example-fixed-notif.png)

</details>

Read more [exploring documentation](./docs/exploring/readme.md)

# Building

Building can be described as: generating files optimized for production thanks to minification, concatenation and long term caching.

Jsenv only needs to know your main html file and where to write the builded files. You can create a script and execute it with node. `index.html` will be parsed and optimized for production into `dist/main.html`.

<details>
  <summary>build-project.js</summary>

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  enryPointMap: {
    "./index.html": "./main.html",
  },
  minify: false,
})
```

</details>

<details>
  <summary>index.html</summary>

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <script type="importmap" src="./project.importmap"></script>
    <link rel="stylesheet" type="text/css" href="./main.css" />
  </head>

  <body>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

</details>

<details>
  <summary>dist/main.html</summary>

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="assets/favicon-5340s4789a.ico" />
    <script type="importmap" src="import-map-b237a334.importmap"></script>
    <link rel="stylesheet" type="text/css" href="assets/main-3b329ff0.css" />
  </head>

  <body>
    <script type="module" src="./main-f7379e10.js"></script>
  </body>
</html>
```

</details>

> To keep example concise, the following files content is not shown: `favicon.ico`, `project.importmap`, `main.css` and `index.js`.

Read more [building documentation](./docs/building/readme.md)

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

# See also

- [I am too lazy for a test framework](https://medium.com/@DamienMaillard/i-am-too-lazy-for-a-test-framework-ca08d216ee05): A medium article to write simpler tests introducing jsenv as test runner.
- [@jsenv/assert](https://github.com/jsenv/jsenv-assert): Test anything using one assertion.
