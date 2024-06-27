# array first item diff

```js
assert({
  actual: [true],
  expect: [false],
});
```

![img](<./array/array first item diff.svg>)

# array expect, object received

```js
assert({
  actual: {},
  expect: [],
});
```

![img](<./array/array expect, object received.svg>)

# object expect, array received

```js
assert({
  actual: [],
  expect: {},
});
```

![img](<./array/object expect, array received.svg>)

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

![img](<./array/array without diff.svg>)

# diff in the middle of big array

```js
assert({
  actual: ["a", "b", "c", "Z", "e", "f", "g", "h"],
  expect: ["a", "b", "c", "d", "e", "f", "g", "h"],
});
```

![img](<./array/diff in the middle of big array.svg>)

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

![img](<./array/big array collapsed because diff is elsewhere.svg>)

# undefined vs empty

```js
assert({
  actual: [,],
  expect: [undefined],
});
```

![img](<./array/undefined vs empty.svg>)

# empty added

```js
assert({
  actual: [,],
  expect: [],
});
```

![img](<./array/empty added.svg>)

# empty removed

```js
assert({
  actual: [],
  expect: [,],
});
```

![img](<./array/empty removed.svg>)

# false should be an array

```js
assert({
  actual: false,
  expect: [],
});
```

![img](<./array/false should be an array.svg>)

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

![img](<./array/associative array expect, object received.svg>)

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

![img](<./array/diff on associate array.foo and object.foo.svg>)

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

![img](<./array/diff on associate array deep property and object deep property.svg>)

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

![img](<./array/diff on collapsed array.svg>)

# string and array of chars

```js
assert({
  actual: "hello world",
  expect: ["h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
});
```

![img](<./array/string and array of chars.svg>)

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

![img](<./array/associative array with values.svg>)

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

![img](<./array/array like and array.svg>)

# array subclass

```js
class MyArray extends Array {}
assert({
  actual: [true],
  expect: new MyArray(true),
});
```

![img](<./array/array subclass.svg>)

