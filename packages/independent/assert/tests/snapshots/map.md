# map entry added

```js
assert({
  actual: new Map(
    [["a", true]], //
  ),
  expect: new Map(),
});
```

![img](<./map/map_entry_added.svg>)

# map entry removed

```js
assert({
  actual: new Map(),
  expect: new Map([
    ["a", true], //
  ]),
});
```

![img](<./map/map_entry_removed.svg>)

# map value modified

```js
assert({
  actual: new Map([
    ["a", true], //
  ]),
  expect: new Map([
    ["a", false], //
  ]),
});
```

![img](<./map/map_value_modified.svg>)

