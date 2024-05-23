# maxDepth on diff

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

![img](<./assert_scratch/maxDepth on diff.svg>)

