# 10 and any(String)

```js
assert({
  actual: 10,
  expect: assert.any(String),
});
```

![img](<./assert_any/10 and any(String).svg>)

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

# "foo" and not(any(String))

```js
assert({
  actual: "foo",
  expect: assert.not(assert.any(String)),
});
```

![img](<./assert_any/"foo" and not(any(String)).svg>)

# 10 is any Number

```js
assert({
  actual: {
    a: 10,
    b: true,
  },
  expect: {
    a: assert.any(Number),
    b: false,
  },
});
```

![img](<./assert_any/10 is any Number.svg>)

# any Error

```js
assert({
  actual: {
    a: new Error(),
    b: true,
  },
  expect: {
    a: assert.any(Error),
    b: false,
  },
});
```

![img](<./assert_any/any Error.svg>)

