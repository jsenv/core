# diff String object vs literal

```js
assert({
  // eslint-disable-next-line no-new-wrappers
  actual: new String("abc"),
  expected: "a2",
});
```

![img](<./string/diff String object vs literal.svg>)

