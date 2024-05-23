# maxDepth on diff

```js
assert({
  actual: {
    foo: { a: { b: {} }, b: { c: {} } },
    b: true,
    // bar: true,
  },
  expect: {
    foo: { a: { b: {} }, b: { c: {} } },
    b: { a: { b: {} } },
    // bar: { a: { b: { c: {} } } },
  },
  MAX_DEPTH: 3,
  MAX_DEPTH_INSIDE_DIFF: 1,
});
```

![img](<./assert_scratch/maxDepth on diff.svg>)

