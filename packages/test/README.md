# @jsenv/test [![npm package](https://img.shields.io/npm/v/@jsenv/test.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/test)

A tool to execute files in web browsers and/or Node.js.

This tool enforce test files to be written as standard file without any sort of complexity.
Let's see an example where test files are written for a simple `add` function exported by `add.js`

**add.js**

```js
export const add = (a, b) => a + b
```

The following file would be a test file meant to be executed by Node.js

**add.test.mjs**

```js
import { add } from "./add.js"

const actual = add(1, 2)
const expected = 3
if (actual !== expected) {
  throw new Error(`add(1,2) should return 3, got ${actual}`)
}
```

The following file would be a test file meant to be executed on a web browser

**add.test.html**

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

Note that an assertion library can be used to cover more complex comparison. [@jsenv/assert](../packages/assert) is recommended but other libraries can be used.

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

# 1. JavaScript API

## 1.1 Executing tests on browsers

Code below execute all files endings by `".test.html"` on chromium.  
[playwright](https://github.com/microsoft/playwright)<sup>↗</sup> is used to start a headless chromium.

```js
import { executeTestPlan, chromium } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./**/*.test.html": {
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

When executing tests on browsers there is a few things to ensure:

1. `"playwright"` must be in package.json dependencies (`npm i playwright --save-dev`)

2. `webServer` parameter must be used:

| Param                      | Description                                       | Example                                 |
| -------------------------- | ------------------------------------------------- | --------------------------------------- |
| webServer.origin           | url listened by a web server                      | `"http://localhost:3456"`               |
| webServer.rootDirectoryUrl | url of directory served by the web server         | `new URL("../src/", import.meta.url)`   |
| webServer.moduleUrl        | url of the file responsible to start a web server | `new URL("./dev.mjs", import.meta.url)` |

Test files must be inside `webServer.rootDirectoryUrl`:

<pre>
project/
  src/
    bar.js
    <strong>bar.test.html</strong>
    foo.js
    <strong>foo.test.html</strong>
    index.html
</pre>

It's also possible to create a directory dedicated to tests

<pre>
project/
  src/
    tests/
       <strong>bar.test.html</strong>
       <strong>foo.test.html</strong>
    bar.js
    foo.js
    index.html
</pre>

This way the web server can serve test files alongside with source files.  
It's best to configure `webServer` to lead to jsenv dev server but it does not have to; Any server serving files from a directory can be used.

## 1.2 Executing on more browsers

```js
import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/core"

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

## 1.3 Executing tests on Node.js

With Node.js there is no server involved so test files can be anywhere and only rootDirectoryUrl and testPlan parameters are **required**.

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: { runtime: nodeWorkerThread() },
    },
  },
})
```

## 1.4 Allocated time

Each file is given 30s to execute.
If this duration is exceeded the browser tab (or node process/worker thread) is closed and executiong is considered as failed.
This duration can be configured as shown below:

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

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

# 2. Installation

```console
npm install --save-dev @jsenv/test
```
