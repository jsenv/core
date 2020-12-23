# core

Holistic likable builder of JavaScript projects.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-core.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-core/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)
[![github ci](https://github.com/jsenv/jsenv-core/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-core/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

# Table of contents

- [Presentation](#Presentation)
- [Testing](#Testing)
- [Exploring](#Exploring)
- [Building](#Building)
- [Why jsenv?](#Why-jsenv)
- [Installation](#Installation)
- [Configuration](#Configuration)
- [See also](#See-also)

# Presentation

`@jsenv/core` was first created to be able to write tests that could be executed in different browsers AND Node.js. In the end it became a tool covering the core needs of a JavaScript project:

- A test runner to execute test files.
- A developer friendly environment
- A builder/bundler to optimize files for production

Jsenv integrates naturally with standard html, css and js. It can be configured to work with TypeScript and React.

# Testing

`@jsenv/core` provides a test runner: A function executing test files to know if some are failing. This function is called `executeTestPlan`. Check steps below to get an idea of its usage.

<details>
  <summary>1. Create a test file</summary>

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

</details>

<details>
  <summary>2. Create an other file to execute your test</summary>

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

> This code above translates into the following sentence "Execute all files in my project that ends with `test.html` on Chrome and Firefox."

</details>

<details>
  <summary>3. Execute your tests</summary>

![test execution terminal screenshot](./docs/main/main-example-testing-terminal.png)

</details>

Read more on [testing documentation](./docs/testing/readme.md)

# Exploring

`@jsenv/core` provides a server capable to turn any html file into an entry point. This power can used to create a storybook, debug a file in isolation and more. This server is called `exploring server`. This server is designed for development: it provides livereloading out of the box and does not bundle files.

The following example shows how it can be used to execute a single test file. As mentioned previously it can execute any html file, not only test files.

<details>
  <summary>1. Create a file to start exploring server</summary>

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

<details>
  <summary>2. Start exploring server</summary>

![exploring command terminal screenshot](./docs/main/main-example-exploring-terminal.png)

</details>

<details>
    <summary>3. Open exploring server in a browser</summary>

When you open `https://localhost:3456` in a browser, a page called jsenv exploring index is shown. It displays a list of all your html files. You can click a file to execute it inside the browser. In our previous example we created `Math.max.test.html` so it is displayed in that list.

![jsenv exploring index page screenshot](./docs/main/main-example-exploring-index.png)

> Maybe you noticed the black toolbar at the bottom of the page? We'll see that further in the documentation.

</details>

<details>
  <summary>4. Open <code>Math.max.test.html</code></summary>

Clicking `Math.max.test.html` load an empty blank page because code inside this html file display nothing and does not throw.

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

</details>

To get a better idea of how this would integrate in everyday workflow, let's go a bit further and see what happens if we make test file throw. After that we'll revert the changes.

<details>
  <summary>5. Make <code>Math.max.test.html</code> fail</summary>

```diff
- const expected = 4
+ const expected = 3
```

The browser page is reloaded and page displays the failure. Jsenv also uses [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification) to display a system notification.

![test file failing page screenshot](./docs/main/main-example-exploring-failing.png)

![test file failing notification screenshot](./docs/main/main-example-failing-notif.png)

</details>

<details>
  <summary>6. Fix <code>Math.max.test.html</code></summary>

```diff
- const expected = 3
+ const expected = 4
```

Browser livereloads again and error is gone together with a system notification.

![test file page screenshot](./docs/main/main-example-exploring-file-a.png)

![test file fixed notification screenshot](./docs/main/main-example-fixed-notif.png)

</details>

Read more [exploring documentation](./docs/exploring/readme.md)

# Building

Building can be described as: generating files optimized for production thanks to minification, concatenation and long term caching.

Jsenv only needs to know your main html file and where to write the builded files. You can create a script and execute it with node.

Following the simplified steps below turns `index.html` into a production optimized `dist/main.html`.

<details>
  <summary>1. Create <code>index.html</code></summary>

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <script type="importmap" src="./import-map.importmap"></script>
    <link rel="stylesheet" type="text/css" href="./main.css" />
  </head>

  <body>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

> To keep example concise, the content of the following files is not shown:
>
> - `favicon.ico`
> - `import-map.importmap`
> - `main.css`
> - `main.js`

</details>

<details>
  <summary>2. Create <code>build-project.js</code></summary>

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
  <summary>3. Execute <code>build-project.js</code></summary>

```console
node ./build-project.js
```

</details>

<details>
  <summary>4. Open <code>dist/index.html</code></summary>

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

> To keep example concise, the content of the following files is not shown:
>
> - `dist/assets/favicon-5340s4789a.ico`
> - `dist/import-map-b237a334.importmap`
> - `dist/assets/main-3b329ff0.css`
> - `dist/main-f7379e10.js`

</details>

Read more [building documentation](./docs/building/readme.md)

# Why jsenv?

Jsenv focuses on one thing: developer experience. Everything was carefully crafted to get explicit and coherent apis.

## Less context switching

One of the thing jsenv does well is to decrease harm caused by context switching.

Context switching: You are writing js that you are used to write every day for your project, then, you switch to unit tests. And, suddenly, you must adapt to new constraints imposed by the testing framework.<br />
— Read more in [I am too lazy for a test framework](https://medium.com/@DamienMaillard/i-am-too-lazy-for-a-test-framework-ca08d216ee05)

Jsenv provides a unified approach to this: [exploring](#exploring)

## Explicitness over magic

Jsenv also don't like blackboxes. `@jsenv/core` functions always choose expliciteness over magic. It makes things much simpler to understand and follow both for jsenv and for you.

> One example of expliciteness over magic: You control and tell jsenv where is your project directory. Jsenv don't try to guess or assume where it is.

## Dispensable by default

Jsenv is **dispensable** by default. As long as your code is using only standards, you could remove jsenv from your project and still be able to run your code. You can double click your html file to open it inside your browser -> it works. Or if this is a Node.js file execute it directly using the `node` command.

Being dispensable by default highlights jsenv philosophy: no new concept to learn. It also means you can switch to an other tool easily as no part of your code is specific to jsenv.

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

CommonJS module format rely on `module.exports` and `require`. It was invented by Node.js and is not standard JavaScript. If your code or one of your dependency uses it, it requires some configuration.

<details>
  <summary><code>jsenv.config.js</code> to use code written in CommonJS</summary>

> The following `jsenv.config.js` makes Jsenv compatible with a package named `whatever` that would be written in CommonJS.

```js
import { jsenvBabelPluginMap, convertCommonJsWithRollup } from "@jsenv/core"

export const convertMap = {
  "./node_modules/whatever/index.js": convertCommonJsWithRollup,
}
```

</details>

## React

React is written in CommonJS and comes with JSX. If you use them it requires some configuration.

<details>
  <summary><code>jsenv.config.js</code> for react and jsx</summary>

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

</details>

## TypeScript

TypeScript needs some configuration if you use it.

<details>
  <summary><code>jsenv.config.js</code> for TypeScript</summary>

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

</details>

# See also

- [@jsenv/assert](https://github.com/jsenv/jsenv-assert): Test anything using one assertion.
- [@jsenv/sass](./packages/jsenv-sass): Add support for .scss and .sass in jsenv.
- [@jsenv/vue](./packages/jsenv-vue): Add support for .vue in jsenv.
