# @jsenv/test [![npm package](https://img.shields.io/npm/v/@jsenv/test.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/test)

Executing test files in web browsers and/or Node.js.  
This tool enforce test files to be written as **standard** files, without any sort of complexity.

# 1. Example

Writing tests for the following "add" function:

```js
export const add = (a, b) => a + b
```

## 1.1 Testing "add" on web browser

In "add.test.html":

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

## 1.2 Testing "add" on Node.js

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

## 2.1 Executing tests on browsers

Requirements:

- A directory containing source and test files
- [playwright](https://github.com/microsoft/playwright)<sup>↗</sup> in your `devDependencies`
- A script starting a web server
- A script executing test files

1. File structure

<pre>
project/
  scripts/
    dev.mjs
    test.mjs
  src/
    add.js
    <strong>add.test.html</strong>
    index.html
  package.json
</pre>

2. Installing playwright

```console
npm i --save-dev playwright
```

3. "scripts/dev.mjs"

A server is required to run tests in a browser, it must serve source and test files. 

```console
npm i --save-dev @jsenv/core
```

```js
import { startDevServer } from "@jsenv/core"

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3456,
})
```

4. "scripts/test.mjs"

```console
npm i --save-dev @jsenv/test
```

```js
import { executeTestPlan, chromium } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: { runtime: chromium() },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
})
```

The tests can now be executed with the following command

```console
node ./scripts/test.mjs
```

:point_up: If the server is not started `executeTestPlan` will start it by importing the file configured by `webServer.moduleUrl`.  

## 2.2 Executing on more browsers

```js
import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: { runtime: chromium() },
      firefox: { runtime: firefox() },
      webkit: { runtime: webkit() },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
})
```

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

# 3. Installation

```console
npm install --save-dev @jsenv/test
```
