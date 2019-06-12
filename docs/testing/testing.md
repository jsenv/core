# testing

This feature is provided by `@jsenv/core` which exports a function called `test`.<br />

The function is capable to execute files on different platforms. By default it will log as it progresses and return an object containing every execution result.

This documentation explains how to use `test` inside a project.

## How to use

Using a basic project setup we'll see how to use `test` to create script capable to run unit test files.

### Basic project setup

```
root/
  src/
    platform-name.js
  test/
    platform-name.test.js
    platform-name.browser.test.js
    platform-name.node.test.js
  index.js
  package.json
```

`root/test/platform-name.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = typeof getPlatformName
const expected = "function"

if (actual !== expected) throw new Error(`getPlatformName must be a ${expected}, got ${actual}`)
```

`root/test/platform-name.browser.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = getPlatformName()
const expected = "browser"

if (actual !== expected) throw new Error(`getPlatformName must return ${expected}, got ${actual}`)
```

`root/test/platform-name.node.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = getPlatformName()
const expected = "node"

if (actual !== expected) throw new Error(`getPlatformName must return ${expected}, got ${actual}`)
```

`root/index.js`

```js
export { getPlatformName } from "./src/platform-name.js"
```

`root/platform-name.js`

```js
export const getPlatformName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}
```

`root/package.json`

```json
{
  "name": "whatever"
}
```

### How to use test to execute unit tests on different platforms

1. Generate `root/importMap.json` for the project.

```shell
npm install --save-dev @jsenv/node-module-import-map
node -e 'require("@jsenv/node-module-import-map").generateImportMapForProjectNodeModules({ projectPath: process.cwd() })'
```

2. install `@jsenv/core`

```shell
npm install --save-dev @jsenv/core
```

3. Create a script capable to execute unit tests.<br />

`root/execute-tests.js`

```js
const { launchChromium, launchNode, test } = require("@jsenv/core")

test({
  projectPath: __dirname,
  executeDescription: {
    "/test/*.test.js": {
      browser: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
    "/test/*.test.browser.js": {
      browser: {
        launch: launchChromium,
      },
    },
    "/test/*.test.node.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

4. Run `root/execute-tests.js` we just created

```shell
node ./execute-tests.js
```

I made a video recording terminal during execution `root/execute-tests.js`. The gif below was generated from that video.

![test terminal recording](./test-terminal-recording.gif)

## Test return value

`test` returns signature is `{ planResultSummary, planResult }`.

### planResultSummary

It is an object with the following signature:

```js
{
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount,
}
```

### planResult

To better understand planResult signature, check the pseudo code below:

```js
const executeDescription = {
  "/test/file.test.js": {
    node: {
      launch: launchNode,
    },
  },
}

const { planResult } = await test({
  projectPath: "/",
  executeDescription,
})
```

Executing this pseudo code could give you a `planResult` like the one below:

```json
{
  "/test/file.test.js": {
    "node": {
      "platformName": "node",
      "platformVersion": "8.9.0",
      "status": "completed",
      "startMs": 1560355699946,
      "endMs": 1560355699950,
      "platformLog": ""
    }
  }
}
```

## Test guidelines

Some guidelines regarding test files.

- if test throws during execution, it is considered as failed with an `errored` status.
- if platform dies during test execution, test is considered as failed with a `disconnected` status.
- if test does not completes fast enough, it is considered as failed with a `timedout` status.
- async test must use top level await

```js
const actual = await Promise.resolve(10)
const expected = 10
if (actual !== expected) throw new Error("should be 10")
```

- a platform is launched for every test, vastly reducing potential side effects between tests.
- test cannot prevent other test execution

For instance a test with an infinite loop will likely crash the platform or timeout but next one will run.

- test can be concurrently executed

You can prevent it by passing [maxParallelExecution](#maxparallelexecution) option to 1.

## Test options

The documentation of some options used by `test` is shared.<br />
— see [shared options](../shared-options/shared-options.md)

Options below are specific to `test`.

### executeDescription

Default value:

```js
const executeDescription = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
```

Execute description let you describe which files you want to execute and how.<br />

The key are relative path leading to your project unit test files.<br />
`/**/` means 0 or more folder.<br />
`*` means 1 or more character.<br />
More info on path matching available at https://github.com/dmail/project-structure.<br />

The value is an object describing all execution for that file.<br />
All execution must also be objects with a `launch` function.<br />
Each execution can have an `allocatedMs` property as shown below:

```js
const executeDescription = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
  "/test/file.test.js": {
    node: {
      allocatedMs: 5000, // /test/file.test.js has only 5s to complete
    },
  },
}
```

### defaultAllocatedMsPerExecution

Default value:

```js
20000
```

The default value above means 20s. <br />
This option controls how much time is allocated by default for an execution to complete.If the execution does not completes in time the platform (browser or node.js) is killed and the execution is considered as `timedout` which is considered as a failed execution.<br />
A timeout will not prevent other executions, the execution is considered as timedout and remaining executions are still launched.

### maxParallelExecution

Default value:

```js
Math.max(require("os").cpus.length - 1, 1)
```

### measureDuration

Default value:

```js
true
```

When true, logs will contain each execution duration and `startMs`, `endMs` properties will be available on every execution result inside `planResult`.

### captureConsole

Default value:

```js
true
```

When true, logs will contain each execution logs and `platformLog` property will be available on every execution result inside `planResult`.
