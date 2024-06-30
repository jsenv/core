# string single char

```js
assert({
  actual: "a",
  expect: "b",
});
```

![img](<./string/string single char.svg>)

# diff end of string

```js
assert({
  actual: "hello world",
  expect: "hello france",
});
```

![img](<./string/diff end of string.svg>)

# one char should be empty

```js
assert({
  actual: "a",
  expect: "",
});
```

![img](<./string/one char should be empty.svg>)

# empty should be one char

```js
assert({
  actual: "",
  expect: "a",
});
```

![img](<./string/empty should be one char.svg>)

# tab vs space

```js
assert({
  actual: "	",
  expect: "  ",
});
```

![img](<./string/tab vs space.svg>)

# blank char should be empty

```js
assert({
  actual: String.fromCharCode(127),
  expect: "",
});
```

![img](<./string/blank char should be empty.svg>)

# blank char should be empty 2

```js
assert({
  actual: String.fromCharCode(0),
  expect: "",
});
```

![img](<./string/blank char should be empty 2.svg>)

# diff unicode

```js
assert({
  actual: "⚫️",
  expect: "⚪️",
});
```

![img](<./string/diff unicode.svg>)

# diff emoticon

```js
assert({
  actual: "👨‍👩‍👧‍👧",
  expect: "😍",
});
```

![img](<./string/diff emoticon.svg>)

# diff special char

```js
assert({
  actual: "ñ",
  expect: "n",
});
```

![img](<./string/diff special char.svg>)

# special char diff

```js
assert({
  actual: "",
  expect: "",
});
```

![img](<./string/special char diff.svg>)

# more special char diff

```js
assert({
  actual: "!'#$%&'()*+,-./:;<=>",
  expect: "?@^[\\]_`{|}~",
});
```

![img](<./string/more special char diff.svg>)

# diff blackslash and ellipsis special chars

```js
assert({
  actual: "\\",
  expect: "",
});
```

![img](<./string/diff blackslash and ellipsis special chars.svg>)

# diff single space with 2 space

```js
assert({
  actual: " ",
  expect: "  ",
});
```

![img](<./string/diff single space with 2 space.svg>)

# added char

```js
assert({
  actual: "ab",
  expect: "a",
});
```

![img](<./string/added char.svg>)

# removed char

```js
assert({
  actual: "a",
  expect: "ab",
});
```

![img](<./string/removed char.svg>)

# diff at end of long string, start truncated

```js
assert({
  actual: "abcdefghijk",
  expect: "abcdefghijj",
  MAX_COLUMNS: 18,
});
```

![img](<./string/diff at end of long string, start truncated.svg>)

# diff at start of long string, end truncated

```js
assert({
  actual: "a2cdefghijk",
  expect: "a3cdefghijk",
  MAX_COLUMNS: 18,
});
```

![img](<./string/diff at start of long string, end truncated.svg>)

# many diff in long string, only first is shown truncated

```js
assert({
  actual: "a2cdefZZZghijk",
  expect: "a3cdefYYYghijk",
  MAX_COLUMNS: 18,
});
```

![img](<./string/many diff in long string, only first is shown truncated.svg>)

# diff at middle of long string, start + end truncated

```js
assert({
  actual: "abcdefgh5jklmnopqrstu",
  expect: "abcdefgh6jklmnopqrstu",
  MAX_COLUMNS: 15,
});
```

![img](<./string/diff at middle of long string, start + end truncated.svg>)

# diff new String value

```js
assert({
  actual: new String("a"),
  expect: new String("b"),
});
```

![img](<./string/diff new String value.svg>)

# diff String object vs literal

```js
assert({
  actual: new String("abc"),
  expect: "a2",
});
```

![img](<./string/diff String object vs literal.svg>)

# new String collapsed with overview

```js
assert({
  actual: {
    a: new String("toto"),
    b: true,
  },
  expect: {
    a: new String("toto"),
    b: false,
  },
});
```

![img](<./string/new String collapsed with overview.svg>)

# new String collapsed

```js
assert({
  actual: {
    foo: {
      a: new String("toto"),
    },
  },
  expect: {
    bar: {
      a: new String("toto"),
    },
  },
  MAX_DEPTH_INSIDE_DIFF: 1,
});
```

![img](<./string/new String collapsed.svg>)

# new String prop

```js
assert({
  actual: Object.assign(new String("a"), { foo: true }),
  expect: Object.assign(new String("b"), { foo: false }),
});
```

![img](<./string/new String prop.svg>)

