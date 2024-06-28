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

# valueOf with object tag vs primitive

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

![img](<./wrapped_value/valueOf with object tag vs primitive.svg>)

# valueOf with object tag 

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => {
      return 10;
    },
  },
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => {
      return 11;
    },
  },
});
```

![img](<./wrapped_value/valueOf with object tag .svg>)

# no diff on valueOf in constructor

```js
assert({
  actual: {
    a: true,
    [Symbol.toStringTag]: "Signal",
    valueOf: () => {
      return 10;
    },
  },
  expect: {
    a: false,
    [Symbol.toStringTag]: "Signal",
    valueOf: () => {
      return 10;
    },
  },
});
```

![img](<./wrapped_value/no diff on valueOf in constructor.svg>)

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

![img](<./wrapped_value/signal(true) and signal(false).svg>)

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

![img](<./wrapped_value/signal(true) and true.svg>)

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

![img](<./wrapped_value/true and signal(true).svg>)

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

![img](<./wrapped_value/true and signal(false).svg>)

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

![img](<./wrapped_value/signal(true) and false.svg>)

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

![img](<./wrapped_value/signal(true) and 1.svg>)

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

![img](<./wrapped_value/signal({ foo: true }) and signal({ foo: false }).svg>)

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

![img](<./wrapped_value/signal([true]) and signal([false]) with props.svg>)

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

![img](<./wrapped_value/signal([true]) and [true].svg>)

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

![img](<./wrapped_value/[true] and signal([true]).svg>)

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

![img](<./wrapped_value/[true] and signal([false]).svg>)

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

![img](<./wrapped_value/signal([true]) and [false].svg>)

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

![img](<./wrapped_value/signal(string) and signal(string).svg>)

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

![img](<./wrapped_value/signal(string) and string.svg>)

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

![img](<./wrapped_value/string and signal(string).svg>)

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

![img](<./wrapped_value/both valueOf return object itself.svg>)

# valueOf self and valueOf 10

```js
const actual = { valueOf: () => actual };
const expect = { valueOf: () => 10 };
assert({
  actual,
  expect,
});
```

![img](<./wrapped_value/valueOf self and valueOf 10.svg>)

# valueOf 10 and valueOf self

```js
const actual = { valueOf: () => 10 };
const expect = { valueOf: () => expect };
assert({
  actual,
  expect,
});
```

![img](<./wrapped_value/valueOf 10 and valueOf self.svg>)

