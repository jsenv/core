# buffer.from("") vs buffer.from("a")

```js
assert({
  actual: Buffer.from(""),
  expect: Buffer.from("a"),
});
```

![img](<./array_typed/buffer_from()_vs_buffer_from(a).svg>)

# buffer.from("a") vs buffer.from("")

```js
assert({
  actual: Buffer.from("a"),
  expect: Buffer.from(""),
});
```

![img](<./array_typed/buffer_from(a)_vs_buffer_from().svg>)

# buffer without diff are collapsed

```js
assert({
  actual: {
    a: Buffer.from("a"),
    b: true,
  },
  expect: {
    a: Buffer.from("a"),
    b: false,
  },
});
```

![img](<./array_typed/buffer_without_diff_are_collapsed.svg>)

# same length buffer diff at the end

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("hello, my name is daZ"),
});
```

![img](<./array_typed/same_length_buffer_diff_at_the_end.svg>)

# same length buffer diff at start

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("Zello, my name is dam"),
});
```

![img](<./array_typed/same_length_buffer_diff_at_start.svg>)

# same length buffer diff at middle

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("hello, my nZme is dam"),
});
```

![img](<./array_typed/same_length_buffer_diff_at_middle.svg>)

# same length buffer diff start, middle, end

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("Zello, my nZme is daZ"),
});
```

![img](<./array_typed/same_length_buffer_diff_start__middle__end.svg>)

# buffer vs string

```js
assert({
  actual: Buffer.from("a"),
  expect: "a",
});
```

![img](<./array_typed/buffer_vs_string.svg>)

# buffer vs array

```js
assert({
  actual: {
    a: Buffer.from("a"),
    b: Buffer.from("a"),
  },
  expect: {
    a: [97],
    b: [61],
  },
});
```

![img](<./array_typed/buffer_vs_array.svg>)

# buffer.from vs Uint8Array.from

```js
assert({
  actual: Buffer.from("a"),
  expect: Uint8Array.from([0x61]),
});
```

![img](<./array_typed/buffer_from_vs_uint8array_from.svg>)

# Uint8Array vs Array

```js
assert({
  actual: Uint8Array,
  expect: Array,
});
```

![img](<./array_typed/uint8array_vs_array.svg>)

