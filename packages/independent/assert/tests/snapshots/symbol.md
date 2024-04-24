# Symbol() description modified

```js
assert({
  actual: Symbol("a"),
  expect: Symbol("b"),
});
```

![img](<./symbol/Symbol() description modified.svg>)

# Symbol.for() key modified

```js
assert({
  actual: Symbol.for("a"),
  expect: Symbol.for("b"),
});
```

![img](<./symbol/Symbol.for() key modified.svg>)

# named Symbol() vs anonymous symbol

```js
assert({
  actual: Symbol("a"),
  expect: Symbol(),
});
```

![img](<./symbol/named Symbol() vs anonymous symbol.svg>)

# anonymous symbol vs named Symbol()

```js
assert({
  actual: Symbol(""),
  expect: Symbol("b"),
});
```

![img](<./symbol/anonymous symbol vs named Symbol().svg>)

# named Symbol() vs Symbol.for()

```js
assert({
  actual: Symbol("a"),
  expect: Symbol.for("a"),
});
```

![img](<./symbol/named Symbol() vs Symbol.for().svg>)

# Symbol.for() vs named Symbol()

```js
assert({
  actual: Symbol.for("b"),
  expect: Symbol("a"),
});
```

![img](<./symbol/Symbol.for() vs named Symbol().svg>)

