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
  MAX_DIFF: 4,
  MAX_CONTEXT_BEFORE_DIFF: 2,
});
```

![img](<./set/set value added.svg>)

# compare set and map

```js
assert({
  actual: new Map([[0, "a"]]),
  expect: new Set(["a"]),
});
```

![img](<./set/compare set and map.svg>)

# compare set and array

```js
assert({
  actual: ["a"],
  expect: new Set(["a"]),
});
```

![img](<./set/compare set and array.svg>)

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

![img](<./set/set collapsed various cases.svg>)

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

![img](<./set/set collapsed deep.svg>)

