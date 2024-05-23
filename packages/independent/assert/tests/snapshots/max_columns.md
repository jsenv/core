# at property value

```js
assert({
  actual: {
    foo: "abcdefghijklmn",
  },
  expect: {
    foo: "ABCDEFGHIJKLMN",
  },
  MAX_COLUMNS: 20,
});
```

![img](<./max_columns/at property value.svg>)

# at property key

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

![img](<./max_columns/at property key.svg>)

# at property name last char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 10,
});
```

![img](<./max_columns/at property name last char.svg>)

# at property name separator

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 11,
});
```

![img](<./max_columns/at property name separator.svg>)

# at space after property name separator

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 12,
});
```

![img](<./max_columns/at space after property name separator.svg>)

# at property value first char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 13,
});
```

![img](<./max_columns/at property value first char.svg>)

# at property value second char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 14,
});
```

![img](<./max_columns/at property value second char.svg>)

# at property value third char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at property value third char.svg>)

