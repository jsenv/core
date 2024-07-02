# below or equals

```js
assert({
  actual: 50,
  expect: assert.belowOrEquals(25),
});
```

![img](<./assert_between/below_or_equals.svg>)

# below or equals when removed

```js
assert({
  actual: {},
  expect: {
    a: assert.belowOrEquals(25),
  },
});
```

![img](<./assert_between/below_or_equals_when_removed.svg>)

# below or equals ok

```js
assert({
  actual: {
    a: true,
    b: 25,
  },
  expect: {
    a: false,
    b: assert.belowOrEquals(25),
  },
});
```

![img](<./assert_between/below_or_equals_ok.svg>)

# 50 is too small

```js
assert({
  actual: 50,
  expect: assert.between(100, 200),
});
```

![img](<./assert_between/50_is_too_small.svg>)

# 3500 is between 3000 and 5000

```js
assert({
  actual: {
    a: 3_500,
    b: true,
  },
  expect: {
    a: assert.between(3_000, 5_000),
    b: false,
  },
});
```

![img](<./assert_between/3500_is_between_3000_and_5000.svg>)

