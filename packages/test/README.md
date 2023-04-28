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

*scripts/dev.mjs*: will start a web server that is needed to executed "add.test.html" in a browser. 

```js
import { startDevServer } from "@jsenv/core"

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3456,
})
```

*scripts/test.mjs*: will start a web browser and use it to execute all test files.

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

Command to install dependencies:

```console
npm i --save-dev @jsenv/core
npm i --save-dev @jsenv/test
npm i --save-dev playwright
```

☝️ Playwright is used by `@jsenv/test` to start a web browser, see [playwright website](https://github.com/microsoft/playwright)<sup>↗</sup>.

Command to execute tests:

```console
node ./scripts/test.mjs
```

### 1.3 Executing on more browsers

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

## 2. Writing tests on Node.js

This section demonstrates how to write a test that will be executed in Node.js. 

The function that will be tested is inside "add.js" file:

```js
export const add = (a, b) => a + b
```

The demonstration uses the following file structure:

<pre>
project/
  src/
    <strong>add.js</strong>
  package.json
</pre>

At the end of the demo, the file structure will be like this:

<pre>
project/
  scripts/
    <strong>test.mjs</strong>
  src/
    add.js
  tests/
    <strong>add.test.mjs</strong>
  package.json
</pre>

## 2.1 Writing the test file

*add.test.mjs*

```js
import { add } from "./add.js"

const actual = add(1, 2)
const expected = 3
if (actual !== expected) {
  throw new Error(`add(1,2) should return 3, got ${actual}`)
}
```

## 2.2 Executing the test file

*scripts/test.mjs*

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread()
      },
    },
  },
})
```

Command to install dependencies:

```console
npm i --save-dev @jsenv/test
```

Command to execute tests:

```console
node ./scripts/test.mjs
```

## 3. Assertion library

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

## 4. API

## 4.1 executeTestPlan

```js
import { executeTestPlan } from "@jsenv/test"

const report = await executeTestPlan({
  keepRunning: false, // true would keep process alive and all browsers opened even when tests are done 
  coverageEnabled: false, // collect code coverage while executing tests
})
report // contains many information about test executions
```

## 4.2 chromium/firefox/webkit

Params can be used to configure how the browser runtime is started

```js
chromium({
  headful: true // browser UI would be displayed while running tests
})
```

## 4.3 nodeWorkerThread/nodeChildProcess

Params can be used to configure how node child process or node worker thread is started.
Both runtime share the same arguments.

```js
import {
  nodeWorkerThread,
  nodeChildProcess
} from "@jsenv/test"

nodeWorkerThread({
  commandLineOptions: [], // see https://nodejs.org/api/cli.html#options
  env: null // will be written on process.env, see https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback
  importMap: null, // can be used to override import resolution (redirect to other files during test)
})
```

## 4.4 Allocated time

Each file is given 30s to execute.
If this duration is exceeded the browser tab (or node process/worker thread) is closed and execution is considered as failed.
This duration can be configured as shown below:

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: 60_000
      },
    },
  },
})
```

☝️ Code above changes the default allocated time to 60s.


