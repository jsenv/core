# array first item diff

```js
assert({
  actual: [true],
  expected: [false],
});
```

![img](<./array/array first item diff.svg>)

# undefined vs empty

```js
assert({
  // eslint-disable-next-line no-sparse-arrays
  actual: [,],
  expected: [undefined],
});
```

![img](<./array/undefined vs empty.svg>)

# empty added

```js
assert({
  // eslint-disable-next-line no-sparse-arrays
  actual: [,],
  expected: [],
});
```

![img](<./array/empty added.svg>)

# empty removed

```js
assert({
  actual: [],
  // eslint-disable-next-line no-sparse-arrays
  expected: [,],
});
```

![img](<./array/empty removed.svg>)

