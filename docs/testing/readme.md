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

The gif below shows how you can explore files to see coverage of `./basic-project/src/platform-name.js`.

![browsing coverage recording](./coverage-browsing-recording.gif)

#### What is `coverage-final.json` ?

At this point you have a `coverage-final.json` file. You can pass it to a code coverage tool and get valuable information from it.<br />

It's important to know that `coverage-final.json` format comes from `instanbul`.<br />
— see [istanbul on github](https://github.com/gotwarlost/istanbul)

The most valuable thing to do with that file is to feed it to some code coverage tool during your continuous integration script.
I have documented one of them named `codecov.io` but you can integrate with pretty much anything else.<br />
— see [uploading coverage to codecov.io](./docs/uploading-coverage-to-codecov.md)

## How to test async code

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
