# 42 and not(42)

```js
assert({
  actual: 42,
  expect: assert.not(42),
});
```

![img](<./assert_not/42_and_not(42).svg>)

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

![img](<./assert_not/41_and_not(42).svg>)

# object and not (object)

```js
assert({
  actual: { a: true },
  expect: assert.not({ a: true }),
});
```

![img](<./assert_not/object_and_not_(object).svg>)

# object and not(object)

```js
assert({
  actual: {
    a: true,
    b: { b2: true },
  },
  expect: {
    a: false,
    b: assert.not({ b2: false }),
  },
});
```

![img](<./assert_not/object_and_not(object).svg>)

