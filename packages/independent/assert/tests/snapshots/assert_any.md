# 10 and any(String)

```js
assert({
  actual: 10,
  expect: assert.any(String),
});
```

![img](<./assert_any/10 and any(String).svg>)

# "foo" and not(any(String))

```js
assert({
  actual: "foo",
  expect: assert.not(assert.any(String)),
});
```

![img](<./assert_any/"foo" and not(any(String)).svg>)
