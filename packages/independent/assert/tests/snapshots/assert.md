# deep object should be false

```js
assert({
  actual: {
    the: {
      nesting: {
        is: {},
      },
    },
    toto: "actual",
  },
  expected: false,
  maxDepth: 1,
});
```

![img](<./assert/deep object should be false.svg>)

