# diff new String value

```js
assert({
  actual: new String("a"),
  expect: new String("b"),
});
```

![img](<./internal_value/diff new String value.svg>)

# diff String object vs literal

```js
assert({
  actual: new String("abc"),
  expect: "a2",
});
```

![img](<./internal_value/diff String object vs literal.svg>)

# new String collapsed with overview

```js
assert({
  actual: {
    a: new String("toto"),
    b: true,
  },
  expect: {
    a: new String("toto"),
    b: false,
  },
});
```

![img](<./internal_value/new String collapsed with overview.svg>)

# new String collapsed

```js
assert({
  actual: {
    foo: {
      a: new String("toto"),
    },
  },
  expect: {
    bar: {
      a: new String("toto"),
    },
  },
  maxDepthInsideDiff: 0,
});
```

![img](<./internal_value/new String collapsed.svg>)

# new String prop

```js
assert({
  actual: Object.assign(new String("a"), { foo: true }),
  expect: Object.assign(new String("b"), { foo: false }),
});
```

![img](<./internal_value/new String prop.svg>)

# signal(true) and signal(false)

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => true,
  },
  expect: {
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
  expect: true,
});
```

![img](<./internal_value/signal(true) and true.svg>)

# true and signal(true)

```js
assert({
  actual: true,
  expect: {
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
  expect: {
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
  expect: false,
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
  expect: 1,
});
```

![img](<./internal_value/signal(true) and 1.svg>)

# signal({ foo: true }) and signal({ foo: false })

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ({ foo: true }),
  },
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => ({ foo: false }),
  },
});
```

![img](<./internal_value/signal({ foo: true }) and signal({ foo: false }).svg>)

# signal([true]) and signal([false]) with props

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
    a: true,
  },
  expect: {
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
  expect: [true],
});
```

![img](<./internal_value/signal([true]) and [true].svg>)

# [true] and signal([true])

```js
assert({
  actual: [true],
  expect: {
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
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [false],
  },
});
```

![img](<./internal_value/[true] and signal([false]).svg>)

# signal([true]) and [false]

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => [true],
  },
  expect: [false],
});
```

![img](<./internal_value/signal([true]) and [false].svg>)

# signal(string) and signal(string)

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "ab",
  },
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
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
  expect: "a",
});
```

![img](<./internal_value/signal(string) and string.svg>)

# string and signal(string)

```js
assert({
  actual: "a",
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
});
```

![img](<./internal_value/string and signal(string).svg>)

# both valueOf return object itself

```js
const actual = {
  a: true,
  valueOf: () => actual,
};
const expect = {
  a: false,
  valueOf: () => expect,
};
assert({
  actual,
  expect,
});
```

![img](<./internal_value/both valueOf return object itself.svg>)

# valueOf self and valueOf 10

```js
const actual = { valueOf: () => actual };
const expect = { valueOf: () => 10 };
assert({
  actual,
  expect,
});
```

![img](<./internal_value/valueOf self and valueOf 10.svg>)

# valueOf 10 and valueOf self

```js
const actual = { valueOf: () => 10 };
const expect = { valueOf: () => expect };
assert({
  actual,
  expect,
});
```

![img](<./internal_value/valueOf 10 and valueOf self.svg>)

# Symbol.toPrimitive

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

![img](<./internal_value/Symbol.toPrimitive.svg>)

