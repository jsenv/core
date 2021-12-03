# Jsenv test runner

This is an in-depth documentation about jsenv test runner. For a quick overview go to [test runner overview](../../readme.md#Test-runner-overview).

This documentation list [key features](#key-features) and gives the [definition of a test for jsenv](#Definition-of-a-test-for-jsenv) to get an idea of how things where designed. Then it documents [executeTestPlan](#executeTestPlan) function, its parameters and return value. Finally you can find:

- [How tests are executed?](#How-tests-are-executed)
- [How to test async code?](#How-to-test-async-code)

# Key features

- Test files are "normal" files:
  - **Almost zero context switching when opening a test file**
  - Tests are written like the rest of the codebase
  - Tests are debugged like the rest of the codebase
  - Tests can be executed independently
- Tests can be executed on Chrome, Firefox, Safari and Node.js
- Tests are executed in total isolation: a dedicated browser or node process per test
- Tests have a configurable amount of ms to end; This is also configurable per test

# Definition of a test for jsenv

A test runs your code to ensure it works as expected.

Test are putting you in the shoes of someone using your code. In that perspective they document how to use your code and the variety of scenarios your code supports.<br />
Finally testing mitigates the risk of breaking in the future what is working today.

Jsenv provides an api to execute your test files inside one or many environments. It means you can execute a given test inside chromium and Node.js as long as code can execute in both.

# executeTestPlan

_executeTestPlan_ is an async function executing test files in one or several runtime environments logging progression and optionnaly generating associated coverage.

```js
import { executeTestPlan, nodeRuntime, chromiumTabRuntime } from "@jsenv/core"

await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/**/*.test.html": {
      chromium: {
        runtime: chromiumTabRuntime,
        allocatedMs: 7000,
      },
    },
    "./test/**/*.test.mjs": {
      node: {
        runtime: nodeRuntime,
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

## testPlan

_testPlan_ parameter is an object describing where are your test files and how they should be executed. This parameter is **required**.

_testPlan_ parts are named _pattern_, _filePlan_, _executionName_ and _executionOptions_. To better see what is named how, let's name every value from _testPlan_ above.

```js
const pattern = "./test/**/*.test.js"
const executionName = "node"
const executionOptions = {
  runtime: nodeRuntime,
}
const filePlan = {
  [executionName]: executionOptions,
}
const testPlan = {
  [pattern]: filePlan,
}
```

### pattern

_pattern_ is documented in [https://github.com/jsenv/jsenv-url-meta#pattern](https://github.com/jsenv/jsenv-url-meta#pattern).

### executionName

_executionName_ can be anything. Up to you to name this execution.

### executionOptions

_executionOptions_ can be `null`, in that case the execution is ignored.
It exists to prevent an execution planified by a previous pattern.

```js
{
  // execute every file twice on node (why not ^^)
  "./test/**/*.test.mjs": {
    node: {
      runtime: nodeRuntime
    },
    node2: {
      runtime: nodeRuntime
    }
  },
  // but executes foo.test.js once
  "./test/foo.test.mjs": {
    node2: null
  }
}
```

Otherwise _executionOptions_ must be an object describing how to execute files. See [All execution options](#all-execution-options).

## defaultMsAllocatedPerExecution

_defaultMsAllocatedPerExecution_ parameter is a number representing a number of ms allocated given for each file execution to complete. This parameter is optional with a default value corresponding to 30 seconds.

## completedExecutionLogAbbreviation

_completedExecutionLogAbbreviation_ parameter is a boolean controlling verbosity of completed execution logs. This parameter is optional and disabled by default.

```console
❯ node ./docs/testing/demo/abbreviation/demo_abbreviation_without.mjs

✔ execution 1 of 4 completed (all completed)
file: docs/testing/demo/abbreviation/a.spec.js
runtime: node/16.13.0
duration: 0.3 seconds

✖ execution 2 of 4 errored (1 errored, 1 completed)
file: docs/testing/demo/abbreviation/b.spec.js
runtime: node/16.13.0
duration: 0.23 seconds
error: Error: here
    at file:///Users/dmail/jsenv-core/docs/testing/demo/abbreviation/b.spec.js:1:7
    at ModuleJob.run (node:internal/modules/esm/module_job:185:25)

✔ execution 3 of 4 completed (1 errored, 2 completed)
file: docs/testing/demo/abbreviation/c.spec.js
runtime: node/16.13.0
duration: 0.25 seconds

✔ execution 4 of 4 completed (1 errored, 3 completed)
file: docs/testing/demo/abbreviation/d.spec.js
runtime: node/16.13.0
duration: 0.24 seconds


-------------- summary -----------------
4 executions: 1 errored, 3 completed
total duration: 1 second
----------------------------------------
```

Becomes

```console
❯ node ./docs/testing/demo/abbreviation/demo_abbreviation.mjs

✔ execution 1 of 4 completed (all completed)

✖ execution 2 of 4 errored (1 errored, 1 completed)
file: docs/testing/demo/abbreviation/b.spec.js
runtime: node/16.13.0
duration: 0.18 seconds
error: Error: here
    at file:///Users/dmail/jsenv-core/docs/testing/demo/abbreviation/b.spec.js:1:7
    at ModuleJob.run (node:internal/modules/esm/module_job:185:25)

✔ execution 3 of 4 completed (1 errored, 2 completed)

✔ execution 4 of 4 completed (1 errored, 3 completed)

-------------- summary -----------------
4 executions: 1 errored, 3 completed
total duration: 0.84 seconds
----------------------------------------
```

> Note how completed executions are shorter. The idea is that you don't need additional information for completed executions.

## completedExecutionLogMerging

_completedExecutionLogMerging_ parameter is a boolean controlling if completed execution logs will be merged together when adjacent. This parameter is optional and disabled by default.

```console
❯ node ./docs/testing/demo/abbreviation/demo_abbreviation.mjs

✔ execution 1 of 4 completed (all completed)

✖ execution 2 of 4 errored (1 errored, 1 completed)
file: docs/testing/demo/abbreviation/b.spec.js
runtime: node/16.13.0
duration: 0.18 seconds
error: Error: here
    at file:///Users/dmail/jsenv-core/docs/testing/demo/abbreviation/b.spec.js:1:7
    at ModuleJob.run (node:internal/modules/esm/module_job:185:25)

✔ execution 3 of 4 completed (1 errored, 2 completed)

✔ execution 4 of 4 completed (1 errored, 3 completed)

-------------- summary -----------------
4 executions: 1 errored, 3 completed
total duration: 0.84 seconds
----------------------------------------
```

Becomes

```console
❯ node ./docs/testing/demo/abbreviation/demo_abbreviation_and_merge.mjs

✖ execution 2 of 4 errored (1 errored, 1 completed)
file: docs/testing/demo/abbreviation/b.spec.js
runtime: node/16.13.0
duration: 0.23 seconds
error: Error: here
    at file:///Users/dmail/jsenv-core/docs/testing/demo/abbreviation/b.spec.js:1:7
    at ModuleJob.run (node:internal/modules/esm/module_job:185:25)

✔ execution 4 of 4 completed (1 errored, 3 completed)

-------------- summary -----------------
4 executions: 1 errored, 3 completed
total duration: 0.95 seconds
----------------------------------------
```

> Note how the completed executions are merged. The idea is to reduce output length as long as execution are completed.

## maxExecutionsInParallel

_maxExecutionsInParallel_ parameter is a number representing the max amount of execution allowed to run simultaneously. This parameter is optional with a default value of `1`.

## coverage parameters

### coverage

_coverage_ parameter is a boolean used to enable coverage or not while executing test files. This parameter is enabled if node process args includes `--coverage`.

### coverageConfig

_coverageConfig_ parameter is an object used to configure which files must be covered. This parameter is optional with a default value exported by [src/jsenvCoverageConfig.js](../../src/jsenvCoverageConfig.js). Keys are patterns as documented in [https://github.com/jsenv/jsenv-url-meta#pattern](https://github.com/jsenv/jsenv-url-meta#pattern).

### coverageIncludeMissing

_coverageIncludeMissing_ parameter is a boolean used to controls if testPlanCoverage will generate empty coverage for file never imported by test files. This parameter is optional and enabled by default.

### coverageAndExecutionAllowed

_coverageAndExecutionAllowed_ parameter is a boolean controlling if files can be both executed and instrumented for coverage. A test file should not appear in your coverage but if _coverageConfig_ include your test files for coverage they would. This parameter should help to prevent this to happen in case you missconfigured _coverageConfig_ or _testPlan_. This parameter is optional and enabled by default.

### coverageTextLog

_coverageTextLog_ parameter is a boolean controlling if the coverage will be logged to the console after test plan is fully executed. This parameter is optional and enabled by default.

### coverageJsonFile

_coverageJsonFile_ parameter is a boolean controlling if a json file containing your test plan coverage will be written after test plan is fully executed. This parameter is optional and enabled by default when `process.env.CI` is truthy.

### coverageJsonFileLog

_coverageJsonFileLog_ parameter is a boolean controlling if the json file path for coverage will be logged to the console. This parameters is optional and enabled by default.

### coverageJsonFileRelativeUrl

_coverageJsonFileRelativeUrl_ parameter is a string controlling where the json file for coverage will be written. This parameter is optional with a default value of `"./coverage/coverage.json"`.

### coverageHtmlDirectory

_coverageHtmlDirectory_ parameter is a boolean controlling if a directory with html files showing your coverage will be generated. This parameter is optional and enabled by default when `process.env.CI` is falsy.

### coverageHtmlDirectoryRelativeUrl

_coverageHtmlDirectoryRelativeUrl_ parameter is a string controlling where the directory with html files will be written. This parameter is optional with a default value of `"./coverage/"`.

### coverageHtmlDirectoryIndexLog

_coverageHtmlDirectoryIndexLog_ parameter is a boolean controlling if the html coverage directory index file path will be logged to the console. This parameter is optional and enabled by default.

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [customCompilers](../shared-parameters.md#customCompilers)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [logLevel](../shared-parameters.md#logLevel)
- [protocol](../shared-parameters.md#protocol)
- [privateKey](../shared-parameters.md#privateKey)
- [certificate](../shared-parameters.md#certificate)
- [ip](../shared-parameters.md#ip)
- [port](../shared-parameters.md#port)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)

# executeTestPlan return value

_executeTestPlan_ returns signature is `{ testPlanSummary, testPlanReport, testPlanCoverage }`

## testPlanSummary

_testPlanSummary_ is an object describing quickly how the testPlan execution went. It is returned by _executeTestPlan_.

```js
const { testPlanSummary } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {},
})
```

_testPlanSummary_ is an object like this one:

```js
{
  executionCount: 0,
  abortedCount: 0,
  timedoutCount: 0,
  erroredCount: 0,
  completedCount: 0,
  cancelledCount: 0
}
```

## testPlanReport

_testPlanReport_ is an object containing information about every test plan file execution. It is returned by _executeTestPlan_.

```js
const { testPlanReport } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/file.test.js": {
      node: {
        runtime: nodeRuntime.
      },
    },
  },
})
```

_testPlanReport_ is an object like this one:

```json
{
  "./test/file.test.js": {
    "node": {
      "runtimeName": "node",
      "runtimeVersion": "8.9.0",
      "status": "completed",
      "duration": 12546,
      "consoleCalls": []
    }
  }
}
```

## testPlanCoverage

_testPlanCoverage_ is an object is the coverage of your test plan, it aggregates every file execution coverage. It is returned by _executeTestPlan_.

```js
const { testPlanCoverage } = await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./test/file.test.js": {
      node: {
        runtime: nodeRuntime.
      },
    },
  },
  coverage: true,
})
```

_testPlanCoverage_ is an object like this one:

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

## runtimeParams

An object used to configure the launch function. This parameter is optional.

_runtimeParams_ works so that the two code below are equivalent:

```js
import { executeTestPlan, chromiumRuntime } from "@jsenv/core"

