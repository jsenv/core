# truncate property value

```js
assert({
  actual: {
    foo: "abcdefghijk",
  },
  expect: {
    foo: "ABCDEFGHIJK",
  },
  MAX_COLUMNS: 20,
});
```

![img](<./max_columns/truncate property value.svg>)

# truncate property key

```js
assert({
  actual: {
    "a quite long property key that will be truncated": true,
  },
  expect: {
    "a quite long property key that will be truncated": false,
  },
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/truncate property key.svg>)

# truncate right after property name

```js
assert({
  actual: {
    abcdefghijkl: true,
  },
  expect: {
    abcdefghijkl: false,
  },
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/truncate right after property name.svg>)

# truncate right after property separator

```js
assert({
  actual: {
    abcdefghijkl: true,
  },
  expect: {
    abcdefghijkl: false,
  },
  MAX_COLUMNS: 16,
});
```

![img](<./max_columns/truncate right after property separator.svg>)

# truncate exactly on first value column

```js
assert({
  actual: {
    abcdefghijkl: true,
  },
  expect: {
    abcdefghijkl: false,
  },
  MAX_COLUMNS: 16,
});
```

![img](<./max_columns/truncate exactly on first value column.svg>)

