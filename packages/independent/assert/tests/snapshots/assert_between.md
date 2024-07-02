# below or equals

```js
assert({
  actual: 50,
  expect: assert.belowOrEquals(25),
});
```

![img](<./assert_between/below or equals.svg>)

# below or equals when removed

```js
assert({
  actual: {},
  expect: {
    a: assert.belowOrEquals(25),
  },
});
```

![img](<./assert_between/below or equals when removed.svg>)

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

![img](<./assert_between/below or equals ok.svg>)

# 50 is too small

```js
assert({
  actual: 50,
  expect: assert.between(100, 200),
});
```

![img](<./assert_between/50 is too small.svg>)

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

![img](<./assert_between/3500 is between 3000 and 5000.svg>)

