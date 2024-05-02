# buffer.from("") vs buffer.from("a")

```js
assert({
  actual: Buffer.from(""),
  expect: Buffer.from("a"),
});
```

![img](<./buffer/buffer.from("") vs buffer.from("a").svg>)

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

![img](<./buffer/buffer without diff are collapsed.svg>)

