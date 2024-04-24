# promise

```js
assert({
  actual: {
    a: true,
    b: Promise.resolve(40),
  },
  expect: {
    a: false,
    b: Promise.resolve(42),
  },
});
```

![img](<./promise/promise.svg>)

