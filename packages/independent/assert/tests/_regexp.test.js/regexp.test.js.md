# regexp

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../regexp.test.js">../regexp.test.js</a>
</sub>

## a vs b

```js
assert({
  actual: /a/,
  expect: /b/,
});
```

![img](a_vs_b/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: /a/
expect: /b/
```

</details>


## i flag vs no flag

```js
assert({
  actual: /a/i,
  expect: /a/,
});
```

![img](i_flag_vs_no_flag/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: /a/i
expect: /a/
```

</details>


## gi flag vs ig flag

```js
assert({
  actual: {
    a: /a/gi,
    b: true,
  },
  expect: {
    // prettier-ignore
    a: /a/ig,
    b: false,
  },
});
```

![img](gi_flag_vs_ig_flag/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: /a/gi,
  b: true,
}
expect: {
  a: /a/gi,
  b: false,
}
```

</details>


## special char: parenthesis vs dot

```js
assert({
  actual: /^\($/g,
  expect: /^\.$/g,
});
```

![img](special_char_parenthesis_vs_dot/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: /^\($/g
expect: /^\.$/g
```

</details>


## last index

```js
const actual = /a/;
const expect = /a/;
expect.lastIndex = 10;
assert({
  actual,
  expect,
});
```

![img](last_index/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: /a/ {
  lastIndex: 0,
}
expect: /a/ {
  lastIndex: 10,
}
```

</details>


## regex and string representing the same regex

```js
assert({
  actual: /a/,
  expect: "/a/",
});
```

![img](regex_and_string_representing_the_same_regex/throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: /a/
expect: "/a/"
```

</details>