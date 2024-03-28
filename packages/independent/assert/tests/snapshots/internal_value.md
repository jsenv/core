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

# signal(string) and signal(string)

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "ab",
  },
});
```

![img](<./internal_value/signal(string) and signal(string).svg>)

# signal(string) and string

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
  expected: "a",
});
```

![img](<./internal_value/signal(string) and string.svg>)

# string and signal(string)

```js
assert({
  actual: "a",
  expected: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
});
```

![img](<./internal_value/string and signal(string).svg>)

# valueOf not displayed when return object itself

```js
const actual = { a: true, valueOf: () => actual };
const expected = { a: false, valueOf: () => expected };
assert({
  actual,
  expected,
});
```

![img](<./internal_value/valueOf not displayed when return object itself.svg>)

# valueOf self and valueOf 10

```js
const actual = { valueOf: () => actual };
const expected = { valueOf: () => "10" };
assert({
  actual,
  expected,
});
```

![img](<./internal_value/valueOf self and valueOf 10.svg>)

# valueOf 10 and valueOf self

```js
const actual = { valueOf: () => 10 };
const expected = { valueOf: () => expected };
assert({
  actual,
  expected,
});
```

![img](<./internal_value/valueOf 10 and valueOf self.svg>)

