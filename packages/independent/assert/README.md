# assert [![npm package](https://img.shields.io/npm/v/@jsenv/assert.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/assert)

_@jsenv/assert_ is the NPM package used by jsenv to write tests.

It can be resumed by the following quote:

> equal() is my favorite assertion. If the only available assertion in every test suite was equal(), almost every test suite in the world would be better for it.
>
> — Eric Elliot in [Rethinking Unit Test Assertion](https://medium.com/javascript-scene/rethinking-unit-test-assertions-55f59358253f)

## Example

```js
import { assert } from "@jsenv/assert";

assert({
  actual: {
    foo: true,
  },
  expect: {
    foo: false,
  },
});
```

![img](./tests/snapshots/object/basic.svg)

There is 200+ examples in [./tests/snapshots/](./tests/snapshots/README.md#Array)

## How it works

_assert_ does nothing when comparison is successfull but throws an error when comparison is failing.

## Features

### Helps to find the diff

Colors and underlines helps to find the diff in a glimpse.

- grey: same in actual and expect
- underlined: not the same in actual and expect
- red: found in actual and is different
- green: found in expect and is different
- yellow: found only in actual or found only in expect

### Deep understanding of JavaScript natives

```js
assert({
  actual: "http://example.com",
  expect: "http://example.com:8000",
});
```

![img](./url/url_string_port.svg)

## Usage in Node.js

```console
npm i --save-dev @jsenv/assert
```

```js
import { assert } from "@jsenv/assert";

assert({
  actual: true,
  expect: false,
});
```

## Usage in a browser

### Using NPM

```console
npm i --save-dev @jsenv/assert
```

```html
<script type="module">
  import { assert } from "@jsenv/assert";

  assert({
    actual: true,
    expect: false,
  });
</script>
```

### Using CDN

```html
<script type="module">
  import { assert } from "https://unpkg.com/@jsenv/assert@latest/src/main.js";

  assert({
    actual: true,
    expect: false,
  });
</script>
```
