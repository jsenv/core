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

# buffer diff at the end of long buffer

```js
assert({
  actual: Buffer.from("hello, my name is dam"),
  expect: Buffer.from("hello, my name is dom"),
});
```

![img](<./array_typed/buffer diff at the end of long buffer.svg>)

