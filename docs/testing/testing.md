# testing

This feature is provided by `@jsenv/core` which exports a function called `test`.<br />

The function is capable to execute files on different platforms. By default it will log as it progresses and return an object containing every execution result.

This documentation explains how to use `test` inside a project.

## How to use

Using a basic project setup we'll see how to use `test` to create script capable to run unit test files.

### Basic project setup

1. Create a file structure like this one

```
root/
  src/
    platform-name.js
  test/
    platform-name.test.js
    platform-name.test.browser.js
    platform-name.test.node.js
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

2. Install `@jsenv/core`

```shell
npm install --save-dev @jsenv/core
```

3. Generate `root/importMap.json`

```shell
npm install --save-dev @jsenv/node-module-import-map
node -e "require('@jsenv/node-module-import-map').generateImportMapForProjectNodeModules({ projectPath: process.cwd() });"
```

### How to use `test` to execute unit tests on different platforms

1. Create a script capable to execute unit tests.<br />

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

2. Run `root/execute-tests.js` you just created

```shell
node ./execute-tests.js
```

I made a video recording terminal during execution `root/execute-tests.js`. The gif below was generated from that video.

![test terminal recording](./test-terminal-recording.gif)

## Execution success or failure

`test` will execute your files, theses executions may fail. This part describes what is considered as a failure or a success.<br />

- A file throwing is a failure. Execution status will be `errored`.

```js
throw new Error("here")
```

- A file longer to execute than a given amout of time is a failure. Execution status will be `timedout`.

By default an execution is given 30s. You can change this value globally using `defaultAllocatedMsPerExecution` or per execution using `allocatedMs` property inside an `executionDescription`. These parts are documented a bit further in this document.

```js
await new Promise((resolve) => {
  setTimeout(resolve, 500000)
})
```

- A platform crashing during file execution is a failure. Execution status will be `disconnected`.

```js
while (true) {}
```

The code above may also result in `timeout` or could the browser or node.js process it depends.

- A file executed without error is a success. Execution status will be completed

```js
const actual = 10 + 10
const expected = 20
if (actual !== expected) throw new Error(`10 + 10 should be 20`)
```

It means an empty file is a success too.

## Use top level await when needed

top level await is the ability to write `await` directly in the body of your program.

```js
const value = await Promise.resolve(42)
console.log(value)
```

You must use top level await to test something async.<br />
Without top level await, file execution is considered done even if things are still running.<br />

```js
console.log("execution start")
;(async () => {
  const actual = await Promise.resolve(42)
  const expected = 42
  if (actual !== expected) throw new Error("should be 42")
  console.log("test done")
})()
console.log("execution end")
```

Executing code above with `test` logs `"execution start"`, `"execution end"`.<br />
It does not logs `"test done"` because execution is considered as `completed` and platform is killed.<br />
The same code written using top level await will work.

```js
console.log("execution start")
const actual = await Promise.resolve(42)
const expected = 42
if (actual !== expected) throw new Error("should be 42")
console.log("test done")
console.log("execution end")
```

Executing code above with `test` function logs `"execution start"`, `"test done"`, `"execution end"`.<br />

## One execution = one platform launched

When `test` executes a file it launches one platform to execute it.<br />
Each file will be executed in his own browser or node.js process.<br />

It reduces chances that a file execution have a side effect on an other file execution. For instance if executing a file crashes the browser or node.js process, because of an infinite loop for instance, it will not prevent other file executions.<br />

It also allows `test` to benefit of machine with mutiple processors. Indeed, it executes file at the same time, in concurrency, as much as possible.<br />
You can control this with `maxParallelExecution` option documented a bit further in this document.

## `test` return value

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

## `test` options

### executeDescription

If you don't pass this option, the default value will be:

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

The key are relative path pattern leading to your project unit test files.<br />
path pattern is provided by `dmail/project-structure`.<br />
— see [project structure on github](https://github.com/dmail/project-structure)

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

If you don't pass this option, the default value will be:

```js
30000
```

The default value above means 20s. <br />
This option controls how much time is allocated by default for an execution to complete.If the execution does not completes in time the platform (browser or node.js) is killed and the execution is considered as `timedout` which is considered as a failed execution.<br />
A timeout will not prevent other executions, the execution is considered as timedout and remaining executions are still launched.

### maxParallelExecution

If you don't pass this option, the default value will be:

```js
Math.max(require("os").cpus.length - 1, 1)
```

### measureDuration

If you don't pass this option, the default value will be:

```js
true
```

When true, logs will contain each execution duration and `startMs`, `endMs` properties will be available on every execution result inside `planResult`.

### captureConsole

If you don't pass this option, the default value will be:

```js
true
```

When true, logs will contain each execution logs and `platformLog` property will be available on every execution result inside `planResult`.

### projectPath

— see [generic documentation for projectPath](../shared-options/shared-options.md#projectpath)

### babelPluginMap

— see [generic documentation for babelPluginMap](../shared-options/shared-options.md#babelpluginmap)

### importMapRelativePath

— see [generic documentation for importMapRelativePath](../shared-options/shared-options.md#importmaprelativepath)

### compileIntoRelativePath

— see [generic documentation for compileIntoRelativePath](../shared-options/shared-options.md#compileintorelativepath)

# End

You've reached the end of this documentation, congrats for scrolling so far.<br />
Let me suggest you to:

- take a break, reading doc or scrolling can be exhausting :)
- [go back to readme](../../README.md#how-to-use)
- [go to next doc on coverage](../coverage/coverage.md)

If you noticed issue in this documentation, you're very welcome to open [an issue](https://github.com/jsenv/jsenv-core/issues). I would love you even more if you [create a pull request](https://github.com/jsenv/jsenv-core/pulls) to suggest an improvement.
