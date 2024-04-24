# map entry added

```js
assert({
  actual: new Map(
    [["a", true]], //
  ),
  expect: new Map(),
});
```

![img](<./map/map entry added.svg>)

# map entry removed

```js
assert({
  actual: new Map(),
  expect: new Map([
    ["a", true], //
  ]),
});
```

![img](<./map/map entry removed.svg>)

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

![img](<./map/map value modified.svg>)

# map key is an object

```js
const object = { name: "test" };
assert({
  actual: new Map([
    [object, true], //
  ]),
  expect: new Map([
    [object, false], //
  ]),
});
```

![img](<./map/map key is an object.svg>)

# map key objects are compared by identity

```js
assert({
  actual: new Map([
    [{ name: "a" }, true], //
  ]),
  expect: new Map([
    [{ name: "a" }, false], //
  ]),
});
```

![img](<./map/map key objects are compared by identity.svg>)

# map key objects are collapsed and take a subset of max columns

```js
const object = { name: "test", anOtherProperty: "relatively_long" };
assert({
  actual: new Map([
    [object, true], //
  ]),
  expect: new Map([
    [object, false], //
  ]),
  maxColumns: 40,
});
```

![img](<./map/map key objects are collapsed and take a subset of max columns.svg>)

# map comparing with object

```js
assert({
  actual: new Map([["a", true]]),
  expect: {
    a: false,
  },
});
```

![img](<./map/map comparing with object.svg>)

# object with map

```js
assert({
  actual: {
    a: false,
  },
  expect: new Map([["a", true]]),
});
```

![img](<./map/object with map.svg>)

# object with map having cusom prop

```js
assert({
  actual: {
    a: false,
  },
  expect: Object.assign(new Map([["a", true]]), {
    a: true,
  }),
});
```

![img](<./map/object with map having cusom prop.svg>)

# map having cusom prop with object

```js
assert({
  actual: Object.assign(new Map([["a", true]]), {
    a: true,
  }),
  expect: {
    a: false,
  },
});
```

![img](<./map/map having cusom prop with object.svg>)