await executeTestPlan({
  testPlan: {
    "./foo.test.html": {
      chromium: {
        runtime: chromiumRuntime,
        runtimeParams: {
          headless: false,
        },
      },
    },
  },
})
```

```js
import { executeTestPlan, chromiumRuntime } from "@jsenv/core"

await executeTestPlan({
  testPlan: {
    "./foo.test.html": {
      chromium: {
        runtime: {
          ...chromiumRuntime,
          launch: (params) => {
            return chromiumRuntime.launch({ ...params, headless: false })
          },
        },
      },
    },
  },
})
```

## allocatedMs

A number representing the amount of milliseconds allocated for this file execution to complete. This param is optional and fallback to [defaultMsAllocatedPerExecution](#defaultMsAllocatedPerExecution)

```js
import { executeTestPlan, nodeRuntime } from "@jsenv/core"

await executeTestPlan({
  defaultMsAllocatedPerExecution: 5000,
  testPlan: {
    "./foo.test.js": {
      node: {
        runtime: nodeRuntime.
        allocatedMs: 10000,
      },
    },
  },
})
```

## captureConsole

A boolean controlling if console logs are captured during file execution and reported back. This param is optional and enabled by default.

When true _consoleCalls_ property is availabe on every execution result inside [testPlanReport](#testPlanReport).

## logSuccess

A boolean controlling if execution success is logged in your terminal. This parameter is optional and enabled by default.

When false and execution completes normally nothing is logged.

# How tests are executed?

Each test file will be executed in his own browser or node.js process. It reduces chances that a file execution have a side effect on an other file execution. For example if a test file creates an infinite loop, only this test file will be considered failing and other test can keep going.

jsenv provides several test execution environments, called _runtime_.

- A chromium browser per test
- A chromium browser tab per test
- A firefox browser per test
- A firefox tab per test
- A webkit browser per test
- A webkit tab per test
- A node process per test

Test is executed by something equivalent to a dynamic import.

```js
await import("file:///file.test.js")
```

If dynamic import resolves, execution is considered successfull.<br />
If dynamic import rejects, execution is considered errored.<br />
If dynamic import takes too long to settle, execution is considered timedout.<br />

Once the execution becomes either successfull, errored or timedout jsenv stops the runtime launched to execute the test (a browser or node.js process). Inside a node process there is a special behaviour: jsenv sends `SIGTERM` signal to the node process executing your test. After 8s, if the node process has not exited by its own it is killed by force.

```console
❯ node ./docs/testing/demo/mixed/demo.mjs

