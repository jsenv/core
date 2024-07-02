# -0 and 0

```js
assert({
  actual: -0,
  expect: +0,
});
```

![img](<./number/-0_and_0.svg>)

# 1 and -0

```js
assert({
  actual: 1,
  expect: -0,
});
```

![img](<./number/1_and_-0.svg>)

# -1 and 1

```js
assert({
  actual: -1,
  expect: 1,
});
```

![img](<./number/-1_and_1.svg>)

# 10.45 and 10.456

```js
assert({
  actual: 10.45,
  expect: 10.456,
});
```

![img](<./number/10_45_and_10_456.svg>)

# -Infinity and Infinity

```js
assert({
  actual: -Infinity,
  expect: Infinity,
});
```

![img](<./number/-infinity_and_infinity.svg>)

# NaN and Infinity

```js
assert({
  actual: NaN,
  expect: Infinity,
});
```

![img](<./number/nan_and_infinity.svg>)

# decimals using exponent

```js
assert({
  actual: 2e-6,
  expect: 2e-7,
});
```

![img](<./number/decimals_using_exponent.svg>)

# decimals using exponent v2

```js
assert({
  actual: 2e-7,
  expect: 2e-8,
});
```

![img](<./number/decimals_using_exponent_v2.svg>)

# exponent integer

```js
assert({
  actual: 10e12,
  expect: 10e11,
});
```

![img](<./number/exponent_integer.svg>)

# exponent negative integer

```js
assert({
  actual: 10e12,
  expect: -10e12,
});
```

![img](<./number/exponent_negative_integer.svg>)

# 1235 and 67_000

```js
assert({
  actual: 1235,
  expect: 67_000,
});
```

![img](<./number/1235_and_67_000.svg>)

# 149_600_000 and 1_464_301

```js
assert({
  actual: 149_600_000,
  expect: 1_464_301,
});
```

![img](<./number/149_600_000_and_1_464_301.svg>)

# 1_001 and 2_002

```js
assert({
  actual: 1_001,
  expect: 2_002,
});
```

![img](<./number/1_001_and_2_002.svg>)

# 2_200_002 and 1_100_001

```js
assert({
  actual: 2_200_002,
  expect: 1_100_001,
});
```

![img](<./number/2_200_002_and_1_100_001.svg>)

# 1234.56 and 12_345.67

```js
assert({
  actual: 1234.56,
  expect: 12_345.67,
});
```

![img](<./number/1234_56_and_12_345_67.svg>)

# -0.120_123 and -1_000_001

```js
assert({
  actual: -0.120_123,
  expect: -1_000_001,
});
```

![img](<./number/-0_120_123_and_-1_000_001.svg>)

# -1.23456e15 and -1200000e5

```js
assert({
  actual: -1.23456e15,
  expect: -1200000e5,
});
```

![img](<./number/-1_23456e15_and_-1200000e5.svg>)

# 1.8e307 and 1.8e308

```js
assert({
  actual: 1.8e307,
  expect: 1.8e308,
});
```

![img](<./number/1_8e307_and_1_8e308.svg>)

# special notations

```js
assert({
  MAX_DIFF_INSIDE_VALUE: 10,
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
  expect: {
    a: 3.656732e8,
  },
});
```

![img](<./number/special_notations.svg>)

# 10 and "10"

```js
assert({
  actual: 10,
  expect: "10",
});
```

![img](<./number/10_and_10.svg>)

# BigInt(1) and BigInt(2)

```js
assert({
  actual: BigInt(1),
  expect: BigInt(2),
});
```

![img](<./number/bigint(1)_and_bigint(2).svg>)

# BigInt(1) and "1n"

```js
assert({
  actual: BigInt(1),
  expect: "1n",
});
```

![img](<./number/bigint(1)_and_1n.svg>)

