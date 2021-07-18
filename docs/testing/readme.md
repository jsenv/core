# executeTestPlan example

In order to show code unrelated to a specific codebase, let's say we want to test a native js function: `"Math.max"`. To do this, let's create two files:

1. An html file to be able to run test inside a browser

   ```html
   <!DOCTYPE html>
   <html>
     <head>
       <meta charset="utf8" />
       <link rel="icon" href="data:," />
     </head>
     <body>
       <script type="module" src="./math_max.test.js"></script>
     </body>
   </html>
   ```

2. A js file testing `"Math.max"`

   ```js
   const actual = Math.max(2, 4)
   const expected = 4
   if (actual !== expected) {
     throw new Error(`Math.max(2, 4) should return ${expected}, got ${actual}`)
   }
   ```

At this stage you can manually open the html file in a browser to ensure there is no error during the test execution. This is what [executeTestPlan](#executeTestPlan) will do but in a programmatic way.

If we want to execute `"Math.max"` test in Firefox, Chrome and even Node.js we can write the following js file:

```js
import { executeTestPlan, launchChromiumTab, launchFirefoxTab, launchNode } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "math_max.test.html": {
      chromium: {
        launch: launchChromiumTab,
      },
      firefox: {
        launch: launchFirefoxTab,
      },
    },
    "math_max.test.js": {
      node: {
        launchNode,
      },
    },
  },
})
```

The file above can be executed directly with `"node"`.

```console
> node execute_test_plan.js
```

_screenshot of terminal after execute_test_plan.js execution:_

![test execution terminal screenshot](./math_max_terminal.png)

_execute_test_plan.js_ runs 1 test 3 times. You can run _n_ test using wildcards.

```diff
-    "math_max.test.html": {
+    "**/*.test.html": {
      chromium: {
        launch: launchChromiumTab,
      },
      firefox: {
        launch: launchFirefoxTab,
      },
    },
-   "math_max.test.js": {
+   "**/*.test.js": {
      node: {
        launchNode,
      },
    }
```

This is documented in [testPlan](#testPlan).

# executeTestPlan

`executeTestPlan` is an async function executing test files in one or several runtime environments logging progression and optionnaly generating associated coverage.

```js
import { executeTestPlan, launchNode } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 5000,
      },
    },
  },
  logLevel: "info",
  coverage: true,
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false,
  },
})
```

— source code at [src/executeTestPlan.js](../../src/executeTestPlan.js).

## testPlan

`testPlan` parameter is an object describing where are your test files and how they should be executed. This is an optional parameter with a default value of:

```js
{
  "./test/**/*.test.js": {
    node: {
      launch: launchNode
    }
  }
}
```

This default value translates into the following sentence: "Execute all files in my project that ends with `test.js` on Node.js".

`testPlan` parts are named `specifier`, `filePlan`, `executionName` and `executionOptions`. To better see what is named how, let's name every value from `testPlan` above.

```js
const specifier = "./test/**/*.test.js"
const executionName = "node"
const executionOptions = {
  launch: launchNode,
}
const filePlan = {
  [executionName]: executionOptions,
}
const testPlan = {
  [specifier]: filePlan,
}
```

### specifier

`specifier` is documented in [https://github.com/jsenv/jsenv-url-meta#specifier](https://github.com/jsenv/jsenv-url-meta#specifier).

### executionName

`executionName` can be anything. up to you to name this execution.

### executionOptions

`executionOptions` can be `null`, in that case the execution is ignored.
It exists to prevent an execution planified by a previous specifier.

```js
{
  // execute every file twice on node (why not ^^)
  "./test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
    node2: {
      launch: launchNode
    }
  },
  // but executes foo.test.js once
  "./test/foo.test.js": {
    node2: null
  }
}
```

Otherwise `executionOptions` must be an object describing how to execute files. See [All execution options](#all-execution-options).

## defaultMsAllocatedPerExecution

`defaultMsAllocatedPerExecution` parameter is a number representing a number of ms allocated given for each file execution to complete. This parameter is optional with a default value corresponding to 30 seconds.

## completedExecutionLogAbbreviation

`completedExecutionLogAbbreviation` parameter is a boolean controlling verbosity of completed execution logs. This parameter is optional and disabled by default.

![test execution mixed full terminal screenshot](./mixed-full-terminal-screenshot.png)

Becomes

![test execution mixed short terminal screenshot](./mixed-short-terminal-screenshot.png)

> Note how completed executions are shorter. The idea is that you don't need additional information for completed executions.

## completedExecutionLogMerging

`completedExecutionLogMerging` parameter is a boolean controlling if completed execution logs will be merged together when adjacent. This parameter is optional and disabled by default.

![test execution mixed short terminal screenshot](./mixed-short-terminal-screenshot.png)

Becomes

![test execution mixed short and merge terminal screenshot](./mixed-short-merge-terminal-screenshot.png)

> Note how the first two completed execution got merged into one line. The idea is to reduce output length as long as execution are completed.

## concurrencyLimit

`concurrencyLimit` parameter is a number representing the max amount of execution allowed to run simultaneously. This parameter is optional with a default value being the number of cpus available minus one. To ensure one execution at a time you can pass `1`.

## coverage parameters

### coverage

`coverage` parameter is a boolean used to enable coverage or not while executing test files. This parameter is enabled if node process args includes `--coverage`.

### coverageConfig

`coverageConfig` parameter is an object used to configure which files must be covered. This parameter is optional with a default value exported by [src/jsenvCoverageConfig.js](../../src/jsenvCoverageConfig.js). Keys are specifiers as documented in [https://github.com/jsenv/jsenv-url-meta#specifier](https://github.com/jsenv/jsenv-url-meta#specifier).

### coverageIncludeMissing

`coverageIncludeMissing` parameter is a boolean used to controls if testPlanCoverage will generate empty coverage for file never imported by test files. This parameter is optional and enabled by default.

### coverageAndExecutionAllowed

`coverageAndExecutionAllowed` parameter is a boolean controlling if files can be both executed and instrumented for coverage. A test file should not appear in your coverage but if `coverageConfig` include your test files for coverage they would. This parameter should help to prevent this to happen in case you missconfigured `coverageConfig` or `testPlan`. This parameter is optional and enabled by default.

### coverageTextLog

`coverageTextLog` parameter is a boolean controlling if the coverage will be logged to the console after test plan is fully executed. This parameter is optional and enabled by default.

### coverageJsonFile

`coverageJsonFile` parameter is a boolean controlling if a json file containing your test plan coverage will be written after test plan is fully executed. This parameter is optional and enabled by default when `process.env.CI` is truthy.

### coverageJsonFileLog

`coverageJsonFileLog` parameter is a boolean controlling if the json file path for coverage will be logged to the console. This parameters is optional and enabled by default.

### coverageJsonFileRelativeUrl

`coverageJsonFileRelativeUrl` parameter is a string controlling where the json file for coverage will be written. This parameter is optional with a default value of `"./coverage/coverage.json"`.

### coverageHtmlDirectory

`coverageHtmlDirectory` parameter is a boolean controlling if a directory with html files showing your coverage will be generated. This parameter is optional and enabled by default when `process.env.CI` is falsy.

### coverageHtmlDirectoryRelativeUrl

`coverageHtmlDirectoryRelativeUrl` parameter is a string controlling where the directory with html files will be written. This parameter is optional with a default value of `./coverage/`.

### coverageHtmlDirectoryIndexLog

`coverageHtmlDirectoryIndexLog` parameter is a boolean controlling if the html coverage directory index file path will be logged to the console. This parameter is optional and enabled by default.

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)

# executeTestPlan return value

`executeTestPlan` returns signature is `{ testPlanSummary, testPlanReport, testPlanCoverage }`

## testPlanSummary

`testPlanSummary` is an object describing quickly how the testPlan execution went. It is returned by `executeTestPlan`.

```js
const { testPlanSummary } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {},
})
```

`testPlanSummary` is an object like this one:

```js
{
  executionCount: 0,
  disconnectedCount: 0,
  timedoutCount: 0,
  erroredCount: 0,
  completedCount: 0
}
```

## testPlanReport

`testPlanReport` is an object containing information about every test plan file execution. It is returned by `executeTestPlan`.

```js
const { testPlanReport } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

`testPlanReport` is an object like this one:

```json
{
  "./test/file.test.js": {
    "node": {
      "runtimeName": "node",
      "runtimeVersion": "8.9.0",
      "status": "completed",
      "startMs": 1560355699946,
      "endMs": 1560355699950,
      "consoleCalls": []
    }
  }
}
```

## testPlanCoverage

`testPlanCoverage` is an object is the coverage of your test plan, it aggregates every file execution coverage. It is returned by `executeTestPlan`.

```js
const { testPlanCoverage } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: true,
})
```

`testPlanCoverage` is an object like this one:

```json
{
  "./src/file.js": {
    "path": "./src/file.js",
    "statementMap": {},
    "fnMap": {},
    "branchMap": {},
    "s": {},
    "f": {},
    "b": {},
    "_coverageSchema": "1a1c01bbd47fc00a2c39e90264f33305004495a9",
    "hash": "4c491deb0eb163063ccae03693fa439ec01fcda4"
  }
}
```

# All execution options

## launch

A function capable to launch a runtime. This parameter is **required**, the available launch functions are documented in [launcher](../launcher.md) documentation.

## launchParams

An object used to configure the launch function. This parameter is optional.

`launchParams` works so that the two code below are equivalent:

```js
import { executeTestPlan, launchChromium } from "@jsenv/core"

executeTestPlan({
  testPlan: {
    "./foo.test.html": {
      chromium: {
        launch: launchChromium,
        launchParams: {
          headless: false,
        },
      },
    },
  },
})
```

```js
import { executeTestPlan, launchChromium } from "@jsenv/core"

executeTestPlan({
  testPlan: {
    "./foo.test.html": {
      chromium: {
        launch: (params) =>
          launchChromium({
            ...params,
            headless: false,
          }),
      },
    },
  },
})
```

## allocatedMs

A number representing the amount of milliseconds allocated for this file execution to complete. This param is optional and fallback to [defaultMsAllocatedPerExecution](#defaultMsAllocatedPerExecution)

```js
import { executeTestPlan, launchNode } from "@jsenv/core"

executeTestPlan({
  defaultMsAllocatedPerExecution: 5000,
  testPlan: {
    "./foo.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 10000,
      },
    },
  },
})
```

## measureDuration

A boolean controlling if file execution duration is measured and reported back. This param is optional and enabled by default.

When true `startMs`, `endMs` properties are availabe on every execution result inside [testPlanReport](#testPlanReport)

## captureConsole

A boolean controlling if console logs are captured during file execution and reported back. This param is optional and enabled by default.

When true `consoleCalls` property is availabe on every execution result inside [testPlanReport](#testPlanReport).

## logSuccess

A boolean controlling if execution success is logged in your terminal. This parameter is optional and enabled by default.

When false and execution completes normally nothing is logged.

# Test presentation

A test runs your code to ensure it works as expected.

Test are putting you in the shoes of someone using your code. In that perspective they document how to use your code and the variety of scenarios your code supports.<br />
Finally testing mitigates the risk of breaking in the future what is working today.

Jsenv provides an api to execute your test files inside one or many environments. It means you can execute a given test file inside chromium and Node.js as long as code inside test file can executes in both.

# Test execution

Each test file will be executed in his own browser or node.js process. It reduces chances that a file execution have a side effect on an other file execution. For example if a test file creates an infinite loop, only this test file will be considered failing and other test can keep going.

jsenv provides several test execution environments, called `runtime`.

- A chromium browser per test
- A chromium browser tab per test
- A firefox browser per test
- A firefox tab per test
- A webkit browser per test
- A webkit tab per test
- A node process per test

## How test is executed

Test is executed by something equivalent to a dynamic import.

```js
await import("file:///file.test.js")
```

If dynamic import resolves, execution is considered successfull.<br />
If dynamic import rejects, execution is considered errored.<br />
If dynamic import takes too long to settle, execution is considered timedout.<br />

Once the execution becomes either successfull, errored or timedout jsenv stops the runtime launched to execute the test (a browser or node.js process). Inside a node process there is a special behaviour: jsenv sends `SIGTERM` signal to the node process executing your test. After 8s, if the node process has not exited by its own it is killed by force.

![test execution all status terminal screenshot](./all-status-terminal-screenshot.png)

### Execution error example

Any value thrown during file execution sets execution status to errored and test is considered as failed.

```js
throw new Error("here")
```

### Execution timeout example

Execution taking longer than an allocated amout of milliseconds sets execution status to timedout and test is considered as failed.

```js
await new Promise(() => {})
```

Note: By default an execution is given 30s before being considered as a timeout.
Check [defaultMsAllocatedPerExecution](#defaultMsAllocatedPerExecution) to know how to configure this value.

### Execution disconnected example

Runtime disconnected during file execution sets execution status to disconnected and test is considered as failed.

```js
while (true) {}
```

Note: There is, fortunately, no way to crash a browser during execution so this code might either crash the runtime or result in a timeout. Inside node however you could write code resulting in a disconnected execution.

```js
process.exit()
```

### Execution completed example

When none of the aboves scenario occurs, execution status is success and test is considered as completed.

```js
const actual = 10 + 10
const expected = 20
if (actual !== expected) {
  throw new Error(`10 + 10 should be 20`)
}
```

Note: An empty file is a completed test.

## How to test async code

Top level await is a standard (and damn cool) way to make your top level code execution asynchronous. Use it to test async code.

```js
const actual = await Promise.resolve(42)
const expected = 42
if (actual !== expected) {
  throw new Error("should be 42")
}
```

Without top level await your execution is considered done while your code is still executing.

```js
console.log("execution start")
;(async () => {
  const actual = await Promise.resolve(42)
  const expected = 42
  if (actual !== expected) {
    throw new Error("should be 42")
  }
  console.log("test done")
})()
console.log("execution end")
```

Logs

```console
execution start
execution end
test done
```

If jsenv executed that code, runtime would be stopped after `execution end` logs and `test done` would never happen.
