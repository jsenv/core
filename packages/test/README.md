# @jsenv/test [![npm package](https://img.shields.io/npm/v/@jsenv/test.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/test)

Executing test files in web browsers and/or Node.js.  
This tool enforce test files to be written as **standard** files, without any sort of complexity.

# 1. Writing tests on web browsers 

This section demonstrates how to write a test that will be executed in a web browser. 

The function that will be tested is inside "add.js" file:

```js
export const add = (a, b) => a + b
```

The demonstration uses the following file structure:

<pre>
project/
  src/
    <strong>add.js</strong>
    index.html
  package.json
</pre>

At the end of the demo, the file structure will be like this:

<pre>
project/
  scripts/
    <strong>dev.mjs</strong>
    <strong>test.mjs</strong>
  src/
    add.js
    <strong>add.test.html</strong>
    index.html
  package.json
</pre>

## 1.1 Writing the test file

*src/add.test.html*

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script type="module">
      import { add } from "./add.js"

      const actual = add(1, 2)
      const expected = 3
      if (actual !== expected) {
        throw new Error(`add(1,2) should return 3, got ${actual}`)
      }
    </script>
  </body>
</html>
```

## 1.2 Executing the test file

*scripts/dev.mjs*, will start a web server that is needed to executed "add.test.html" in a browser. 

```js
import { startDevServer } from "@jsenv/core"

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3456,
})
```

*scripts/test.mjs* will start a web browser and use it to execute all test files.

```js
import { executeTestPlan, chromium } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium()
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
})
```

Before running these scripts, install their dependencies:

```console
npm i --save-dev @jsenv/core
npm i --save-dev @jsenv/test
npm i --save-dev playwright
```

☝️ Playwright is used by `@jsenv/test` to start a web browser, see [playwright website](https://github.com/microsoft/playwright)<sup>↗</sup>.

Web server can be started with the following command

```console
node ./scripts/dev.mjs
```

And tests can be executed with the following command

```console
node ./scripts/test.mjs
```

:point_up: You don't have to start the web server before executing tests, if not started `executeTestPlan` imports "scripts/dev.mjs" (configured by `webServer.moduleUrl`).  

### 1.2.1 Executing on more browsers

```js
import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
} from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium()
      },
      firefox: {
        runtime: firefox()
      },
      webkit: {
        runtime: webkit()
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
})
```

## 2 Writing tests on Node.js

In "add.test.mjs":

```js
import { add } from "./add.js"

const actual = add(1, 2)
const expected = 3
if (actual !== expected) {
  throw new Error(`add(1,2) should return 3, got ${actual}`)
}
```

## 1.3 Assertion library

To have a basic example, the part of the code comparing `actual` and `expected` was done without an assertion library.  
In pratice a test would likely use one. The diff below shows how the assertion can be written using [@jsenv/assert](../assert). Note that any other assertion library would work.

```diff
+ import { assert } from "@jsenv/assert"
import { add } from "./add.js"

const actual = add(1, 2)
const expected = 3
- if (actual !== expected) {
-   throw new Error(`add(1,2) should return 3, got ${actual}`)
- }
+ assert({ actual, expected })
```

# 2. JavaScript API




## 2.3 Executing tests on Node.js

With Node.js there is no server involved so test files can be anywhere and only rootDirectoryUrl and testPlan parameters are **required**.

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: { runtime: nodeWorkerThread() },
    },
  },
})
```

## 2.4 Allocated time

Each file is given 30s to execute.
If this duration is exceeded the browser tab (or node process/worker thread) is closed and executiong is considered as failed.
This duration can be configured as shown below:

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: { runtime: nodeWorkerThread(), allocatedMs: 60_000 },
    },
  },
})
```

☝️ Code above changes the default allocated time to 60s.
