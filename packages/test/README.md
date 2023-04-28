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

_src/add.test.html_

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

_scripts/dev.mjs_: will start a web server that is needed to executed "add.test.html" in a browser.

```js
import { startDevServer } from "@jsenv/core"

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3456,
})
```

_scripts/test.mjs_: will start a web browser and use it to execute all test files.

```js
import { executeTestPlan, chromium } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
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
import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
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

# 2. Writing tests on Node.js

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

_add.test.mjs_

```js
import { add } from "./add.js"

const actual = add(1, 2)
const expected = 3
if (actual !== expected) {
  throw new Error(`add(1,2) should return 3, got ${actual}`)
}
```

## 2.2 Executing the test file

_scripts/test.mjs_

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
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

# 3. Assertion library

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

# 4. API

```js
import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
  nodeChildProcess,
} from "@jsenv/test"

const report = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
      },
    },
    "./src/**/*.test.mjs": {
      node_worker: {
        runtime: nodeWorkerThread(),
      },
      node_process: {
        runtime: nodeChildProcess({
          commandLineOptions: ["--no-warnings"],
          env: { TEST: "1" },
          importMap: {
            imports: { foo: "./foo_mock.js" },
          },
        }),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  keepRunning: true,
  logShortForCompletedExecutions: true,
  logMergeForCompletedExecutions: true,
  coverageEnabled: true,
  coverageConfig: {
    "./src/**/*.js": true,
    "./src/**/*.test.mjs": false,
  },
})
report // contains many information about test executions
```

| Parameter                      | Description                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| rootDirectoryUrl               | Url used to resolve relative urls in other parameters (like testPlan)                                 |
| testPlan                       | Object listing the files to execute and configuring where they will be executed                       |
| keepRunning                    | Boolean that can be used to keep browser/node process alive after all executions are done             |
| logShortForCompletedExecutions | Boolean, when enabled completed execution logs will be shorter                                        |
| logMergeForCompletedExecutions | Boolean, when enabled, as long as executions are completed, logs are overridden to shorten the output |
| coverageEnabled                | Boolean controlling if code coverage will be collected while executing test files                     |
| coverageConfig                 | Object describing the files that should be covered                                                    |
| coverageReportHtml             | Boolean controlling if a code coverage report will be written as HTML files                           |
| coverageReportHtmlDirectoryUrl | String or url where html files composing the code coverage report will be written                     |

# 4.1 webServer

| Parameter                  | Description                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| webServer.origin           | Url listened by the web server                                                                                    |
| webServer.rootDirectoryUrl | Url leading to the root directory for the web server                                                              |
| webServer.moduleUrl        | `executeTestPlan` does a dynamic import on `webServer.moduleUrl` if there is nothing listening `webServer.origin` |

## 4.2 chromium/firefox/webkit

chromium, firefox and webkit runtimes can be configured, they use the parameters listed in the table below:

| Parameter               | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| headful                 | browser UI would be displayed while running tests                                                                 |
| playwrightLaunchOptions | Will be forwarded to playwright launch, see https://playwright.dev/docs/api/class-browsertype#browser-type-launch |

## 4.3 nodeWorkerThread/nodeChildProcess

nodeWorkerThread and nodeChildProcess can be configured, they use the parameters listed in the table below:

| Parameter          | Description                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| commandLineOptions | Command line options for node, see https://nodejs.org/api/cli.html#options                                              |
| env                | Becomes `process.env`, see "env" in https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback |
| importMap          | Can be used to override import resolution (redirect to other files during test)                                         |

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
        allocatedMs: 60_000,
      },
    },
  },
})
```

☝️ Code above changes the default allocated time to 60s.
