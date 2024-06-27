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

