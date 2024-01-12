# Comparison with jest

Comparing `@jsenv/test` and [Jest](https://github.com/jestjs/jest)<sup>↗</sup>, a popular test framework.

# Introduction

This document is a list of "how to do X" with jest and jsenv. It is split in 2 major parts:

- [Executing tests](#executing-tests)
- [Writing tests](#writing-tests)

The goal is not to say which one is better. The goal is to help the reader make his own opinion about `@jsenv/test`.  
This documentation can also be used to migrate from jest to jsenv, or the other way around.

Finally the [conclusion](#conclusion) highlights the best parts of the approach taken by `@jsenv/test`.

# Executing tests

## Configuring runtime

##### Jest

Jest execute test file inside:

- a child process (default)
- a worker thread

##### @jsenv/test

Jsenv execute test file inside:

- a child process
- a worker thread
- a web browser: Chromium, Webkit, Firefox

There is no default runtime: it must be explicitely configured.  
Test file can be executed on one or many runtime: it's possible to execute tests on chromium and on firefox for example.

## Executing one test in node

##### Jest

```console
jest tests/sum.test.js
```

##### @jsenv/test

```console
node tests/sum.test.js
```

## Executing one test in a web browser

##### Jest

Not available

##### @jsenv/test

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

##### Jest

```console
jest --config=jest.config.cjs
```

```js
// jest.config.cjs
module.exports = {
  rootDir: "./tests/",
};
```

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

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

##### @jsenv/test

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

##### Jest

beforeEach, afterEach, beforeAll and afterAll are scoped per describe block, see https://jestjs.io/docs/setup-teardown#scoping

##### @jsenv/test

Code execution is standard, no documentation needed

### Order of execution

##### Jest

beforeEach, afterEach, beforeAll and afterAll have a special execution order, see https://jestjs.io/docs/setup-teardown#order-of-execution

##### @jsenv/test

Code execution is standard, no documentation needed

## Function calls

Let's imagine we're testing an implementation of a function forEach, which invokes a callback for each item in a supplied array.

```js
// for_each.js
export function forEach(items, callback) {
  for (let index = 0; index < items.length; index++) {
    callback(items[index]);
  }
}
```

##### Jest

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

##### @jsenv/test

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

## Function calls part 2

##### Jest

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

##### @jsenv/test

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

## Numbers

##### Jest

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

##### @jsenv/test

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

##### Jest

```js
const value = 0.1 + 0.2;
expect(value).toBeCloseTo(0.3);
```

##### @jsenv/test

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

##### Jest

```js
expect("team").not.toMatch(/I/);
expect("Christoph").toMatch(/stop/);
```

##### @jsenv/test

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

##### Jest

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
});
```

##### @jsenv/test

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

## Objects

##### Jest

```js
test("object equality", () => {
  expect({ foo: true }).toEqual({ foo: true });
});

test("array equality", () => {
  expect(["a", "b"]).toEqual(["a", "b"]);
});
```

##### @jsenv/test

```js
// object equality
assert({
  actual: { foo: true },
  expected: { foo: true },
});
// array equality
assert({
  actual: ["a", "b"],
  expected: ["a", "b"],
});
```

## Snapshot testing

##### Jest

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

##### @jsenv/test

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

## Mocks

Mock changes the behaviour of the code too deeply. They end up being:

- surprising
- (very) hard to maintain

There is countless articles explaining why mock should be avoided.
The simplest strategy to avoid mock:

- Make code more flexible so that test file does not need mock(s).
- Use integration/end-to-end tests so that do the real things instead of mocking. [playwright](https://playwright.dev/)<sup>↗</sup>, [cypress](https://www.cypress.io/)<sup>↗</sup>, ...

That being said here is how you could mock things with jest and jsenv.

### Mock function return value

##### Jest

```js
const myMock = jest.fn();
console.log(myMock());
// > undefined

myMock.mockReturnValueOnce(10).mockReturnValueOnce("x").mockReturnValue(true);

console.log(myMock(), myMock(), myMock(), myMock());
// > 10, 'x', true, true
```

##### @jsenv/test

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

## Mock modules

##### Jest

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

##### @jsenv/test

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

const testPlanResult = await executeTestPlan({
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

# Conclusion

`@jsenv/test` allows to write test files like standard files. In the end a test file can be executed directly with Node.js or in a web browser.

In that regard:

- Test files will never becomes obsolete or unable to run
- Test files are immediatly compatible with other tools
- Can use VSCode to debug test files written for Node.js in one click
- Can use any browser to execute and debug a test file
- Easier to switch from source files to test files and the other way around: because code is working same way.
