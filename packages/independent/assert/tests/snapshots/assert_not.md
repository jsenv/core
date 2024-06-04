# 42 and not(42)

```js
assert({
  actual: 42,
  expect: assert.not(42),
});
```

![img](<./assert_not/42 and not(42).svg>)

# 41 and not(42)

```js
assert({
  actual: {
    a: true,
    b: 41,
  },
  expect: {
    a: false,
    b: assert.not(42),
  },
});
```

![img](<./assert_not/41 and not(42).svg>)

