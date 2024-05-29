# 10 vs Object(10)

```js
assert({
  actual: 10,
  expect: {
    valueOf: () => 10,
  },
});
```

![img](<./wrapped_value/10 vs Object(10).svg>)

# Object(10) vs 10

```js
assert({
  actual: {
    valueOf: () => 10,
  },
  expect: 10,
});
```

![img](<./wrapped_value/Object(10) vs 10.svg>)

# Object(10) vs Object(11)

```js
assert({
  actual: {
    valueOf: () => 10,
  },
  expect: {
    valueOf: () => 11,
  },
});
```

![img](<./wrapped_value/Object(10) vs Object(11).svg>)

# Object({ a: true }) vs { a: true }

```js
assert({
  actual: {
    valueOf: () => {
      return { a: true };
    },
  },
  expect: { a: false },
});
```

![img](<./wrapped_value/Object({ a: true }) vs { a: true }.svg>)

# valueOf with object tag

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => {
      return 10;
    },
  },
  expect: false,
});
```

![img](<./wrapped_value/valueOf with object tag.svg>)

# Symbol.toPrimitive vs primitive

```js
assert({
  actual: {
    [Symbol.toPrimitive]: () => {
      return "10";
    },
  },
  expect: "10",
});
```

![img](<./wrapped_value/Symbol.toPrimitive vs primitive.svg>)

# primitive vs Symbol.toPrimitive

```js
assert({
  actual: 10,
  expect: {
    [Symbol.toPrimitive]: () => {
      return "10";
    },
  },
});
```

![img](<./wrapped_value/primitive vs Symbol.toPrimitive.svg>)

