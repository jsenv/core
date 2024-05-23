# property are different

```js
assert({
  actual: {
    a: true,
    b: { a: true },
    c: true,
  },
  expect: {
    c: true,
    b: { a: false },
    a: true,
  },
});
```

![img](<./assert_scratch/property are different.svg>)

