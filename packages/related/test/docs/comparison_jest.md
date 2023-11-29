# Comparison with jest

Comparing `@jsenv/test` and with [Jest](https://github.com/jestjs/jest)<sup>↗</sup>, a popular test framework.

# Introduction

This document is a list of "how to do X" with jest and jsenv. It is split in 2 major parts:

- [Executing tests](#executing-tests)
- [Writing tests](#writing-tests)

The goal is not to say one is better than ther other. It is to help the reader make his own opinion about `@jsenv/test`. It can also be used to migrate from jest to jsenv. Or the other way around.

The [conclusion](#conclusion) highlights the best parts of the approach taken by `@jsenv/tests`.

# Executing tests

## Configuring runtime

_Jest:_

Jest execute test file inside:

- a child process (default)
- a worker thread

_@jsenv/test_:

Jsenv execute test file inside:

- a child process
- a worker thread
- a web browser: Chromium, Webkit, Firefox

There is no default runtime: it must be explicitely configured.  
Test file can be executed on one or many runtime: it's possible to execute tests on chromium and on firefox for example.

## Executing one test in node

_Jest_:

```console
jest tests/sum.test.js
```

_@jsenv/test_:

```console
node tests/sum.test.js
```

## Executing one test in a web browser

_Jest_:

Not available

_@jsenv/test_:

Write your test in a file like `sum.test.html`:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <script type="module" src="sum.test.js"></script>
  </body>
</html>
```

1. Start your web server
2. Open a web browser (chrome, firefox, safari, ...)
3. Go to `http://localhost/tests/sum.test.html`
4. Use browser devtools to debug test execution

## Executing all tests

_Jest_:

```console
jest --config=jest.config.cjs
```

```js
// jest.config.cjs
module.exports = {
  rootDir: "./tests/",
};
```

_@jsenv/test_:

```console
node ./scripts/test.js
```

```js
// scripts/test.js
import {
  executeTestPlan,
  nodeWorkerThread,
  chromium,
  firefox,
} from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./tests/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
    },
  },
});
```

## Configuring timeout

The goal is to configure a timeout for all tests and a custom timeout for "_tests/sum.test.js_".

_Jest_:

```js
// jest.config.cjs
module.exports = {
  rootDir: "./tests/",
  testTimeout: 30_000,
};
```

```js
// sum.test.js
jest.setTimeout(60_000);
```

_@jsenv/test_:

```js
// scripts/test.js
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  testPlan: {
    "./tests/**/*.test.js": {
      runtime: nodeWorkerThread(),
      allocatedMs: 30_000,
    },
    "./tests/**/sum.test.js": {
      runtime: nodeWorkerThread(),
      allocatedMs: 60_000,
    },
  },
});
```

# Writing tests

## Exceptions

_Jest:_

```js
function compileAndroidCode() {
  throw new Error("wrong JDK!");
}

test("compiling android goes as expected", () => {
  expect(() => compileAndroidCode()).toThrow();
  expect(() => compileAndroidCode()).toThrow(Error);

  // You can also use a string that must be contained in the error message or a regexp
  expect(() => compileAndroidCode()).toThrow("wrong JDK");
  expect(() => compileAndroidCode()).toThrow(/JDK/);

  // Or you can match an exact error message using a regexp like below
  expect(() => compileAndroidCode()).toThrow(/^wrong JDK$/); // Test fails
  expect(() => compileAndroidCode()).toThrow(/^wrong JDK!$/); // Test pass
});
```

_@jsenv/test:_

```js
function compileAndroidCode() {
  throw new Error("wrong JDK!");
}

// compiling android goes as expected
try {
  compileAndroidCode();
  throw new Error("unexpected");
} catch (e) {
  // test error type + message
  assert({
    actual: e,
    expected: new Error("wrong JDK!"),
  });
  // test only the error type
  assert({
    actual: e,
    expected: assert.any(Error),
  });
  // test only the message
  assert({
    actual: e.message,
    expected: "wrong JDK!",
  });
}
```

## Async via promises

_Jest:_

```js
test("the data is peanut butter", async () => {
  const data = await fetchData();
  expect(data).toBe("peanut butter");
});

test("the fetch fails with an error", async () => {
  expect.assertions(1);
  try {
    await fetchData();
  } catch (e) {
    expect(e).toMatch("error");
  }
});
```

_@jsenv/test:_

```js
// the data is peanut butter
{
  const data = await fetchData();
  assert({
    actual: data,
    expected: "peanut butter",
  });
}
// the fetch fails with an error
{
  try {
    await fetchData();
    throw new Error("unexpected");
  } catch (e) {
    assert({
      actual: e,
      expected: new Error("error"),
    });
  }
}
```

## Async via callback

_Jest:_

```js
test("the data is peanut butter", (done) => {
  function callback(error, data) {
    if (error) {
      done(error);
      return;
    }
    try {
      expect(data).toBe("peanut butter");
      done();
    } catch (error) {
      done(error);
    }
  }

  fetchData(callback);
});
```

_@jsenv/test:_

```js
// the data is peanut butter
{
  const data = await new Promise((resolve, reject) => {
    fetchData((error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
  assert({
    actual: data,
    expected: "peanut butter",
  });
}
```

## Setup and teardown

### beforeEach/afterEach

_Jest:_

```js
beforeEach(() => {
  return initializeCityDatabase();
});

afterEach(() => {
  return clearCityDatabase();
});

test("city database has Vienna", () => {
  expect(isCity("Vienna")).toBeTruthy();
});

test("city database has San Juan", () => {
  expect(isCity("San Juan")).toBeTruthy();
});
```

_@jsenv/test:_

```js
const test = async (expectedCity) => {
  await initializeCityDatabase();
  assert({
    actual: isCity(expectedCity),
    expected: true,
  });
  await clearCityDatabase();
};

// city database has Vienna"
await test("Vienna");
// city database has "San Juan"
await test("San Juan");
```

### beforeAll/afterAll

_Jest:_

```js
beforeAll(() => {
  return initializeCityDatabase();
});

afterAll(() => {
  return clearCityDatabase();
});

test("city database has Vienna", () => {
  expect(isCity("Vienna")).toBeTruthy();
});

test("city database has San Juan", () => {
  expect(isCity("San Juan")).toBeTruthy();
});
```

_@jsenv/test:_

```js
await initializeCityDatabase();
try {
  // "city database has Vienna"
  assert({
    actual: isCity("Vienna"),
    expected: true,
  });
  // "city database has San Juan"
  assert({
    actual: isCity("San Juan"),
    expected: true,
  });
} finally {
  await clearCityDatabase();
}
```

### Scoping

_Jest:_

beforeEach, afterEach, beforeAll and afterAll are scoped per describe block, see https://jestjs.io/docs/setup-teardown#scoping

_@jsenv/test:_

Code execution is standard, no documentation needed

### Order of execution

_Jest:_

beforeEach, afterEach, beforeAll and afterAll have a special execution order, see https://jestjs.io/docs/setup-teardown#order-of-execution

_@jsenv/test:_

Code execution is standard, no documentation needed

## Mock functions (also called spy)

Let's imagine we're testing an implementation of a function forEach, which invokes a callback for each item in a supplied array.

```js
// for_each.js
export function forEach(items, callback) {
  for (let index = 0; index < items.length; index++) {
    callback(items[index]);
  }
}
```

_Jest:_

```js
const { forEach } = require("./for_each");

const mockCallback = jest.fn((x) => 42 + x);

test("forEach mock function", () => {
  forEach(["a", "b"], mockCallback);

  // The mock function was called twice
  expect(mockCallback.mock.calls).toHaveLength(2);

  // The first argument of the first call to the function was "a"
  expect(mockCallback.mock.calls[0][0]).toBe("a");

  // The first argument of the second call to the function was "b"
  expect(mockCallback.mock.calls[1][0]).toBe("b");
});
```

_@jsenv/assert:_

```js
import { assert } from "@jsenv/assert";
import { forEach } from "./for_each.js";

const calls = [];
const mockCallback = (value) => {
  calls.push(value);
};
// forEach mock function
{
  forEach(["a", "b"], mockCallback);
  assert({
    actual: calls,
    expected: ["a", "b"],
  });
}
```

## Mock function API

_Jest:_

```js
// The function was called exactly once
expect(someMockFunction.mock.calls).toHaveLength(1);

// The first arg of the first call to the function was 'first arg'
expect(someMockFunction.mock.calls[0][0]).toBe("first arg");

// The second arg of the first call to the function was 'second arg'
expect(someMockFunction.mock.calls[0][1]).toBe("second arg");

// The first argument of the last call to the function was 'test'
expect(someMockFunction.mock.lastCall[0]).toBe("test");
```

_@jsenv/assert:_

```js
// The function was called exactly once
assert({
  actual: calls.length,
  expected: 1,
});

// The first arg of the first call to the function was 'first arg'
// The second arg of the first call to the function was 'second arg'
expect({
  actual: calls[0],
  expected: ["first arg", "second arg"],
});

// The first argument of the last call to the function was 'test'
expect({
  actual: calls[calls.length - 1],
  expected: ["test"],
});
```

## Mock function return value API

_Jest:_

```js
const myMock = jest.fn();
console.log(myMock());
// > undefined

myMock.mockReturnValueOnce(10).mockReturnValueOnce("x").mockReturnValue(true);

console.log(myMock(), myMock(), myMock(), myMock());
// > 10, 'x', true, true
```

_@jsenv/assert:_

```js
let callCount = 0;
const myMock = () => {
  if (callCount === 0) {
    callCount++;
    return 10;
  }
  if (callCount === 1) {
    callCount++;
    return "x";
  }
  return true;
};

console.log(myMock(), myMock(), myMock(), myMock());
// > 10, 'x', true, true
```

## Numbers

_Jest:_

```js
const value = 2 + 2;
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3.5);
expect(value).toBeLessThan(5);
expect(value).toBeLessThanOrEqual(4.5);
// toBe and toEqual are equivalent for numbers
expect(value).toBe(4);
expect(value).toEqual(4);
```

_@jsenv/assert:_

```js
const value = 2 + 2;
assert({
  actual: value > 3,
  expected: true,
});
assert({
  actual: value > 3.5,
  expected: true,
});
assert({
  actual: value < 5,
  expected: true,
});
assert({
  actual: value <= 4.5,
  expected: true,
});
// no need to think about toBe nor toEqual
assert({
  actual: value,
  expected: 4,
});
```

## Floats

_Jest:_

```js
const value = 0.1 + 0.2;
expect(value).toBeCloseTo(0.3);
```

_@jsenv/assert:_

```js
const value = 0.1 + 0.2;
assert({
  actual: value.toFixed(1),
  expected: 0.3,
});
```

If you absolutely need the closeTo behaviour you can use

```js
const value = 0.1 + 0.2;
assert({
  actual: value,
  expected: assert.closeTo(0.3),
});
```

## Strings

_Jest:_

```js
expect("team").not.toMatch(/I/);
expect("Christoph").toMatch(/stop/);
```

_@jsenv/assert:_

```js
assert({
  actual: /I/.test("team"),
  expected: false,
});
assert({
  actual: /stop/.test("Christoph")
  expected: true,
});
```

## Arrays

_Jest:_

```js
const shoppingList = [
  "diapers",
  "kleenex",
  "trash bags",
  "paper towels",
  "milk",
];
test("the shopping list has milk on it", () => {
  expect(shoppingList).toContain("milk");
  expect(new Set(shoppingList)).toContain("milk");
});
```

_@jsenv/assert:_

```js
const shoppingList = [
  "diapers",
  "kleenex",
  "trash bags",
  "paper towels",
  "milk",
];
assert({
  actual: shoppingList.includes("milk"),
  expected: true,
});
```

## Mock modules

_jest_:

```js
import axios from "axios";
import Users from "./users";

jest.mock("axios");

test("should fetch users", () => {
  const users = [{ name: "Bob" }];
  const resp = { data: users };
  axios.get.mockResolvedValue(resp);

  // or you could use the following depending on your use case:
  // axios.get.mockImplementation(() => Promise.resolve(resp))

  return Users.all().then((data) => expect(data).toEqual(users));
});
```

:point_up: This is a super bad practice, I hope you don't have to do this.
If you really don't have a choice it's doable with jsenv as follow:

_@jsenv_:

```js
// "tests/axios.mock.js"
export const axiosMock = {
  get: () => undefined,
};

export default axiosMock;
```

```js
// users.test.js
import { axiosMock } from "axios";
import { assert } from "@jsenv/assert";

import Users from "./users.js";

// should fetch users
{
  const users = [{ name: "Bob" }];
  const resp = { data: users };
  axiosMock.get = () => {
    return { data: users };
  };
  const actual = await Users.all();
  const expected = users;
  assert({ actual, expected });
}
```

Mock `"axios"` on browsers using importmap:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <script type="importmap">
      {
        "imports": {
          "axios": "/tests/mocks/axios.mock.js"
        }
      }
    </script>
    <script type="module" src="users.test.js"></script>
  </body>
</html>
```

Mock axios on Node.js using importmap:

```js
// associate an importMap to "users.test.js"
// see also https://github.com/jsenv/core/wiki/I)-Test-in-Node.js#54-importmap
import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const testPlanReport = await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./**/users.test.js": {
      node: {
        runtime: nodeWorkerThread({
          importMap: {
            imports: {
              axios: "/tests/mocks/axios.mock.js",
            },
          },
        }),
      },
    },
  },
});
```

## Snapshot testing

_Jest:_

```js
import renderer from "react-test-renderer";
import Link from "../Link";

