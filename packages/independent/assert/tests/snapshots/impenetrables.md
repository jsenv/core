# promise

```js
assert({
  actual: {
    a: true,
    b: Promise.resolve(40),
  },
  expect: {
    a: false,
    b: Promise.resolve(42),
  },
});
```

![img](<./impenetrables/promise.svg>)

# weakset

```js
assert({
  actual: {
    a: true,
    b: new WeakSet([{}, [], Symbol.iterator]),
  },
  expect: {
    a: false,
    b: new WeakSet([Symbol.iterator]),
  },
});
```

![img](<./impenetrables/weakset.svg>)

# weakmap

```js
assert({
  actual: {
    a: true,
    b: new WeakMap([
      [{}, "object"],
      [[], "array"],
      [Symbol.iterator, { yes: true }],
    ]),
  },
  expect: {
    a: false,
    b: new WeakMap([[{}, "toto"]]),
  },
});
```

![img](<./impenetrables/weakmap.svg>)

