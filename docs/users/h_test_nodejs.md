# H) Test in Node.js

This section demonstrates how to write and execute tests in Node.js.  
If you want to execute tests in a browser go to [D) Test](./d_test.md).

# 1. File structure

Let's write a test for _sum.mjs_:

```js
export const sum = (a, b) => a + b;
```

_sum.mjs_ is part of the following file structure:

<pre>
project/
  src/
    <strong>sum.mjs</strong>
  package.json
</pre>

In order to test _sum.mjs_ a few files will be needed, the impacts on the file structure are summarized below:

```diff
project/
+ scripts/
+   test.mjs
  src/
    sum.mjs
+   sum.test.mjs
    index.html
  package.json
```

# 2. Writing test

_sum.test.mjs_:

```js
import { sum } from "./sum.mjs";

const actual = sum(1, 2);
const expected = 3;
if (actual !== expected) {
  throw new Error(`sum(1,2) should return 3, got ${actual}`);
}
```

# 3. Executing tests

_scripts/test.mjs_:

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
```

Before executing test, install dependencies with the following command

```console
npm i --save-dev @jsenv/test
```

Everything is ready, test can be executed with the following command:

```console
node ./scripts/test.mjs
```

It will display the following output in the terminal:

```console
✔ execution 1 of 1 completed (all completed)
file: src/sum.test.mjs
runtime: node_worker_thread/16.14.2
duration: 0.08 second

-------------- summary -----------------
1 execution: all completed
total duration: 0.08 second
----------------------------------------
```

# 4. Executing a single test

In a real project there would be many test files in the file structure:

```
project/
  src/
    sum.test.mjs
    foo.test.mjs
    bar.test.mjs
    ... and so on ...
```

Each test file can be executed in isolation, independently, directly with the `node` command.

```console
node ./src/sum.test.mjs
```

Each test file can be debugged directly with tools listed in [Node.js debugging guide](https://nodejs.org/en/docs/guides/debugging-getting-started).  
If you don't know which one to choose, VsCode integrated debugger is excellent.

# 5. Features

## 5.1 process.env

The following code executes test files twice:

- During first execution `process.env.DEMO` is "1"
- During second execution `process.env.DEMO` is "2"

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const testPlanReport = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node_1: {
        runtime: nodeWorkerThread({
          env: { DEMO: "1" },
        }),
      },
      node_2: {
        runtime: nodeWorkerThread({
          env: { DEMO: "2" },
        }),
      },
    },
  },
});
```

See "env" in https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback

If you need to execute a test relying on `process.env` directly with the `node` command, it must be configured accordingly:

```diff
- node ./src/sum.test.mjs
+ DEMO=1 node ./src/sum.test.mjs
```

## 5.2 Command line options

```js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const testPlanReport = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          commandLineOptions: ["--no-warnings"],
        }),
      },
    },
  },
});
```

see https://nodejs.org/api/cli.html#options

If you need to execute a test relying on command line options directly with the `node` command, it must be configured accordingly:

```diff
- node ./src/sum.test.mjs
+ node --no-warnings ./src/sum.test.mjs
```

## 5.3 child process

`nodeWorkerThread` is the default Node.js runtime in this documentation. But there is also `nodeChildProcess` which can be used with the same API and will execute test in a child process instead of a worker thread.

```js
import { executeTestPlan, nodeChildProcess } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess(),
      },
    },
  },
});
```

## 5.4 importmap

This section demonstrates how to remap import during test execution. The demo is remapping _src/sum.mjs_ to _src/sum_mock.mjs_

```diff
project/
  scripts/
    test.mjs
  src/
+  sum_mock.mjs
   sum.mjs
   sum.test.mjs
```

_sum_mock.mjs_:

```js
export const sum = () => 42;
```

_scripts/test.mjs_:

```diff
import {
  executeTestPlan,
  nodeWorkerThread,
} from "@jsenv/test"

const testPlanReport = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
-       runtime: nodeWorkerThread(),
+       runtime: nodeWorkerThread({
+         importMap: {
+           imports: {
+              "./src/sum.mjs": "./src/sum_mock.mjs"
+           },
+         },
+       }),
      },
    },
  },
})
```

Executing code above would output the following

```console
✖ execution 1 of 1 failed (all failed)
file: src/sum.test.mjs
runtime: node_worker_thread/16.14.2
duration: 0.2 second
-------- error --------
Error: sum(1,2) should return 3, got 42
    at [...]src/sum.test.mjs:6:9
    at [...]
-------------------------

-------------- summary -----------------
1 execution: all failed
total duration: 0.2 second
----------------------------------------
```

☝️ The test is now failing as "sum" exported in _sum_mock.mjs_ always return `42`.

If you need to execute a test relying on importmap directly with the `node` command, it must be configured accordingly:

```diff
- node ./src/sum.test.mjs
+ node --experimental-loader @node-loader/import-maps ./src/sum.test.mjs
```

You'll need to create an importmap file and install [node-loader-importmap](https://github.com/node-loader/node-loader-import-maps)

## 5.5 Code coverage

TODO: same as [D) Test#code_coverage](<D)-Test#66-code-coverage>) except screenshots

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./g_jsenv_plugins.md">< G) Jsenv plugins</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./i_build_nodejs.md">> I) Build for Node.js</a>
  </td>
 </tr>
<table>
