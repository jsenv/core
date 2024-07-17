# D) Test

This page documents how jsenv can be used to write and execute tests. The tests will be executed in a web browser.

If you want to execute tests in Node.js go to [I) Test in Node.js](../i_test_in_node/test_in_node.md).

Best parts of jsenv tests:

- [Isolated environment](#33-isolated-environment) for each test file
- Each test file is executed like a standard file
  - [debugging a test file === debugging a source file](#14-executing-a-single-test)
  - switching from source files to test files is easy, it saves a lot of energy
- Test files can be executed in [Chrome, Firefox and Safari](#32-execute-on-more-browsers)
- [Smart parallelism](#34-parallelism)

<!--
When coding, we spend most of our time working on source files. At some point we switch from source files to test files. Suddenly things are different:

- code does not execute as it would in source files
- some tools are used differently in test files, some cannot be used at all
- you are forced to code in a certain way that is completely different from the one in source files

This huge gap between source files and test files creates a context switching costing a lot of cognitive energy.
-->

# 1. Usage

This section shows how to write a test for a source file and execute it using jsenv.

## 1.1 Project file structure

<pre>
project/
  src/
    <strong>sum.js</strong>
    index.html
  package.json
</pre>

Let's write a test for _sum.js_:

```js
export const sum = (a, b) => a + b;
```

In order to test _sum.js_ a few files will be needed. The impacts on the file structure are summarized below:

```diff
project/
+ scripts/
+   dev.mjs
+   test.mjs
  src/
    sum.js
+   sum.test.html
    index.html
  package.json
```

## 1.2 Writing test

_src/sum.test.html_

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script type="module">
      import { sum } from "./sum.js";

      const actual = sum(1, 2);
      const expect = 3;
      if (actual !== expect) {
        throw new Error(`sum(1,2) should return 3, got ${actual}`);
      }
    </script>
  </body>
</html>
```

## 1.3 Executing tests

_scripts/dev.mjs_: start a web server that is needed to executed _sum.test.html_ in a browser.

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3456,
});
```

_scripts/test.mjs_: execute test file(s).

```js
import { executeTestPlan, chromium } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

Before executing test, install dependencies with the following commands

```console
npm i --save-dev @jsenv/core
npm i --save-dev @jsenv/test
npm i --save-dev @playwright/browser-chromium
```

☝️ [playwright](https://github.com/microsoft/playwright)<sup>↗</sup> is used by `@jsenv/test` to start a web browser (chromium).

Everything is ready, test can be executed with the following command:

```console
node ./scripts/test.mjs
```

It will display the following output in the terminal:

![test](./test_terminal.svg)

## 1.4 Executing a single test

In a real project there would be many test files:

```
project/
  src/
    sum.test.html
    foo.test.html
    bar.test.html
    ... and so on ...
```

Each test file can be executed in isolation, independently, directly in the browser:

![Title 2023-05-10 14-21-49](https://github.com/jsenv/core/assets/443639/81e27d23-4c82-482b-8124-6e63a9e08dfb)

The page is blank because _sum.test.html_ execution completed without error and without displaying something on the page. Some test could render some UI but it's not the case here.

Debugging test execution can be done using browser dev tools:

![Title 2023-05-10 14-18-33](https://github.com/jsenv/core/assets/443639/6be90afb-9092-452a-87b3-fc9eba240bfd)

# 2. Assertions

To have a basic example, the part of the code comparing `actual` and `expect` was done without an assertion library.  
In pratice a test would likely use one. The diff below shows how the assertion can be written using [@jsenv/assert](../../../packages/independent/assert). Note that any other assertion library would work.

```diff
+ import { assert } from "@jsenv/assert";
import { sum } from "./sum.js";

const actual = sum(1, 2);
const expect = 3;
- if (actual !== expect) {
-   throw new Error(`sum(1,2) should return 3, got ${actual}`);
- }
+ assert({ actual, expect });
```

# 3. Features

## 3.1 Web server autostart

Your web server is automatically started if needed. This is done thanks to the `webServer` parameter.

If there is a server listening at `webServer.origin`:

1. Tests are executed, using the server already running.

If there is no server listening at `webServer.origin`:

1. `webServer.moduleUrl` or `webServer.command` is executed in a separate process
2. Code waits for the server to be started, if not started in less than 5s an error is thrown.
3. Test are executed, using the server started in step 1.
4. Once tests are done, server is stopped by killing the process used to start it

## 3.2 Execute on more browsers

```js
import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

Before executing tests, install firefox and webkit dependencies with the following command:

```console
npm i --save-dev @playwright/browser-firefox
npm i --save-dev @playwright/browser-webkit
```

The terminal output:

![test_more](./test_many_browser_terminal.svg)

## 3.3 Isolated environment

Each test is executed in a browser tab using one instance of the browser.

If you need to push isolation even further you can dedicate a browser instance per test.
Use `chromiumIsolatedTab` instead of `chromium`. The same can be done for firefox and webkit.

```js
import { executeTestPlan, chromiumIsolatedTab } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromiumIsolatedTab(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

## 3.4 Parallelism

Executions are started one after an other without waiting for the previous one to finish.  
It's possible to configure parallelism using `parallel` parameter.

```js
import { executeTestPlan, chromium } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  parallel: {
    max: "50%",
    maxCpu: "50%",
    maxMemory: "50%",
  },
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

### 3.4.1 parallel.max

Controls the maximum number of execution started in parallel.

| max | Max executions in parallel            |
| --- | ------------------------------------- |
| 1   | Only one (disable parallelism)        |
| 5   | 5                                     |
| 80% | 80% of cores available on the machine |

The default value is 80%: For a machine with 10 processors, as long as there is less than 8 executions ongoing, remaining executions tries to start in parallel.

Parallelism can also be disabled with `parallel: false` which is equivalent to `parallel: { max: 1 }`.

### 3.4.2 parallel.maxCpu

This parameter prevent an execution to be started in parallel when the process cpu usage is too high.

The default value is 80%: As long as process cpu usage is below 80% of the total cpu available on the machine, remaining executions tries to start in parallel.

### 3.4.3 parallel.maxMemory

This parameter prevent an execution to be started in parallel when memory usage is too high.

The default value is 50%: As long as process memory usage is below 50% of the total memory available on the machine, remaining executions tries to start in parallel.

## 3.5 Allocated time per test

Each file is given 30s to execute.
If this duration is exceeded the browser tab is closed and execution is considered as failed.
This duration can be configured as shown below:

```js
import { executeTestPlan, chromium } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
        allocatedMs: 60_000,
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

## 3.6 Code coverage

It's possible to generate HTML files showing how much code was covered by the execution of test files:

![file js](https://github.com/jsenv/core/assets/443639/cfcc023e-ba41-4825-9ffc-4832cbb82ade)

The coverage above was generated by the following code:

```js
import { executeTestPlan, chromium, reportCoverageAsHtml } from "@jsenv/test";

const testResult = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: true,
});

reportCoverageAsHtml(testResult, new URL("./coverage/", import.meta.url));
```

### 3.6.1 Coverage json

Coverage can be written to a json file.

```js
import { executeTestPlan, chromium, reportCoverageAsJson } from "@jsenv/test";

const testResult = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: true,
});

