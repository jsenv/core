## Table of contents

- [Presentation](#Presentation)
- [Code example](#code-example)
- [Concrete example](#concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Execute tests](#2---execute-tests)
  - [3 - Generate test coverage](#3---generate-test-coverage)

## Presentation

To understand how to use jsenv testing let's use it on a "real" project.<br /> We will setup a basic project and execute tests, then see how to get test coverage.

## Code example

The following code uses `@jsenv/core` to execute every files ending with `test.js` inside a directory.

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

### `startContinuousTesting` example

To be documented, in any case it's an experimental for now.
