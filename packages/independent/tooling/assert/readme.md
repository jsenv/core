# assert

[![npm package](https://img.shields.io/npm/v/@jsenv/assert.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/assert)

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

![img](./tests/_object.test.js/basic/throw.svg)

There is 200+ examples in [./tests/](./tests/readme.md)

## How it works

_assert_ does nothing when comparison is successfull but throws an error when comparison is failing.

## Features

### Colors

The message produced have colors that helps to see the diff. Each color have a meaning described below:

| Color  | Meaning                                       |
| ------ | --------------------------------------------- |
| grey   | same in actual and expect                     |
| red    | different from expect                         |
| green  | different from actual                         |
| yellow | exists only in actual / exists only in expect |

### JavaScript aware

Comparison understands JavaScript and makes the diff more redable

```js
assert({
  actual: 149600000,
  expect: 1464301,
});
```

![img](./tests/_number.test.js/149_600_000_and_1_464_301/throw.svg)

This includes things like comparison on url parts, date parts, http headers and many more.

### Multiline diff

```js
assert({
  actual: {
    foo: `Hello,
my name is Benjamin
and my brother is joe`,
  },
  expect: {
    foo: `Hello,
my name is Ben
and my brother is joe`,
  },
});
```

![img](./tests/_string_multiline.test.js/second_line_contains_extra_chars/throw.svg)

### Keep long diff readable

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "http://example_that_is_quite_long.com/dir/file.css",
});
```

![img](./tests/_max_columns.test.js/long_url_diff_at_end/throw.svg)

### Keep nested diff readable

When the diff is very deep the message omits the parents to keep the message concise and readable

```js
assert({
  actual: {
    the: {
      nesting: {
        is: {
          very: {
            deep: {
              in: {
                this: {
                  one: {
                    foo: {
                      a: true,
                      tata: { test: true, bar: { a: "1" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  expect: {
    the: {
      nesting: {
        is: {
          very: {
            deep: {
              in: {
                this: {
                  one: {
                    foo: false,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
```

![img](./tests/_object.test.js/max_depth/throw.svg)

### Custom assertions

```js
assert({
  actual: 50,
  expect: assert.between(100, 200),
});
```

![img](./tests/_assert_between.test.js/50_is_too_small/throw.svg)

### And much more

- Support comparison between value having circular references
- Can detect diff on [prototypes](./tests/_prototype.test.js/prototype.test.js.md)
- Can detect diff on [object integrity](./tests/_object_integrity.test.js/object_integrity.test.js.md) (`Object.freeze`, `Object.seal` and `Object.preventExtensions`)
- Can detect diff on [property descriptors](./tests/_property_descriptor.test.js/property_descriptor.test.js.md)
- Can detect diff on [symbols](./tests/_symbol.test.js/symbol.test.js.md)

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
  import { assert } from "https://unpkg.com/@jsenv/assert@latest";

  assert({
    actual: true,
    expect: false,
  });
</script>
```
