# signal(true) and signal(false)

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => false,
  },
});
```

![img](<./internal_value/signal(true) and signal(false).svg>)

# signal(true) and true

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
  expected: true,
});
```

![img](<./internal_value/signal(true) and true.svg>)

# true and signal(true)

```js
assert({
  actual: true,
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
});
```

![img](<./internal_value/true and signal(true).svg>)

# true and signal(false)

```js
assert({
  actual: true,
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => false,
  },
});
```

![img](<./internal_value/true and signal(false).svg>)

# signal(true) and false

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
  expected: false,
});
```

![img](<./internal_value/signal(true) and false.svg>)

# signal(true) and 1

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
  expected: 1,
});
```

![img](<./internal_value/signal(true) and 1.svg>)

# signal({ foo: true }) and signal({ a: false })

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ({ foo: true }),
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ({ foo: false }),
  },
});
```

![img](<./internal_value/signal({ foo: true }) and signal({ a: false }).svg>)

# signal([true]) and signal([false]) with props

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
    a: true,
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [false],
    a: false,
  },
});
```

![img](<./internal_value/signal([true]) and signal([false]) with props.svg>)

# signal([true]) and [true]

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
  },
  expected: [true],
});
```

![img](<./internal_value/signal([true]) and [true].svg>)

# [true] and signal([true])

```js
assert({
  actual: [true],
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
  },
});
```

![img](<./internal_value/[true] and signal([true]).svg>)

# [true] and signal([false])

```js
assert({
  actual: [true],
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [false],
  },
});
```

![img](<./internal_value/[true] and signal([false]).svg>)

# signal([true]) and false

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
  },
  expected: [false],
});
```

![img](<./internal_value/signal([true]) and false.svg>)

