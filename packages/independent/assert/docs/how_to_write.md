## Writing tests with _@jsenv/assert_

This part contain examples where _@jsenv/assert_ is used to write tests.

### Exception

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
  const expect = new TypeError(`circleRadius must be a number, received toto`);
  assert({ actual, expect });
}
```

### Async exception

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
  const expect = new TypeError(`circleRadius must be a number, received toto`);
  assert({ actual, expect });
}
```

> Note how code testing `getCircleArea` is similar in [Assert exception](#assert-exception) and [Assert async exception](#assert-async-exception).

### Callback

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
assert({ actual, expect });
```

> Code above is a great example of [the AAA pattern](./docs/aaa_pattern.md).

### Callback with delay

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
const expect = true;
assert({ actual, expect });
```

### Any

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
const expect = {
  name: "sam",
  creationTime: assert.any(Number),
};
assert({ actual, expect });
```

#### Not

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
const expect = assert.not("toto");
assert({ actual, expect });
```

### Subset of properties

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
const expect = { name: "sam", age: 32 };
assert({ actual, expect });
```
