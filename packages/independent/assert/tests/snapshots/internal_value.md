# signal string and string

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "a",
  },
  expected: "ab",
});
```

![img](<./internal_value/signal string and string.svg>)

