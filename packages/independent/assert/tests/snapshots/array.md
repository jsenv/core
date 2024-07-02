# array first item diff

```js
assert({
  actual: [true],
  expect: [false],
});
```

![img](<./array/array_first_item_diff.svg>)

# array expect, object received

```js
assert({
  actual: {},
  expect: [],
});
```

![img](<./array/array_expect__object_received.svg>)

# object expect, array received

```js
assert({
  actual: [],
  expect: {},
});
```

![img](<./array/object_expect__array_received.svg>)

# array without diff

```js
assert({
  actual: {
    a: [0],
    z: true,
  },
  expect: {
    a: [0],
    z: false,
  },
});
```

![img](<./array/array_without_diff.svg>)

# diff in the middle of big array

```js
assert({
  actual: ["a", "b", "c", "Z", "e", "f", "g", "h"],
  expect: ["a", "b", "c", "d", "e", "f", "g", "h"],
});
```

![img](<./array/diff_in_the_middle_of_big_array.svg>)

# big array collapsed because diff is elsewhere

```js
assert({
  actual: {
    a: ["a", "b", "c", "d", "e", "f", "g", "h"],
    b: true,
  },
  expect: {
    a: ["a", "b", "c", "d", "e", "f", "g", "h"],
    b: false,
  },
  MAX_COLUMNS: 35,
});
```

![img](<./array/big_array_collapsed_because_diff_is_elsewhere.svg>)

# undefined vs empty

```js
assert({
  actual: [,],
  expect: [undefined],
});
```

![img](<./array/undefined_vs_empty.svg>)

# empty added

```js
assert({
  actual: [,],
  expect: [],
});
```

![img](<./array/empty_added.svg>)

# empty removed

```js
assert({
  actual: [],
  expect: [,],
});
```

![img](<./array/empty_removed.svg>)

# false should be an array

```js
assert({
  actual: false,
  expect: [],
});
```

![img](<./array/false_should_be_an_array.svg>)

# associative array expect, object received

```js
assert({
  actual: Object.assign([], {
    foo: true,
  }),
  expect: {
    foo: true,
  },
});
```

![img](<./array/associative_array_expect__object_received.svg>)

# diff on associate array.foo and object.foo

```js
assert({
  actual: Object.assign([], {
    foo: true,
  }),
  expect: {
    foo: false,
  },
});
```

![img](<./array/diff_on_associate_array_foo_and_object_foo.svg>)

# diff on associate array deep property and object deep property

```js
assert({
  actual: Object.assign([], {
    user: { name: "bob" },
  }),
  expect: {
    user: {
      name: "alice",
    },
  },
});
```

![img](<./array/diff_on_associate_array_deep_property_and_object_deep_property.svg>)

# diff on collapsed array

```js
assert({
  actual: {
    a: {
      same: [true],
      a: [false, false],
      r: [],
      ma: [false, true],
      mr: [false],
      m: [false, false],
    },
  },
  expect: {
    a: {
      same: [true],
      a: [],
      r: [true, true, true],
      ma: [true],
      mr: [true],
      m: [true, true],
    },
  },
  MAX_DEPTH_INSIDE_DIFF: 0,
});
```

![img](<./array/diff_on_collapsed_array.svg>)

# string and array of chars

```js
assert({
  actual: "hello world",
  expect: ["h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
});
```

![img](<./array/string_and_array_of_chars.svg>)

# associative array with values

```js
assert({
  actual: Object.assign(["a", "b"], {
    user: "bob",
  }),
  expect: Object.assign(["Z", "b"], {
    user: "alice",
  }),
});
```

![img](<./array/associative_array_with_values.svg>)

# array like and array

```js
assert({
  actual: {
    0: "Z",
    1: "b",
    length: 2,
  },
  expect: [
    "a", //
    "b",
  ],
});
```

![img](<./array/array_like_and_array.svg>)

# array subclass

```js
class MyArray extends Array {}
assert({
  actual: [true],
  expect: new MyArray(true),
});
```

![img](<./array/array_subclass.svg>)

