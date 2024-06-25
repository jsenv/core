# array first item diff

```js
assert({
  actual: [true],
  expect: [false],
});
```

![img](<./array/array first item diff.svg>)

# array expect, object received

```js
assert({
  actual: {},
  expect: [],
});
```

![img](<./array/array expect, object received.svg>)

# diff in the middle of big array

```js
assert({
  actual: ["a", "b", "c", "Z", "e", "f", "g", "h"],
  expect: ["a", "b", "c", "d", "e", "f", "g", "h"],
});
```

![img](<./array/diff in the middle of big array.svg>)

