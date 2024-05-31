# Symbol.toPrimitive added

```js
assert({
  actual: {
    [Symbol.toPrimitive]: () => {
      return "10";
    },
  },
  expect: {},
});
```

![img](<./wrapped_value/Symbol.toPrimitive added.svg>)

# Symbol.toPrimitive removed

```js
assert({
  actual: {},
  expect: {
    [Symbol.toPrimitive]: () => {
      return "10";
    },
  },
});
```

![img](<./wrapped_value/Symbol.toPrimitive removed.svg>)

# Symbol.toPrimitive vs primitive

```js
assert({
  actual: {
    [Symbol.toPrimitive]: () => {
      return 10;
    },
  },
  expect: 10,
});
```

![img](<./wrapped_value/Symbol.toPrimitive vs primitive.svg>)

# primitive vs Symbol.toPrimitive

```js
assert({
  actual: "10",
  expect: {
    [Symbol.toPrimitive]: () => {
      return "10";
    },
  },
});
```

![img](<./wrapped_value/primitive vs Symbol.toPrimitive.svg>)

# valueOf({ a: true }) vs { a: true }

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

![img](<./wrapped_value/valueOf({ a: true }) vs { a: true }.svg>)

# 10 vs valueOf(10)

```js
assert({
  actual: 10,
  expect: {
    valueOf: () => 10,
  },
});
```

![img](<./wrapped_value/10 vs valueOf(10).svg>)

# valueOf(10) vs 10

```js
assert({
  actual: {
    valueOf: () => 10,
  },
  expect: 10,
});
```

![img](<./wrapped_value/valueOf(10) vs 10.svg>)

# valueOf(10) vs valueOf(11)

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

![img](<./wrapped_value/valueOf(10) vs valueOf(11).svg>)

# valueOf(10) vs valueOf(10)

```js
assert({
  actual: {
    a: true,
    valueOf: () => 10,
  },
  expect: {
    b: false,
    valueOf: () => 10,
  },
});
```

![img](<./wrapped_value/valueOf(10) vs valueOf(10).svg>)

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

