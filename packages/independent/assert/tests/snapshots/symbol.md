# Symbol.for() property no diff

```js
assert({
  actual: {
    a: true,
    [Symbol.for("foo")]: true,
  },
  expect: {
    a: false,
    [Symbol.for("foo")]: true,
  },
});
```

![img](<./symbol/Symbol.for() property no diff.svg>)

# named Symbol() property no diff

```js
assert({
  actual: {
    a: true,
    [Symbol("foo")]: true,
  },
  expect: {
    a: false,
    [Symbol("foo")]: true,
  },
});
```

![img](<./symbol/named Symbol() property no diff.svg>)

# Symbol.toStringTag property value modified

```js
assert({
  actual: {
    [Symbol.toStringTag]: "a",
  },
  expect: {
    [Symbol.toStringTag]: "b",
  },
});
```

![img](<./symbol/Symbol.toStringTag property value modified.svg>)

# well known symbol diff

```js
assert({
  actual: Symbol.iterator,
  expect: Symbol.toStringTag,
});
```

![img](<./symbol/well known symbol diff.svg>)

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

# symbol diff comes first

```js
assert({
  actual: {
    a: true,
    [Symbol.for("a")]: true,
  },
  expect: {
    a: false,
    [Symbol.for("a")]: false,
  },
});
```

![img](<./symbol/symbol diff comes first.svg>)

