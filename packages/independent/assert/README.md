# assert [![npm package](https://img.shields.io/npm/v/@jsenv/assert.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/assert)

_@jsenv/assert_ is the NPM package used by jsenv to write tests.

It can be resumed by the following quote:

> equal() is my favorite assertion. If the only available assertion in every test suite was equal(), almost every test suite in the world would be better for it.
>
> — Eric Elliot in [Rethinking Unit Test Assertion](https://medium.com/javascript-scene/rethinking-unit-test-assertions-55f59358253f)

## Example

```js
import { assert } from "@jsenv/assert";

const actual = { foo: false };
const expected = { foo: true };
assert({ actual, expected });
```

```console
> node ./docs/demo.mjs

AssertionError: unequal values
--- found ---
false
--- expected ---
true
--- path ---
actual.foo
```

## How it works

_assert_ does nothing when comparison is successfull but throws an error when comparison is failing.
To illustrates when a comparison fails, check the list of examples below

_Type failure:_

```js
import { assert } from "@jsenv/assert";

const actual = 10;
const expected = "10";

try {
  assert({ actual, expected });
} catch (e) {
  console.log(e.message);
}
```

```console
AssertionError: unequal values
--- found ---
10
--- expected ---
"10"
--- path ---
actual
```

_Prototype failure:_

```js
import { assert } from "@jsenv/assert";

const actual = new TypeError();
const expected = new Error();

try {
  assert({ actual, expected });
} catch (e) {
  console.log(e.message);
}
```

```console
AssertionError: unequal prototypes
--- prototype found ---
window.TypeError.prototype
--- prototype expected ---
window.Error.prototype
--- path ---
actual[[Prototype]]
```

## Usage in Node.js

```console
npm i --save-dev @jsenv/assert
```

```js
import { assert } from "@jsenv/assert";
```

## Usage in a browser via CDN

```html
<script type="module">
  import { assert } from "https://unpkg.com/@jsenv/assert@latest/src/main.js";

  assert({
    actual: true,
    expected: false,
  });
</script>
```

## Usage in a browser via NPM

```console
npm i --save-dev @jsenv/assert
```

```html
<script type="module">
  import { assert } from "@jsenv/assert";

  assert({
    actual: true,
    expected: false,
  });
</script>
```

## Writing tests with _@jsenv/assert_

This part contain examples where _@jsenv/assert_ is used to write tests.

#### Assert exception

```js
import { assert } from "@jsenv/assert";

const getCircleArea = (circleRadius) => {
  if (isNaN(circleRadius)) {
    throw new TypeError(
      `circleRadius must be a number, received ${circleRadius}`,
    );
  }
  return circleRadius * circleRadius * Math.PI;
};

try {
  getCircleArea("toto");
  throw new Error("should throw"); // this line throw if getCircleArea does not throw as it should
} catch (error) {
  const actual = error;
  const expected = new TypeError(
    `circleRadius must be a number, received toto`,
  );
  assert({ actual, expected });
}
```

#### Assert async exception

```js
import { assert } from "@jsenv/assert";

const getCircleArea = async (circleRadius) => {
  if (isNaN(circleRadius)) {
    throw new TypeError(
      `circleRadius must be a number, received ${circleRadius}`,
    );
  }
  return circleRadius * circleRadius * Math.PI;
};

try {
  await getCircleArea("toto");
  throw new Error("should throw"); // this line throw if getCircleArea does not throw as it should
} catch (error) {
  const actual = error;
  const expected = new TypeError(
    `circleRadius must be a number, received toto`,
  );
  assert({ actual, expected });
}
```

> Note how code testing `getCircleArea` is similar in [Assert exception](#assert-exception) and [Assert async exception](#assert-async-exception).

#### Assert callback is called

```js
import { assert } from "@jsenv/assert";

const createAbortSignal = () => {
  const abortSignal = {
    onabort: () => {},
    abort: () => {
      abortSignal.onabort();
    },
  };

  return abortSignal;
};

// arrange
const abortSignal = createAbortSignal();
let called = false;
abortSignal.onabort = () => {
  called = true;
};

// act
abortSignal.abort();

// assert
const actual = called;
const expected = true;
assert({ actual, expected });
```

> Code above is a great example of [the AAA pattern](./docs/AAA_pattern.md).

#### Assert callback will be called

```js
import { assert } from "@jsenv/assert";

const callAfter50Ms = (callback) => {
  setTimeout(callback, 50);
};

let called = false;
callAfter50Ms(() => {
  called = true;
});
await new Promise((resolve) => setTimeout(resolve, 80));
const actual = called;
const expected = true;
assert({ actual, expected });
```

### Assert any value of a given type

```js
import { assert } from "@jsenv/assert";

const createUser = () => {
  return {
    name: "sam",
    creationTime: Date.now(),
  };
};

const user = createUser();
const actual = user;
const expected = {
  name: "sam",
  creationTime: assert.any(Number),
};
assert({ actual, expected });
```

#### Assert an other value

```js
import { assert } from "@jsenv/assert";

const getRandomDifferentUserName = (user) => {
  const getRandomName = () => {
    return Array.from({ length: 4 })
      .map(() => getRandomLetter())
      .join("");
  };
  const getRandomLetter = () => {
    return ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  };
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

  const randomName = getRandomName();
  if (randomName === user.name) {
    return getRandomDifferentUserName(user);
  }
  return randomName;
};

const name = getRandomDifferentUserName({ name: "toto" });
const actual = name;
const expected = assert.not("toto");
assert({ actual, expected });
```

#### Assert some object properties

```js
import { assert } from "@jsenv/assert";

const getUser = () => {
  return {
    name: "sam",
    age: 32,
    friends: [], // poor sam :(
  };
};

const user = getUser();
const actual = { name: user.name, age: user.age };
const expected = { name: "sam", age: 32 };
assert({ actual, expected });
```
