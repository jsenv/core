# 0.1 + 0.2 is close to 0.3

```js
assert({
  actual: {
    a: 0.1 + 0.2,
    b: true,
  },
  expect: {
    a: assert.closeTo(0.3),
    b: false,
  },
});
```

![img](<./assert_close_to/0_1_+_0_2_is_close_to_0_3.svg>)

# on a string

```js
assert({
  actual: "toto",
  expect: assert.closeTo(0.4),
});
```

![img](<./assert_close_to/on_a_string.svg>)

# 0.3 and 0.4

```js
assert({
  actual: 0.1 + 0.2,
  expect: assert.closeTo(0.4),
});
```

![img](<./assert_close_to/0_3_and_0_4.svg>)

