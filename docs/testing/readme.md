# Table of contents

- [Test presentation](#Test-presentation)
- [Test concrete example](#Test-concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Execute tests](#2---execute-tests)
  - [3 - Generate test coverage](#3---generate-test-coverage)
    - [coverage/index.html](#coverageindexhtml)
    - [coverage/coverage.json](#coveragecoveragejson)
- [Test execution](#Test-execution)
  - [How test is executed](#How-test-is-executed)
  - [Execution error](#Execution-error)
  - [Execution timeout](#Execution-timeout)
  - [Execution disconnection](#Execution-disconnection)
  - [Execution completion](#Execution-completion)
  - [How to test async code](#How-to-test-async-code)
- [executeTestPlan example](#executeTestPlan-example)
- [executeTestPlan parameters](#executeTestPlan-parameters)
  - [testPlan](#testPlan)
    - [specifier](#specifier)
    - [executionName](#executionName)
    - [executionOptions](#executionOptions)
      - [launch](#launch)
      - [allocatedMs](#allocatedMs)
      - [measureDuration](#measureDuration)
      - [captureConsole](#captureConsole)
      - [collectNamespace](#collectNamespace)
      - [collectCoverage](#collectCoverage)
      - [logSuccess](#logSuccess)
  - [executionDefaultOptions](#executionDefaultOptions)
  - [concurrencyLimit](#concurrencyLimit)
  - [measurePlanExecutionDuration](#measurePlanExecutionDuration)
  - [coverage](#coverage)
  - [Shared parameters](#shared-parameters)
- [executeTestPlan return value](#executeTestPlan-return-value)
  - [testPlanSummary](#testPlanSummary)
  - [testPlanReport](#testPlanReport)
  - [testPlanCoverageMap](#testPlanCoverageMap)

# Test presentation

A test runs your code to ensure it works as expected.

Test are putting you in the shoes of someone using your code. In that perspective they document how to use your code and the variety of scenarios your code supports.<br />
Finally test helps to prevent accidentally breaking in the future what is working today.

Jsenv provides an api to execute your test files inside one or many environments. It means you can execute a given test file inside chromium and Node.js as long as code inside test file can executes in both.

# Test concrete example

This part helps you to setup a project on your machine to play with jsenv testing.<br />
You can also reuse the project file structure to understand how to integrate jsenv to write and run your own project tests.

## 1 - Setup basic project

```console
git clone https://github.com/jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/testing/basic-project
```

```console
npm install
```

## 2 - Execute tests

```console
node ./execute-test-plan.js
```

It will execute all your tests as shown in [Test execution recorded](#Test-execution-recorded)

## 3 - Generate test coverage

```console
node ./execute-test-plan.js --cover
```

It will execute tests and generate `./coverage/` directory with files corresponding to your test coverage.

### coverage/index.html

The gif below shows how you can explore your test coverage by opening `coverage/index.html` in your browser.

![browsing coverage recording](./coverage-browsing-recording.gif)<br />
— gif generated from [./coverage-browsing-recording.mp4](./coverage-browsing-recording.mp4)

### coverage/coverage.json

It is your test plan coverage in JSON format. This format was created by [istanbul](https://github.com/gotwarlost/istanbul), a JS code coverage tool written in JS. This file exists to be provided to some code coverage tool.
For instance you might want to send `coverage.json` to codecov.io inside continuous integration workflow.<br />
— see [uploading coverage to codecov.io](./uploading-coverage-to-codecov.md)

# Test execution

Each test file will be executed in his own browser or node.js process.

It reduces chances that a file execution have a side effect on an other file execution.
For instance executing code with an infinite loop crashes browser or node.js process. In that scenario that file would not prevent other file executions.<br />
It also allows to execute files concurrently increasing speed on machine with mutiple processors.

Currently jsenv provides 3 possible test execution environments, called `platforms`:

- A chromium browser by test
- A chromium browser tab by test
- A node process by test

## How test is executed

Test is executed by something equivalent to a dynamic import.

```js
await import("file:///file.test.js")
```

If dynamic import resolves, execution is considered successfull.<br />
If dynamic import rejects, execution is considered errored.<br />
If dynamic import takes too long to settle, execution is considered timedout.<br />

Once the execution becomes either successfull, errored or timedout jsenv stops the platform launched to execute the test. Inside a node process there is a special behaviour where jsenv sends `SIGINIT` signal to the node process executing your test. After 8s, if the node process has not exited by its own it is killed by force.

## Execution error

Any value thrown during file execution sets execution status to errored and test is considered as failed.

```js
throw new Error("here")
```

## Execution timeout

Execution taking longer than an allocated amout of milliseconds sets execution status to timedout and test is considered as failed.

```js
await new Promise(() => {})
```

Note: By default an execution is given 30s before being considered as a timeout.
Check [executionDefaultOptions documentation](./api.md#executionDefaultOptions) to know how to configure this value.

## Execution disconnection

Platform disconnected during file execution sets execution status to disconnected and test is considered as failed.

```js
while (true) {}
```

Note: There is, fortunately, no way to crash a browser during execution so this code might either crash the platform or result in a timeout. Inside node however you could write code resulting in a disconnected execution.

```js
process.exit()
```

## Execution completion

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
if (actual !== expected) throw new Error("should be 42")
```

Without top level await your execution is considered done while your code is still executing.

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

Logs

```console
execution start
execution end
test done
```

If jsenv executed that code, platform would be stopped after `execution end` logs and `test done` would never happen.

# executeTestPlan example

`executeTestPlan` is an async function executing test files in one or several platforms logging progression and optionnaly generating associated coverage.
To integrate it properly in your own project, take inspiration from the [basic project](./basic-project) files.

```js
import { executeTestPlan, launchNode } from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: __dirname,
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
  coverageJsonFile: true,
  coverageJsonFileRelativeUrl: "./coverage/coverage.json",
})
```

— source code at [src/executeTestPlan.js](./src/executeTestPlan.js).

# executeTestPlan parameters

`executeTestPlan` uses named parameters documented here.

Each parameter got a dedicated section to shortly explain what it does and if it's required or optional.

## testPlan

`testPlan` is an object describing where are your test files and how they should be executed. This is an optional parameter with a default value of:

```js
{
  "./test/**/*.test.js": {
    node: {
      launch: launchNode
    }
  }
}
```

`testPlan` parts are named `specifier`, `filePlan`, `executionName` and `executionOptions`.<br />
To better see what is named how, let's name every part of the default `testPlan`:

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

`executionOptions` option are documented below:

#### launch

A function capable to launch a platform. This parameter is **required**

#### allocatedMs

A number representing the amount of milliseconds allocated for this file execution to complete. This option is optional with a default value of 30s.

#### measureDuration

A boolean controlling if file execution duration is measured and reported back. This parameter is optional with a default value of true.

When true `startMs`, `endMs` properties are availabe on every execution result inside [testPlanReport](#testPlanReport)

#### captureConsole

A boolean controlling if console logs are captured during file execution and reported back. This parameter is optional with a default value of true.

When true `consoleCalls` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### collectNamespace

A boolean controlling if file exports are collected and reported back. This parameter is optional with a default value of false.

When true `namespace` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### collectCoverage

A boolean controlling if coverage related to this execution is collected and reported back. This parameter is optional with a default value of false.

When true `coverageMap` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### logSuccess

A boolean controlling if execution success is logged in your terminal. This parameter is optional with a default value of true.

When false and execution completes normally nothing is logged.

## executionDefaultOptions

`executionDefaultOptions` parameter is an object that will be the default option used to execute file. This is an optional parameter with a default value of `{}`.

`executionDefaultOptions` was designed to define options shared by file execution. These option can be overriden per file using [testPlan](#testPlan) parameter.

For example the following code allocates 5s test file by default and 10s for `foo.test.js`

```js
executeTestPlan({
  executionDefaultOptions: {
    allocatedMs: 5000,
  },
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

## concurrencyLimit

`concurrencyLimit` parameter is a number representing the max amount of execution allowed to run simultaneously. This parameter is optional with a default value being the number of cpus available minus one. To ensure one execution at a time you can pass `1`.

## measurePlanExecutionDuration

`measurePlanExecutionDuration` parameter is a boolean controlling if test plan execution duration is measured, logger and reported. This parameter is optional with a default value of `false`.

When true, `startMs`, `endMs` properties are available on [testPlanSummary](#testPlanSummary). When true, a log will indicates test plan duration.

## coverage

TODO and all coverage params

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)

# executeTestPlan return value

`executeTestPlan` returns signature is `{ summary, report, coverageMap }`

## testPlanSummary

`testPlanSummary` is an object describing quickly how the testPlan execution went. It is returned by `executeTestPlan`.

```js
const { summary } = await executeTestPlan({
  projectDirectoryUrl: __dirname,
  testPlan: {},
})
```

`summary` is an object like this one:

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
const { report } = await executeTestPlan({
  projectDirectoryUrl: __dirname
  testPlan: {
    "./test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

`report` is an object like this one:

```json
{
  "./test/file.test.js": {
    "node": {
      "platformName": "node",
      "platformVersion": "8.9.0",
      "status": "completed",
      "startMs": 1560355699946,
      "endMs": 1560355699950,
      "consoleCalls": []
    }
  }
}
```

## testPlanCoverageMap

`testPlanCoverageMap` is an object is the coverage of your test plan, it aggregates every file execution coverage. It is returned by `executeTestPlan`.

```js
const { coverageMap } = await executeTestPlan({
  projectDirectoryUrl: __dirname
  testPlan: {
    "./test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: true
})
```

`coverageMap` is an object like this one:

```json
{
  "src/file.js": {
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
