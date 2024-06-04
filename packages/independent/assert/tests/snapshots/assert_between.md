# below or equals

```js
assert({
  actual: 50,
  expect: assert.belowOrEquals(25),
});
```

![img](<./assert_between/below or equals.svg>)

# 50 is too small

```js
assert({
  actual: 50,
  expect: assert.between(100, 200),
});
```

![img](<./assert_between/50 is too small.svg>)

