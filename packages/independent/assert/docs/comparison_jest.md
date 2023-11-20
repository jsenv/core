[Jest](https://github.com/jestjs/jest) is a popular test framework.

This page shows how tests written with jest API could be written using `@jsenv/assert`. The goal is to illustrates the difference in design and should help the reader to make his own opinion about `@jsenv/assert`.

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

_@jsenv/assert:_

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

_@jsenv/assert:_

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

_@jsenv/assert:_

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

_@jsenv/assert:_

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

_@jsenv/assert:_

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

_@jsenv/assert:_

Code executes top to bottom, no documentation needed

### Order of execution

_Jest:_

beforeEach, afterEach, beforeAll and afterAll have a special execution order, see https://jestjs.io/docs/setup-teardown#order-of-execution

_@jsenv/assert:_

Code executes top to bottom, no documentation needed

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
  forEach([0, 1], mockCallback);

  // The mock function was called twice
  expect(mockCallback.mock.calls).toHaveLength(2);

  // The first argument of the first call to the function was 0
  expect(mockCallback.mock.calls[0][0]).toBe(0);

  // The first argument of the second call to the function was 1
  expect(mockCallback.mock.calls[1][0]).toBe(1);
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
  forEach([0, 1], mockCallback);
  assert({
    actual: calls,
    expected: [0, 1],
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

## mock return value API

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
const returnValues = [10, "x"];
const myMock = () => {
  if (callCount < returnValues.length) {
    callCount++;
    return returnValues[callCount];
  }
  return undefined;
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
  actual: "team".match(/I/),
  expected: null,
});
assert({
  actual: "Christoph",
  expected: assert.matchesRegExp(/stop/),
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

## Conclusion

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

`@jsenv/assert` favors standard. As a result code is portable. Switching from a standard file to a test file is designed to be easier and pleasant.
