# set value added

```js
assert({
  actual: new Set(["a", "b", "c", "Y"]),
  expected: new Set(["b", "a", "c", "Z"]),
});
```

![img](<./set/set value added.svg>)

# compare set and array

```js
assert({
  actual: ["a", "b"],
  expected: new Set(["a", "b"]),
});
```

![img](<./set/compare set and array.svg>)

