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

![img](<./assert_scratch/property are different.svg>)

# max depth inside diff

```js
assert({
  actual: {
    foo: { foo_a: { foo_a2: {} }, foo_b: { foo_b2: {} } },
    bar: true,
  },
  expect: {
    foo: { foo_a: { foo_a2: {} }, foo_b: { foo_b2: {} } },
    bar: { bar_a: { bar_a2: {} } },
  },
  MAX_DEPTH: 2,
  MAX_DEPTH_INSIDE_DIFF: 1,
});
```

![img](<./assert_scratch/max depth inside diff.svg>)

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

![img](<./assert_scratch/max diff per object.svg>)

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
  MAX_PROP_BEFORE_DIFF: 0,
  MAX_PROP_AFTER_DIFF: 0,
});
```

![img](<./assert_scratch/max prop around diff.svg>)

