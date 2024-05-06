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

# 10.45 and 10.456

```js
assert({
  actual: 10.45,
  expect: 10.456,
});
```

![img](<./number/10.45 and 10.456.svg>)

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

# decimals using exponent

```js
assert({
  actual: 2e-6,
  expect: 2e-7,
});
```

![img](<./number/decimals using exponent.svg>)

# decimals using exponent v2

```js
assert({
  actual: 2e-7,
  expect: 2e-8,
});
```

![img](<./number/decimals using exponent v2.svg>)

# exponent integer

```js
assert({
  actual: 10e12,
  expect: 10e11,
});
```

![img](<./number/exponent integer.svg>)

# exponent negative integer

```js
assert({
  actual: 10e12,
  expect: -10e12,
});
```

![img](<./number/exponent negative integer.svg>)

