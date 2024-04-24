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

![img](<./weakset_and_weakmap/weakset.svg>)

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

![img](<./weakset_and_weakmap/weakmap.svg>)

