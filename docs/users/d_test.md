# D) Test

This section demonstrates how to write and execute tests with jsenv. The tests will be executed in a web browser.  
If you want to execute tests in Node.js go to [H) Test in Node.js](./h_test_nodejs.md).

# 1. File structure

Let's write a test for _sum.js_:

```js
export const sum = (a, b) => a + b;
```

_sum.js_ is part of the following file structure:

<pre>
project/
  src/
    <strong>sum.js</strong>
    index.html
  package.json
</pre>

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

# 2. Writing test

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
      const expected = 3;
      if (actual !== expected) {
        throw new Error(`sum(1,2) should return 3, got ${actual}`);
      }
    </script>
  </body>
</html>
```

# 3. Executing tests

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
npm i --save-dev playwright
```

☝️ [playwright](https://github.com/microsoft/playwright)<sup>↗</sup> is used by `@jsenv/test` to start a web browser.

Everything is ready, test can be executed with the following command:

```console
node ./scripts/test.mjs
```

It will display the following output in the terminal:

```console
✔ execution 1 of 1 completed (all completed)
file: src/sum.test.html
runtime: chromium/112.0.5615.29
duration: 0.7 second

-------------- summary -----------------
1 execution: all completed
total duration: 0.8 second
----------------------------------------
```

# 4. Executing a single test

In a real project there would be many test files in the file structure:

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

# 5. Assertion library

To have a basic example, the part of the code comparing `actual` and `expected` was done without an assertion library.  
In pratice a test would likely use one. The diff below shows how the assertion can be written using [@jsenv/assert](../assert). Note that any other assertion library would work.

```diff
+ import { assert } from "@jsenv/assert"
import { sum } from "./sum.js"

const actual = sum(1, 2)
const expected = 3
- if (actual !== expected) {
-   throw new Error(`sum(1,2) should return 3, got ${actual}`)
- }
+ assert({ actual, expected })
```

# 6. Features

## 6.1 web server autostart

TODO

- [ ] Explain that executeTestPlan check if `webServer.origin` is listened and, if not, does a dynamic import on `webServer.moduleUrl`
- [ ] A word to say that any standard web server can be used

## 6.2 Executing on more browsers

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

The terminal output would be the following:

```console
✔ execution 1 of 3 completed (all completed)
file: src/sum.test.html
runtime: chromium/112.0.5615.29
duration: 0.7 second

✔ execution 2 of 3 completed (all completed)
file: src/sum.test.html
runtime: firefox/111.0
duration: 0.9 second

✔ execution 3 of 3 completed (all completed)
file: src/sum.test.html
runtime: webkit/16.4
duration: 0.4 second

-------------- summary -----------------
3 executions: all completed
total duration: 4.1 seconds
----------------------------------------
```

## 6.3 Allocated time

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

## 6.4 Configuring logs

TODO:

- [ ] Document logShortForCompletedExecutions: true (code example + screenshot)
- [ ] Document logMergeForCompletedExecutions: true (code example + screenshot)

## 6.5 importmap

TODO:

- [ ] Explain that importmap can be used in the HTML file to mock file during test execution

## 6.6 Code coverage

It's possible to collect code coverage while executing tests:

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
+ coverageEnabled: true,
+ coverageReportJson: true,
+ coverageReportJsonFileUrl: new URL("../.coverage/coverage.json", import.meta.url),
+ coverageReportHtml: true,
+ coverageReportHtmlDirectoryUrl: new URL("../.coverage/", import.meta.url),
});
```

Terminal output after executing tests:

```console
✔ execution 1 of 1 completed (all completed)
file: src/sum.test.html
runtime: chromium/113.0.5672.53
duration: 0.8 second

-------------- summary -----------------
1 execution: all completed
total duration: 1 second
----------------------------------------
-> /Users/d.maillard/dev/jsenv/jsenv-core/docs/demo_test_web_coverage/.coverage/index.html
-> /Users/d.maillard/dev/jsenv/jsenv-core/docs/demo_test_web_coverage/.coverage/coverage.json (1.1 kB)
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 sum.js   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
```

The HTML coverage can be opened in a browser:

![Code coverage report for sum js 2023-05-11 09-46-17](https://github.com/jsenv/core/assets/443639/4190f398-86e7-4fb9-8c80-c4651d5ef9fd)

When coverage is enabled and tests are runned on multiple browser, you'll encounter the following warning:

```console
Coverage conflict on "./src/file.js", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.
--- details ---
This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)
--- suggestion ---
disable this warning with coverageV8ConflictWarning: false
--- suggestion 2 ---
force coverage using istanbul with coverageMethodForBrowsers: "istanbul"
```

Consequently code specific to firefox and webkit is considered as not covered:

![image](https://github.com/jsenv/core/assets/443639/82d6f628-b4e0-412a-a1a4-15fda409b0ff)

By default coverages from firefox and webkit are ignored because:

- Chromium coverage is collected using v8
- Firefox and Webkit coverage are collected using istanbul
- v8 coverage and istanbul coverages cannot be merged, see https://github.com/istanbuljs/v8-to-istanbul/issues/144
- v8 coverage is faster and more precise
- coverage from Chromium only is enough

It's still possible to obtain coverage from all browsers by using coverageMethodForBrowsers: "istanbul":

![image](https://github.com/jsenv/core/assets/443639/f797f2f9-c985-4349-be28-9afdf78452be)

## 6.7 Isolated tab

Each test is executed in a browser tab using one instance of the browser.
It's possible, but a bit slower, to dedicate a browser instance per test using the following runtimes:

```js
import {
  chromiumIsolatedTab,
  firefoxIsolatedTab,
  webkitIsolatedTab,
} from "@jsenv/test";
```

## 6.8 Keep browser opened

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

## 6.9 Configuring execution

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

# 7. JavaScript API

## 7.1 testPlanReport

The value returned by `executeTestPlan` is an object called `testPlanReport`.

```js
import { executeTestPlan } from "@jsenv/test";

const testPlanReport = await executeTestPlan();
```

It contains all execution results and a few more infos

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./c_build.md">< C) Build</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./e_referencing_files">> E) Referencing files</a>
  </td>
 </tr>
<table>
