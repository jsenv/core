# property are different

```js
assert({
  actual: {
    a: true,
  },
  expect: {
    a: {
      b: true,
    },
  },
});
```

![img](<./object/property are different.svg>)

# property removed

```js
assert({
  actual: {
    a: true,
  },
  expect: {
    a: true,
    should_be_there: true,
  },
});
```

![img](<./object/property removed.svg>)

# property added

```js
assert({
  actual: {
    a: true,
    should_not_be_there: true,
  },
  expect: {
    a: true,
  },
});
```

![img](<./object/property added.svg>)

# false should be an object

```js
assert({
  actual: false,
  expect: { foo: true },
});
```

![img](<./object/false should be an object.svg>)

# object should be false

```js
assert({
  actual: {
    foo: { a: {} },
  },
  expect: false,
});
```

![img](<./object/object should be false.svg>)

# false should be an object at property

```js
assert({
  actual: {
    foo: false,
  },
  expect: {
    foo: { a: true },
  },
});
```

![img](<./object/false should be an object at property.svg>)

# object should be false at property

```js
assert({
  actual: {
    foo: { a: true },
  },
  expect: {
    foo: false,
  },
});
```

![img](<./object/object should be false at property.svg>)

# max depth inside diff

```js
assert({
  actual: {
    foo: {
      foo_a: { foo_a2: { foo_a3: {} } },
      foo_b: { foo_b2: { foo_b3: {} } },
    },
    bar: true,
  },
  expect: {
    foo: {
      foo_a: { foo_a2: { foo_a3: {} } },
      foo_b: { foo_b2: { foo_b3: {} } },
    },
    bar: { bar_a: { bar_a2: {} } },
  },
  MAX_DEPTH: 2,
  MAX_DEPTH_INSIDE_DIFF: 1,
});
```

![img](<./object/max depth inside diff.svg>)

# max diff per object

```js
assert({
  actual: {
    a: true,
    b: {
      a: {
        y: true,
        z: true,
      },
    },
    c: true,
  },
  expect: {
    c: true,
    b: { a: false },
    a: true,
  },
  MAX_DIFF_PER_OBJECT: 2,
});
```

![img](<./object/max diff per object.svg>)

# max prop around diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
  },
  expect: {
    c: true,
    b: false,
    a: true,
  },
  MAX_ENTRY_BEFORE_MULTILINE_DIFF: 0,
  MAX_ENTRY_AFTER_MULTILINE_DIFF: 0,
});
```

![img](<./object/max prop around diff.svg>)

# property should be there and is big

```js
assert({
  actual: {
    a: true,
  },
  expect: {
    a: true,
    should_be_there: {
      a: true,
      b: true,
      item: { a: 1, b: 1, c: 1 },
      c: true,
      d: true,
      e: true,
      f: true,
      g: true,
    },
  },
  MAX_COLUMNS: 100,
  MAX_DIFF_PER_OBJECT: 3,
});
```

![img](<./object/property should be there and is big.svg>)

# many props should not be there

```js
assert({
  actual: {
    a: true,
    b: true,
    c: { an_object: true, and: true },
    d: true,
    e: true,
    f: true,
    g: true,
    h: true,
  },
  expect: {
    a: true,
    c: {},
  },
});
```

![img](<./object/many props should not be there.svg>)

# object vs user

```js
assert({
  actual: {},
  expect: {
    [Symbol.toStringTag]: "User",
  },
});
```

![img](<./object/object vs user.svg>)

# collapsed with overview when no diff

```js
assert({
  actual: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: true,
  },
  expect: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: false,
  },
});
```

![img](<./object/collapsed with overview when no diff.svg>)

