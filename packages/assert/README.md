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

### Type failure

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

### Prototype failure

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

### Properties order failure

```js
import { assert } from "@jsenv/assert";

const actual = { foo: true, bar: true };
const expected = { bar: true, foo: true };

try {
  assert({ actual, expected });
} catch (e) {
  console.log(e.message);
}
```

```console
AssertionError: unexpected properties order
--- properties order found ---
"foo"
"bar"
--- properties order expected ---
"bar"
"foo"
--- path ---
actual
```

## Usage

For how to use and install, see [docs/usage.md](./docs/usage.md).
