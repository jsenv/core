# `test`

Documents how `test` function behaves.

## One execution = one platform

When `test` executes a file it launches one platform to execute it.<br />
Each file will be executed in his own browser or node.js process.<br />

It reduces chances that a file execution have a side effect on an other file execution. For instance if executing a file crashes the browser or node.js process, because of an infinite loop for instance, it will not prevent other file executions.<br />

It also allows `test` to benefit of machine with mutiple processors. Indeed, it executes file at the same time, in concurrency, as much as possible.<br />
You can control this with `maxParallelExecution` option.

## Success or failure

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

## Use top level await to test async code

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

## `test` return value

`test` returns signature is `{ summary, report }`.

### summary

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

## `test` options

### executeDescription

```js
import { test } from "@jsenv/testing"
import { launchNode } from "@jsenv/node-launcher"

test({
  projectPath: "/Users/you/project",
  executeDescription: {
    "/test/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "/test/file.test.js": {
      node: {
        allocatedMs: 5000,
      },
    },
  },
})
```

Execute description let you describe which files you want to execute and how.<br />
Example above means you want to execute all files ending with `.test.js` anywhere the `/test/` folder with node.js. It also allocates only `5000` ms for `/test/file.test.js` file execution.

`executeDescription` uses path matching provided by `@jsenv/url-meta`.<br />
— see [@jsenv/url-meta on github](https://github.com/jsenv/jsenv-url-meta)

If you don't pass this option, the default value will be:

```js
{
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
```

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
