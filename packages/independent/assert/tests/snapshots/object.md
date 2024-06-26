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
  MAX_DIFF_INSIDE_VALUE: 2,
});
```

![img](<./object/max diff per object.svg>)

# max 2 context after diff (there is 2)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
  },
  expect: {
    a: false,
    b: true,
    c: true,
  },
});
```

![img](<./object/max 2 context after diff (there is 2).svg>)

# max 2 context after diff (there is 3)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    e: true,
  },
  expect: {
    a: false,
    b: true,
    c: true,
    d: true,
  },
});
```

![img](<./object/max 2 context after diff (there is 3).svg>)

# max 2 context after diff (there is 4)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
    e: true,
  },
  expect: {
    a: false,
    b: true,
    c: true,
    d: true,
    e: true,
  },
});
```

![img](<./object/max 2 context after diff (there is 4).svg>)

# max 2 context before diff (there is 2)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
  },
  expect: {
    a: true,
    b: true,
    c: false,
  },
});
```

![img](<./object/max 2 context before diff (there is 2).svg>)

# max 2 context before diff (there is 3)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expect: {
    a: true,
    b: true,
    c: true,
    d: false,
  },
});
```

![img](<./object/max 2 context before diff (there is 3).svg>)

# max 2 context before diff (there is 4)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
    e: true,
  },
  expect: {
    a: true,
    b: true,
    c: true,
    d: true,
    e: false,
  },
});
```

![img](<./object/max 2 context before diff (there is 4).svg>)

# max 2 context around diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
    e: true,
    f: true,
    g: true,
    h: true,
    i: true,
    j: true,
    k: true,
    l: true,
    m: true,
    n: true,
    o: true,
    p: true,
  },
  expect: {
    a: true,
    b: true,
    c: true,
    d: false,
    e: true,
    f: true,
    g: true,
    h: false,
    i: true,
    j: true,
    k: true,
    l: true,
    m: false,
    n: true,
    o: true,
    p: true,
  },
  MAX_DIFF_INSIDE_VALUE: 3,
});
```

![img](<./object/max 2 context around diff.svg>)

# max 1 context around diff

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
  MAX_CONTEXT_BEFORE_DIFF: 1,
  MAX_CONTEXT_AFTER_DIFF: 1,
});
```

![img](<./object/max 1 context around diff.svg>)

# max 0 context around diff

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
  MAX_CONTEXT_BEFORE_DIFF: 0,
  MAX_CONTEXT_AFTER_DIFF: 0,
});
```

![img](<./object/max 0 context around diff.svg>)

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
  MAX_DIFF_INSIDE_VALUE: 3,
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
  MAX_DIFF_INSIDE_VALUE: 3,
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

# one prop no diff

```js
assert({
  actual: {
    a: { foo: true },
    z: true,
  },
  expect: {
    a: { foo: true },
    z: false,
  },
});
```

![img](<./object/one prop no diff.svg>)

