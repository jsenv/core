# maxColumns respect actual prefix

```js
assert({
  actual: "a_string",
  expect: "a_string_2",
  maxColumns: 15,
});
```

![img](<./max_columns/maxColumns respect actual prefix.svg>)

# maxColumns respect indent

```js
assert({
  actual: {
    a: "a_long_string",
    b: false,
  },
  expect: {
    a: "a_long_string",
    b: true,
  },
  maxColumns: 10,
});
```

![img](<./max_columns/maxColumns respect indent.svg>)

