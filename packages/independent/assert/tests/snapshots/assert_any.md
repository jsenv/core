# "foo" and not(any(String))

```js
assert({
  actual: "foo",
  expect: assert.not(assert.any(String)),
});
```

![img](<./assert_any/"foo" and not(any(String)).svg>)

