# object with different prototypes

```js
// some well-known proto
// will just be displayed as
// Date() {}
// but when created as follow, there is no way to properly
// display them (we'll see about Symbol.toStringTag at some point but later)
// so we must display the entire object
assert({
  actual: Object.create({ toto: true }),
  expected: Object.create({ toto: false }),
});
```

![img](<./prototype/object with different prototypes.svg>)

