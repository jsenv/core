# diff String object vs literal

```js
assert({
  // eslint-disable-next-line no-new-wrappers
  actual: new String("a"),
  expected: "a",
});
```

![img](<./string/diff String object vs literal.svg>)

