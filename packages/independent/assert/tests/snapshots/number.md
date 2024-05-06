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

# 1235 and 67_000

```js
assert({
  actual: 1235,
  expect: 67_000,
});
```

![img](<./number/1235 and 67_000.svg>)

# 149_600_000 and 1_464_301

```js
assert({
  actual: 149_600_000,
  expect: 1_464_301,
});
```

![img](<./number/149_600_000 and 1_464_301.svg>)

# 1234.56 and 12_345.67

```js
assert({
  actual: 1234.56,
  expect: 12_345.67,
});
```

![img](<./number/1234.56 and 12_345.67.svg>)

# -0.120123 and -1_000_001

```js
assert({
  actual: -0.120123,
  expect: -1_000_001,
});
```

![img](<./number/-0.120123 and -1_000_001.svg>)

# -1.23456e15 and -1200000e5

```js
assert({
  actual: -1.23456e15,
  expect: -1200000e5,
});
```

![img](<./number/-1.23456e15 and -1200000e5.svg>)

# 1.8e307

```js
assert({
  actual: 1.8e307,
  expect: 1.8e308,
});
```

![img](<./number/1.8e307.svg>)

# special notations

```js
assert({
  maxDiffPerObject: 10,
  actual: {
    a: 3.65432e12,
    b: 0b10101010101010, // binary
    // prettier-ignore
    c: 0B10101010101010, // binary 2
    d: 0xfabf00d, // hexadecimal
    e: 0xabcdef,
    f: 0o010101010101, // octal,
    // prettier-ignore
    g: 0O010101010101, // octal 2
  },
  expect: {},
});
```

![img](<./number/special notations.svg>)

