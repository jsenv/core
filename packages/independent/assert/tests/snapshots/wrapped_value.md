# 10 vs Object(10)

```js
assert({
  actual: 10,
  expect: {
    valueOf: () => 10,
  },
});
```

![img](<./wrapped_value/10 vs Object(10).svg>)

# Object(10) vs 10

```js
assert({
  actual: {
    valueOf: () => 10,
  },
  expect: 10,
});
```

![img](<./wrapped_value/Object(10) vs 10.svg>)

