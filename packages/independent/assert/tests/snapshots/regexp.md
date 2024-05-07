# a vs b

```js
assert({
  actual: /a/,
  expect: /b/,
});
```

![img](<./regexp/a vs b.svg>)

# i flag vs no flag

```js
assert({
  actual: /a/i,
  expect: /a/,
});
```

![img](<./regexp/i flag vs no flag.svg>)

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

![img](<./regexp/gi flag vs ig flag.svg>)

# special char: parenthesis vs dot

```js
assert({
  actual: /^\($/g,
  expect: /^\.$/g,
});
```

![img](<./regexp/special char: parenthesis vs dot.svg>)

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

![img](<./regexp/last index.svg>)

# regex and string representing the same regex

```js
assert({
  actual: /a/,
  expect: "/a/",
});
```

![img](<./regexp/regex and string representing the same regex.svg>)

