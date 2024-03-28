# non enumerable displayed when modified

```js
const actual = {};
const expected = {};
Object.defineProperty(actual, "b", {
  enumerable: false,
  value: "b",
});
Object.defineProperty(expected, "b", {
  enumerable: false,
  value: "c",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/non enumerable displayed when modified.svg>)

