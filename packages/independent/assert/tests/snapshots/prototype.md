# object null proto vs object

```js
assert({
  actual: Object.create(null),
  expected: {},
});
```

![img](<./prototype/object null proto vs object.svg>)

# object with different prototypes

```js
assert({
  actual: Object.create({ toto: true }),
  expected: Object.create({ toto: false }),
});
```

![img](<./prototype/object with different prototypes.svg>)

