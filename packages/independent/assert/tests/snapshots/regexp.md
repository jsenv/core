# a vs b

```js
assert({
  actual: /a/,
  expect: /b/,
});
```

![img](<./regexp/a_vs_b.svg>)

# i flag vs no flag

```js
assert({
  actual: /a/i,
  expect: /a/,
});
```

![img](<./regexp/i_flag_vs_no_flag.svg>)

# gi flag vs ig flag

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

![img](<./regexp/gi_flag_vs_ig_flag.svg>)

# special char: parenthesis vs dot

```js
assert({
  actual: /^\($/g,
  expect: /^\.$/g,
});
```

![img](<./regexp/special_char_parenthesis_vs_dot.svg>)

# last index

```js
const actual = /a/;
const expect = /a/;
expect.lastIndex = 10;
assert({
  actual,
  expect,
});
```

![img](<./regexp/last_index.svg>)

# regex and string representing the same regex

```js
assert({
  actual: /a/,
  expect: "/a/",
});
```

![img](<./regexp/regex_and_string_representing_the_same_regex.svg>)

