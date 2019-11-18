# Table of contents

- [Example](#executeTestPlan)
- [Parameters](#parameters)
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
- [Return value](#return-value)
  - [testPlanSummary](#testPlanSummary)
  - [testPlanReport](#testPlanReport)
  - [testPlanCoverageMap](#testPlanCoverageMap)

# Example

> `executeTestPlan` is a function executing test files in one or several platforms logging progression and optionnaly generating associated coverage.

Implemented in [src/executeTestPlan.js](../../src/executeTestPlan.js), you can use it as shown below.

```js
const { executeTestPlan, launchNode } = require("@jsenv/core")

executeTestPlan({
  projectDirectoryPath: __dirname,
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
  coverageJsonFileRelativePath: "./coverage/coverage.json",
})
```

The code above executes every files ending with .test.js inside node and write the associated coverage into a file in json format.

# Parameters

`executeTestPlan` uses named parameters documented here.

Each parameter got a dedicated section to shortly explain what it does and if it's required or optional.

## testPlan

> `testPlan` is an object describing where are your test files and how they should be executed.

This is an optional parameter with a default value of:

```js
{
 "./test/**/*.test.js": {
  node: {
    launch: launchNode,
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

A function capable to launch a platform.<br />
This option is **required**

#### allocatedMs

A number representing the amount of milliseconds allocated for this file execution to complete.<br />
This option is optional with a default value of 30s.

#### measureDuration

A boolean controlling if file execution duration is measured and reported back.<br />
This option is optional with a default value of true.

When true `startMs`, `endMs` properties are availabe on every execution result inside [testPlanReport](#testPlanReport)

#### captureConsole

A boolean controlling if console logs are captured during file execution and reported back.<br />
This option is optional with a default value of true.

When true `platformLog` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### collectNamespace

A boolean controlling if file exports are collected and reported back.<br />
This option is optional with a default value of false.

When true `namespace` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### collectCoverage

A boolean controlling if coverage related to this execution is collected and reported back.

This option is optional with a default value of false.

When true `coverageMap` property is availabe on every execution result inside [testPlanReport](#testPlanReport)

#### logSuccess

A boolean controlling if execution success is logged in your terminal.<br />
This option is optional with a default value of true.

When false and execution completes normally nothing is logged.

## executionDefaultOptions

> `executionDefaultOptions` are the default option used to execute file.

This is an optional parameter with a default value of:

<!-- prettier-ignore -->
```js
{}
```

`executionDefaultOptions` was designed to define options shared by file execution.<br />
These option can be overriden per file using [testPlan](#testPlan) parameter.

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

> `concurrencyLimit` is a number representing the max amount of execution allowed to run simultaneously.

This parameter is optional with a default value of

```js
Math.max(require("os").cpus.length - 1, 1)
```

To ensure one execution at a time you can pass `1`.

## measurePlanExecutionDuration

> `measurePlanExecutionDuration` is a boolean controlling if test plan execution duration is measured, logger and reported.

This parameter is optional with a default value of `false`.

When true, `startMs`, `endMs` properties are available on [testPlanSummary](#testPlanSummary).<br />
When true, a log will indicates test plan duration.

## coverage

TODO and all coverage params

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryPath](../shared-parameters.md#projectDirectoryPath)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)

# Return value

`executeTestPlan` returns signature is `{ summary, report, coverageMap }`

## testPlanSummary

> `testPlanSummary` is an object describing quickly how the testPlan execution went.

It is returned by `executeTestPlan`, see below an example

```js
const { summary } = await executeTestPlan({
  projectDirectoryPath: __dirname,
  testPlan: {},
})
```

returns

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

> `testPlanReport` is an object containing information about every test plan file execution.

It is returned by `executeTestPlan`, see below an example

```js
const { report } = await executeTestPlan({
  projectDirectoryPath: __dirname
  testPlan: {
    "./test/file.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

Returns

```json
{
  "./test/file.test.js": {
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

## testPlanCoverageMap

> `testPlanCoverageMap` is an object is the coverage of your test plan, it aggregates every file execution coverage.

It is returned by `executeTestPlan`, see below an example

```js
const { coverageMap } = await executeTestPlan({
  projectDirectoryPath: __dirname
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

Returns an object like this one:

```json
{
  "src/file.js": {
    "path": "src/file.js",
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
