# named Symbol() property added

```js
assert({
  actual: {
    [Symbol("foo")]: true,
  },
  expect: {},
});
```

![img](<./symbol/named_symbol()_property_added.svg>)

# named Symbol() property removed

```js
assert({
  actual: {},
  expect: {
    [Symbol("foo")]: true,
  },
});
```

![img](<./symbol/named_symbol()_property_removed.svg>)

# Symbol.for() property value modified

```js
assert({
  actual: {
    [Symbol.for("foo")]: true,
  },
  expect: {
    [Symbol.for("foo")]: false,
  },
});
```

![img](<./symbol/symbol_for()_property_value_modified.svg>)

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

![img](<./symbol/symbol_for()_property_no_diff.svg>)

# named Symbol() property value modified

```js
assert({
  actual: {
    [Symbol("foo")]: true,
  },
  expect: {
    [Symbol("foo")]: false,
  },
});
```

![img](<./symbol/named_symbol()_property_value_modified.svg>)

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

![img](<./symbol/named_symbol()_property_no_diff.svg>)

# anonymous Symbol() property value modified

```js
assert({
  actual: {
    [Symbol()]: true,
  },
  expect: {
    [Symbol()]: false,
  },
});
```

![img](<./symbol/anonymous_symbol()_property_value_modified.svg>)

# Symbol.iterator property value modified

```js
assert({
  actual: {
    [Symbol.iterator]: true,
  },
  expect: {
    [Symbol.iterator]: false,
  },
});
```

![img](<./symbol/symbol_iterator_property_value_modified.svg>)

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

![img](<./symbol/symbol_tostringtag_property_value_modified.svg>)

# well known symbol diff

```js
assert({
  actual: Symbol.iterator,
  expect: Symbol.toStringTag,
});
```

![img](<./symbol/well_known_symbol_diff.svg>)

# Symbol() description modified

```js
assert({
  actual: Symbol("a"),
  expect: Symbol("b"),
});
```

![img](<./symbol/symbol()_description_modified.svg>)

# Symbol.for() key modified

```js
assert({
  actual: Symbol.for("a"),
  expect: Symbol.for("b"),
});
```

![img](<./symbol/symbol_for()_key_modified.svg>)

# named Symbol() vs anonymous symbol

```js
assert({
  actual: Symbol("a"),
  expect: Symbol(),
});
```

![img](<./symbol/named_symbol()_vs_anonymous_symbol.svg>)

# anonymous symbol vs named Symbol()

```js
assert({
  actual: Symbol(""),
  expect: Symbol("b"),
});
```

![img](<./symbol/anonymous_symbol_vs_named_symbol().svg>)

# named Symbol() vs Symbol.for()

```js
assert({
  actual: Symbol("a"),
  expect: Symbol.for("a"),
});
```

![img](<./symbol/named_symbol()_vs_symbol_for().svg>)

# Symbol.for() vs named Symbol()

```js
assert({
  actual: Symbol.for("b"),
  expect: Symbol("a"),
});
```

![img](<./symbol/symbol_for()_vs_named_symbol().svg>)

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

![img](<./symbol/symbol_diff_comes_first.svg>)

