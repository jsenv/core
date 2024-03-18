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

![img](<./value_of/signal string and string.svg>)

