## Table of contents

- [Presentation](#Presentation)
- [Code example](#code-example)
- [Concrete example](#concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Execute tests](#2---execute-tests)
  - [3 - Generate test coverage](#3---generate-test-coverage)
- [How to test async code](#How-to-test-async-code)

## Presentation

To understand how to use jsenv testing let's use it on a "real" project.<br /> We will setup a basic project and execute tests, then see how to get test coverage.

## Code example

The following code uses `@jsenv/core` to execute every files ending with `test.js` inside a project directory.

```js
const { executeTestPlan, launchNode } = require("@jsenv/core")

executeTestPlan({
  projectDirectoryPath: __dirname,
  testPlan: {
    "./**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

If you want to know more about this function and others check [api documentation](./api.md)

## Concrete example

### 1 - Setup basic project

```console
git clone git@github.com:jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/test/basic-project
```

```console
npm install
```

### 2 - Execute tests

```console
node ./execute-test-plan.js
```

The gif below shows terminal output during execution of `execute-test-plan.js`.

![test terminal recording](./test-terminal-recording.gif)

### 3 - Generate test coverage

```console
node ./execute-test-plan.js --cover
```

It will execute tests and generate `./coverage/` directory with files corresponding to your test coverage.

#### What is coverage/index.html ?

The gif below shows how you can explore your test coverage by opening `coverage/index.html` in your browser.

![browsing coverage recording](./coverage-browsing-recording.gif)

#### What is coverage/coverage.json ?

It is your test plan coverage in JSON format. This format was created by [istanbul](https://github.com/gotwarlost/istanbul) and can be given to coverage tools.

This file exists to be provided to some code coverage tool.
For instance you might want to send `coverage.json` to codecov.io inside during continuous integration workflow.<br />
— see [uploading coverage to codecov.io](./uploading-coverage-to-codecov.md)

## How to test async code

If you want to test async code you must use top level await:

```js
const actual = await Promise.resolve(42)
const expected = 42
if (actual !== expected) throw new Error("should be 42")
```

You must use top level await otherwise your execution is considered done even if your code is still executing as shown in example below:

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
