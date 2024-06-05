# "foo" and any(String)

```js
assert({
  actual: {
    a: true,
    b: "foo",
  },
  expect: {
    a: false,
    b: assert.any(String),
  },
});
```

![img](<./assert_any/"foo" and any(String).svg>)

