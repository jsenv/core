# no diff

```js
assert({
  actual: {
    a: "AABB",
    b: true,
  },
  expect: {
    a: assert.startsWith("AAB"),
    b: false,
  },
});
```

![img](<./assert_starts_with/no_diff.svg>)

# does not start with

```js
assert({
  actual: "AABB",
  expect: assert.startsWith("AB"),
});
```

![img](<./assert_starts_with/does_not_start_with.svg>)

