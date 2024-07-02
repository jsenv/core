# String and Object

```js
assert({
  actual: String,
  expect: Object,
});
```

![img](<./well_known/string_and_object.svg>)

# Number.MAX_VALUE and Number.MIN_VALUE

```js
assert({
  actual: Number.MAX_VALUE,
  expect: Number.MIN_VALUE,
});
```

![img](<./well_known/number_max_value_and_number_min_value.svg>)

# Symbol.iterator and Symbol.toPrimitive

```js
assert({
  actual: Symbol.iterator,
  expect: Symbol.toPrimitive,
});
```

![img](<./well_known/symbol_iterator_and_symbol_toprimitive.svg>)

# Symbol.for("a") and Symbol.for("b")

```js
assert({
  actual: Symbol.for("a"),
  expect: Symbol.for("b"),
});
```

![img](<./well_known/symbol_for("a")_and_symbol_for("b").svg>)

# Object.prototype.toString vs Object.prototype.hasOwnProperty

```js
assert({
  actual: Object.prototype.toString,
  expect: Object.prototype.hasOwnProperty,
});
```

![img](<./well_known/object_prototype_tostring_vs_object_prototype_hasownproperty.svg>)

# null and Array.prototype

```js
assert({
  actual: null,
  expect: Array.prototype,
});
```

![img](<./well_known/null_and_array_prototype.svg>)