reportCoverageAsJson(testResult, new URL("./coverage.json", import.meta.url));
```

This JSON file can be given to other tools, for example https://github.com/codecov/codecov-action.

### 3.6.2 Coverage from multiple browsers

Now let's say we want to get code coverage for the following file:

```js
if (window.navigator.userAgent.includes("Firefox")) {
  console.log("firefox");
} else if (window.navigator.userAgent.includes("Chrome")) {
  console.log("chrome");
} else if (window.navigator.userAgent.includes("AppleWebKit")) {
  console.log("webkit");
} else {
  console.log("other");
}
```

The file will be executed by the following html file:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script type="module">
      import "./many.js";
    </script>
  </body>
</html>
```

Now let's use jsenv to execute the HTML file in Firefox, Chrome and Webkit and generate the coverage.

```js
import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  reportCoverageAsHtml,
} from "@jsenv/test";

const testPlanResult = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./client/**/many.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
      webkit: {
        runtime: webkit(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../client/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: true,
});

reportCoverageAsHtml(testResult, new URL("./coverage/", import.meta.url));
```

The resulting coverage looks as follow:

![many js](https://github.com/jsenv/core/assets/443639/54e5ccd3-7a89-4c0c-8184-c7c644024ab7)

And the following warnings in the console:

```console
Coverage conflict on "./client/many.js", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.
--- details ---
This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)
--- suggestion ---
disable this warning with coverage.v8ConflictWarning: false
--- suggestion 2 ---
force coverage using istanbul with coverage.methodForBrowsers: "istanbul"
```

At this point either you disable the warning with `coverage: { v8ConflictWarning: false }`.

Or you force chromium to use "istanbul" so that coverage can be merged with the one from firefox and webkit with `coverage: { methodForBrowsers: "istanbul" }`

![many_istanbul js](https://github.com/jsenv/core/assets/443639/efc740e4-7f99-4fa6-adf0-4b8e2be545de)

## 3.7 Keep browser opened

During test executions browser are opened in headless mode and once all tests are executed all browsers are closed.  
It's possible to display browser and keep them opened using `keepRunning: true`:

```diff
import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
+ keepRunning: true,
});
```

In that case execution timeouts are disabled.

## 3.8 Configuring runtime

The following code forwards custom launch options to playwright

```js
import { executeTestPlan, chromium } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium({
          playwrightLaunchOptions: {
            ignoreDefaultArgs: ["--mute-audio"],
          },
        }),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3456",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
});
```

See https://playwright.dev/docs/api/class-browsertype#browser-type-launch

# 4. JavaScript API

## 4.1 testPlanResult

The value returned by `executeTestPlan` is an object called `testPlanResult`.

```js
import { executeTestPlan } from "@jsenv/test";

const testPlanResult = await executeTestPlan();
```

It contains all execution results and a few more infos

<!-- PLACEHOLDER_START:PREV_NEXT_NAV -->
<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="../c_build/c_build.md">&lt; C) Build</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="../e_referencing_files/e_referencing_files.md">&gt; E) Referencing files</a>
  </td>
 </tr>
<table>
<!-- PLACEHOLDER_END -->
