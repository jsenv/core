# set value added

```js
assert({
  actual: new Set([
    "a",
    "b",
    "c",
    "d",
    // new
    "Y",
  ]),
  expect: new Set([
    "b",
    "a",
    "d",
    "c",
    // new
    "Z",
  ]),
  MAX_DIFF_INSIDE_VALUE: 4,
  MAX_CONTEXT_BEFORE_DIFF: 2,
});
```

![img](<./set/set_value_added.svg>)

# compare set and map

```js
assert({
  actual: new Map([[0, "a"]]),
  expect: new Set(["a"]),
});
```

![img](<./set/compare_set_and_map.svg>)

# compare set and array

```js
assert({
  actual: ["a"],
  expect: new Set(["a"]),
});
```

![img](<./set/compare_set_and_array.svg>)

# set collapsed various cases

```js
assert({
  actual: {
    a: true,
    set_without_diff: new Set(["a", "b"]),
    set_with_added: new Set(["a"]),
  },
  expect: {
    a: false,
    set_without_diff: new Set(["b", "a"]),
    set_with_added: new Set(["b"]),
  },
});
```

![img](<./set/set_collapsed_various_cases.svg>)

# set collapsed deep

```js
assert({
  actual: {
    a: {
      set_without_diff: new Set(["a", "b"]),
      set_with_added: new Set(["a"]),
    },
  },
  expect: {
    a: {
      set_without_diff: new Set(["b", "a"]),
      set_with_added: new Set(["b"]),
    },
  },
});
```

![img](<./set/set_collapsed_deep.svg>)

