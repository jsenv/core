# buffer.from("") vs buffer.from("a")

```js
assert({
  actual: Buffer.from(""),
  expect: Buffer.from("a"),
});
```

![img](<./array_typed/buffer.from("") vs buffer.from("a").svg>)

# buffer.from("a") vs buffer.from("")

```js
assert({
  actual: Buffer.from("a"),
  expect: Buffer.from(""),
});
```

![img](<./array_typed/buffer.from("a") vs buffer.from("").svg>)

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

![img](<./array_typed/buffer without diff are collapsed.svg>)

# same length buffer diff at the end

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("hello, my name is daZ"),
});
```

![img](<./array_typed/same length buffer diff at the end.svg>)

# same length buffer diff at start

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("Zello, my name is dam"),
});
```

![img](<./array_typed/same length buffer diff at start.svg>)

# same length buffer diff at middle

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("hello, my nZme is dam"),
});
```

![img](<./array_typed/same length buffer diff at middle.svg>)

# same length buffer diff start, middle, end

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("Zello, my nZme is daZ"),
});
```

![img](<./array_typed/same length buffer diff start, middle, end.svg>)

# buffer vs string

```js
assert({
  actual: Buffer.from("a"),
  expect: "a",
});
```

![img](<./array_typed/buffer vs string.svg>)

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

![img](<./array_typed/buffer vs array.svg>)

# buffer.from vs Uint8Array.from

```js
assert({
  actual: Buffer.from("a"),
  expect: Uint8Array.from([0x61]),
});
```

![img](<./array_typed/buffer.from vs Uint8Array.from.svg>)

# Uint8Array vs Array

```js
assert({
  actual: Uint8Array,
  expect: Array,
});
```

![img](<./array_typed/Uint8Array vs Array.svg>)

