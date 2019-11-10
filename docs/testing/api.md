# Table of contents

- [executeTestPlan](#executeTestPlan)
  - [testPlan](#testPlan)
- [One execution = One platform](#One-execution--one-platform)
- [Execution error](#Execution-error)
- [Execution timeout](#Execution-timeout)
- [Execution disconnection](#Execution-disconnection)
- [Execution completion](#Execution-completion)

# executeTestPlan

> `executeTestPlan` is a function executing test files in one or several platforms logging progression and optionnaly generating associated coverage.

Implemented in [src/executeTestPlan.js](../../src/executeTestPlan.js), you can use it as shown below.

```js
const { executeTestPlan, launchNode } = require("@jsenv/core")

executeTestPlan({
  logLevel: "info",
  testPlan: {
    "/test/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  projectDirectoryPath: __dirname,
  coverage: true,
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false,
  },
  coverageJsonFile: true,
  coverageJsonFileRelativePath: "./coverage/coverage.json",
})
```

The code above executes every files ending with .test.js inside node and write the associated coverage into a file in json format.

### testPlan

> `testPlan` is an object describing where are your test files and how they should be executed.

This is an optional parameter with a default value of:

```js
{
 "/test/**/*.test.js": {
  node: {
    launch: launchNode,
  }
}
```

Execute description let you describe which files you want to execute and how.<br />
Example above means you want to execute all files ending with `.test.js` anywhere the `/test/` folder with node.js. It also allocates only `5000` ms for `/test/file.test.js` file execution.

`executeDescription` uses path matching provided by `@jsenv/url-meta`.<br />
— see [@jsenv/url-meta on github](https://github.com/jsenv/jsenv-url-meta)

If you don't pass this option, the default value will be:

### defaultAllocatedMsPerExecution

```js
const { test } = require("@jsenv/testing")

test({
  projectPath: "/Users/you/project",
  defaultAllocatedMsPerExecution: 50000,
})
```

This option controls how much time is allocated by default for an execution to complete.

If the execution does not completes in time the platform (browser or node.js) is killed and the execution is considered as `timedout` which is considered as a failed execution.<br />
A timeout will not prevent other executions, the execution is considered as timedout and remaining executions are still launched.

If you don't pass this option, the default value will be 30 seconds:

```js
30000
```

### maxParallelExecution

```js
const { test } = require("@jsenv/testing")

test({
  projectPath: "/Users/you/project",
  maxParallelExecution: 10,
})
```

Maximum amount of execution in parallel at the same time.

To ensure one execution at a time you can pass `1`.

If you don't pass this option, the default value will be:

```js
Math.max(require("os").cpus.length - 1, 1)
```

### measureDuration

```js
const { test } = require("@jsenv/testing")

test({
  projectPath: "/Users/you/project",
  measureDuration: true,
})
```

When true, execution duration will be measured and will appear in logs and execution result.

This option adds `startMs`, `endMs` properties on every execution result inside `report`.

If you don't pass this option, the default value will be:

```js
true
```

### captureConsole

```js
const { test } = require("@jsenv/testing")

test({
  projectPath: "/Users/you/project",
  captureConsole: true,
})
```

When true, execution logs will be captures and will appear in logs and execution result.

This option add `platformLog` property on every execution result inside `report`.

If you don't pass this option, the default value will be:

```js
true
```

### projectPath

— see [generic documentation for projectPath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#projectpath)

### babelPluginMap

— see [generic documentation for babelPluginMap](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#babelpluginmap)

### convertMap

— see [generic documentation for convertMap](../shared-options/shared-options.md#convertmap)

### importMapRelativePath

— see [generic documentation for importMapRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importmaprelativepath)

### importDefaultExtension

— see [generic documentation for importDefaultExtension](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importdefaultextension)

### compileIntoRelativePath

— see [generic documentation for compileIntoRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#compileintorelativepath)

## One execution = one platform

Each test file will be executed in his own browser or node.js process.

It reduces chances that a file execution have a side effect on an other file execution.
For instance executing code with an infinite loop crashes browser or node.js process. In that scenario that file would not prevent other file executions.

It also allows to execute files concurrently increasing speed on machine with mutiple processors.

## Execution error

Any value thrown during file execution sets execution status to errored and test is considered as failed.<br />
See below code that would trigger this scenario:

```js
throw new Error("here")
```

## Execution timeout

File execution taking longer than an allocated amout of milliseconds sets execution status to timedout and test is considered as failed.<br />
See below code that would trigger this scenario:

```js
await new Promise(() => {})
```

Note: By default an execution is given 30s before being considered as a timeout.

## Execution disconnection

Platform disconnected during file execution sets execution status to disconnected and test is considered as failed.<br />
See below code that would trigger this scenario:

```js
while (true) {}
```

Note: This code might either crash the platform (browser or node.js) resulting in disconnected or just timeout.

### Execution completion

When none of the aboves scenario occurs, execution status is success and test is considered as completed.s
See below code that would trigger this scenario:

```js
const actual = 10 + 10
const expected = 20
if (actual !== expected) {
  throw new Error(`10 + 10 should be 20`)
}
```

Note: An empty file is a completed test.

### summary

`test` returns signature is `{ summary, report, coverageMap }`.

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

### report

To better understand report signature, check the pseudo code below:

```js
const { report } = await test({
  projectPath: "/",
  executeDescription: {
    "/test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  measureDuration: true,
  captureConsole: true,
})
```

Executing this pseudo code could give you a `report` like the one below:

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