✔ execution 1 of 4 completed (all completed)
file: docs/testing/demo/mixed/a.spec.js
runtime: node/16.13.0
duration: 0.31 seconds

✖ execution 2 of 4 timeout after 3000ms (1 timed out, 1 completed)
file: docs/testing/demo/mixed/b.spec.js
runtime: node/16.13.0
duration: 3 seconds

✖ execution 3 of 4 errored (1 timed out, 1 errored, 1 completed)
file: docs/testing/demo/mixed/c.spec.js
runtime: node/16.13.0
duration: 0.24 seconds
error: <stack hidden>

✖ execution 4 of 4 errored (1 timed out, 2 errored, 1 completed)
file: docs/testing/demo/mixed/d.spec.js
runtime: node/16.13.0
duration: 0.2 seconds
error: Error: runtime stopped during execution
    at callExecute (file:///Users/dmail/jsenv-core/src/internal/executing/launchAndExecute.js:367:14)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)

-------------- summary -----------------
4 executions: 1 timed out, 2 errored, 1 completed
total duration: 4.2 seconds
----------------------------------------
```

## Execution error example

Any value thrown during file execution sets execution status to errored and test is considered as failed.

```js
throw new Error("here")
```

## Execution timeout example

Execution taking longer than an allocated amout of milliseconds sets execution status to timedout and test is considered as failed.

```js
await new Promise(() => {})
```

Note: By default an execution is given 30s before being considered as a timeout.
Check [defaultMsAllocatedPerExecution](#defaultMsAllocatedPerExecution) to know how to configure this value.

## Execution disconnected example

Runtime disconnected during file execution sets execution status to disconnected and test is considered as failed.

```js
while (true) {}
```

Note: There is, fortunately, no way to crash a browser during execution so this code might either crash the runtime or result in a timeout. Inside node however you could write code resulting in a disconnected execution.

```js
process.exit()
```

## Execution completed example

When none of the aboves scenario occurs, execution status is success and test is considered as completed.

```js
const actual = 10 + 10
const expected = 20
if (actual !== expected) {
  throw new Error(`10 + 10 should be 20`)
}
```

Note: An empty file is a completed test.

# How to test async code?

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

If jsenv executed that code, runtime would be stopped after "execution end" log and "test done" would never happen.