it("renders correctly", () => {
  const tree = renderer
    .create(<Link page="http://www.facebook.com">Facebook</Link>)
    .toJSON();
  expect(tree).toMatchSnapshot();
});
```

_@jsenv/test:_

```js
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://localhost:8000`);
  await page.waitForSelector(".link_to_facebook", { timeout: 5_000 });
  const linkElementOuterHTML = await page.evaluate(
    /* eslint-disable no-undef */
    () => {
      return document.querySelector(".link_to_facebook").outerHTML;
    },
    /* eslint-enable no-undef */
  );
  writeFileSync(new URL("./link_to_facebook.html", snapshotDirectoryUrl));
  browser.close();
}
directorySnapshot.compare();
```

# Conclusion

<!--
TODO: rewrite this the other way around:
"jest does X so I can't do Y"
->
"@jsenv does X so I can do Y"

for example debugging withing vscode in one click

### Code execution flow

Jest provide an API to regroup code into blocks depending what it does:

- describe, beforeAll, beforeEach, test, afterEach, afterAll

These apis allow to identify code is special but disturbs while reading the code. The top-down execution flow is not that simple anymore.
Code execution flow with jest is not standard, see [Scoping](#scoping) and [Order of execution](#order-of-execution).
As a result **only jest can execute test files**: you cannot use other tools without configuration/plugins:

- a VSCode plugin to debug test file execution
- configure ESLint to allow "describe/test/beforeEach/afterEach/beforeAll/afterAll" magic globals
- ...and more...

### Testing exception

Jest has a specific way to test code throwing exceptions, see [Exceptions](#exceptions).
When the exception is thrown by async functions the API is different, see [Async via promises](#async-via-promises).
As a result, when code throw exception, the jest way to write assertions is different. And depending if the assertion is sync or async you have to use two different assertion API.

### Code portability

Jest api makes code dependent on jest:

- tools cannot execute test files without plugins/configuration
- humans cannot read test files without documentation

As a result switching from a source file to a test file cost cognitivie energy. You might even need to re-read Jest documentation to remember what's going on (see https://jestjs.io/docs/setup-teardown).

`@jsenv/assert` favors standard. As a result code is portable. Switching from a standard file to a test file is designed to be easier and pleasant. -->
