# signal string

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "b",
  },
});
```

![img](<./value_of/signal string.svg>)

# signal array

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ["a"],
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ["b"],
  },
});
```

![img](<./value_of/signal array.svg>)

# valueOf not displayed when return object itself

```js
const actual = { a: true, valueOf: () => actual };
const expected = { a: false, valueOf: () => expected };
assert({
  actual,
  expected,
});
```

![img](<./value_of/valueOf not displayed when return object itself.svg>)

# valueOf returns something diff

```js
const actual = { valueOf: () => actual };
const expected = { valueOf: () => "10" };
assert({
  actual,
  expected,
});
```

![img](<./value_of/valueOf returns something diff.svg>)

