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

![img](<./wrapped_value/symbol_toprimitive_added.svg>)

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

![img](<./wrapped_value/symbol_toprimitive_removed.svg>)

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

![img](<./wrapped_value/symbol_toprimitive_vs_primitive.svg>)

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

![img](<./wrapped_value/primitive_vs_symbol_toprimitive.svg>)

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

![img](<./wrapped_value/valueof({_a:_true_})_vs_{_a:_true_}.svg>)

# 10 vs valueOf(10)

```js
assert({
  actual: 10,
  expect: {
    valueOf: () => 10,
  },
});
```

![img](<./wrapped_value/10_vs_valueof(10).svg>)

# valueOf(10) vs 10

```js
assert({
  actual: {
    valueOf: () => 10,
  },
  expect: 10,
});
```

![img](<./wrapped_value/valueof(10)_vs_10.svg>)

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

![img](<./wrapped_value/valueof(10)_vs_valueof(11).svg>)

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

![img](<./wrapped_value/valueof(10)_vs_valueof(10).svg>)

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

![img](<./wrapped_value/valueof_with_object_tag_vs_primitive.svg>)

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

![img](<./wrapped_value/valueof_with_object_tag.svg>)

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

![img](<./wrapped_value/no_diff_on_valueof_in_constructor.svg>)

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

![img](<./wrapped_value/signal(true)_and_signal(false).svg>)

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

![img](<./wrapped_value/signal(true)_and_true.svg>)

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

![img](<./wrapped_value/true_and_signal(true).svg>)

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

![img](<./wrapped_value/true_and_signal(false).svg>)

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

![img](<./wrapped_value/signal(true)_and_false.svg>)

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

![img](<./wrapped_value/signal(true)_and_1.svg>)

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

![img](<./wrapped_value/signal({_foo:_true_})_and_signal({_foo:_false_}).svg>)

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

![img](<./wrapped_value/signal([true])_and_signal([false])_with_props.svg>)

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

![img](<./wrapped_value/signal([true])_and_[true].svg>)

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

![img](<./wrapped_value/[true]_and_signal([true]).svg>)

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

![img](<./wrapped_value/[true]_and_signal([false]).svg>)

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

![img](<./wrapped_value/signal([true])_and_[false].svg>)

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

![img](<./wrapped_value/signal(string)_and_signal(string).svg>)

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

![img](<./wrapped_value/signal(string)_and_string.svg>)

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

![img](<./wrapped_value/string_and_signal(string).svg>)

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

![img](<./wrapped_value/both_valueof_return_object_itself.svg>)

# valueOf self and valueOf 10

```js
const actual = { valueOf: () => actual };
const expect = { valueOf: () => 10 };
assert({
  actual,
  expect,
});
```

![img](<./wrapped_value/valueof_self_and_valueof_10.svg>)

# valueOf 10 and valueOf self

```js
const actual = { valueOf: () => 10 };
const expect = { valueOf: () => expect };
assert({
  actual,
  expect,
});
```

![img](<./wrapped_value/valueof_10_and_valueof_self.svg>)

# own valueOf order respected

```js
assert({
  actual: {
    a: true,
    valueOf: () => 0,
    b: true,
  },
  expect: {
    a: true,
    valueOf: () => 1,
    b: true,
  },
});
```

![img](<./wrapped_value/own_valueof_order_respected.svg>)

# valueOf inherited

```js
class Signal {
  #value;
  constructor(value) {
    this.#value = value;
  }
  valueOf() {
    return this.#value;
  }
}
assert({
  actual: Object.assign(new Signal("a"), { foo: true }),
  expect: Object.assign(new Signal("b"), { foo: false }),
});
```

![img](<./wrapped_value/valueof_inherited.svg>)

