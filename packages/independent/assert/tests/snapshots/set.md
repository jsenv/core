# set value added

```js
assert({
  actual: new Set([
    "a",
    "b",
    "c",
    // new
    "Y",
  ]),
  expect: new Set([
    "b",
    "a",
    "c",
    // new
    "Z",
  ]),
  maxValueAroundDiff: 4,
});
```

![img](<./set/set value added.svg>)

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
  maxDepthInsideDiff: 0,
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
  maxDepthInsideDiff: 0,
});
```

![img](<./set/set collapsed deep.svg>)

