# -0 and 0

```js
assert({
  actual: -0,
  expect: +0,
});
```

![img](<./number/-0 and 0.svg>)

# 1 and -0

```js
assert({
  actual: 1,
  expect: -0,
});
```

![img](<./number/1 and -0.svg>)

# -1 and 1

```js
assert({
  actual: -1,
  expect: 1,
});
```

![img](<./number/-1 and 1.svg>)

# -Infinity and Infinity

```js
assert({
  actual: -Infinity,
  expect: Infinity,
});
```

![img](<./number/-Infinity and Infinity.svg>)

# NaN and Infinity

```js
assert({
  actual: NaN,
  expect: Infinity,
});
```

![img](<./number/NaN and Infinity.svg>)

