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

