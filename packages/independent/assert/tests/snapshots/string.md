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
  maxColumns: 18,
});
```

![img](<./string/diff at end of long string, start truncated.svg>)

# diff at start of long string, end truncated

```js
assert({
  actual: "a2cdefghijk",
  expect: "a3cdefghijk",
  maxColumns: 18,
});
```

![img](<./string/diff at start of long string, end truncated.svg>)

# many diff in long string, only first is shown truncated

```js
assert({
  actual: "a2cdefZZZghijk",
  expect: "a3cdefYYYghijk",
  maxColumns: 18,
});
```

![img](<./string/many diff in long string, only first is shown truncated.svg>)

# diff at middle of long string, start + end truncated

```js
assert({
  actual: "abcdefgh5jklmnopqrstu",
  expect: "abcdefgh6jklmnopqrstu",
  maxColumns: 15,
});
```

![img](<./string/diff at middle of long string, start + end truncated.svg>)

# single quote best in actual

```js
assert({
  actual: `My name is "dam"`,
  expect: `My name is ZdamZ`,
});
```

![img](<./string/single quote best in actual.svg>)

# single quote best in expect

```js
assert({
  actual: `My name is ZdamZ`,
  expect: `My name is "dam"`,
});
```

![img](<./string/single quote best in expect.svg>)

# template quote best in expect

```js
assert({
  actual: `I'm "zac"`,
  expect: `I'm "dam"`,
});
```

![img](<./string/template quote best in expect.svg>)

# double best and must be escaped

```js
assert({
  actual: `START "dam" \`''' END`,
  expect: `START "zac" \`''' END`,
});
```

![img](<./string/double best and must be escaped.svg>)

# second line contains extra chars

```js
assert({
  actual: {
    foo: `Hello,
my name is Benjamin
and my brother is joe`,
  },
  expect: {
    foo: `Hello,
my name is Ben
and my brother is joe`,
  },
});
```

![img](<./string/second line contains extra chars.svg>)

# add empty line

```js
assert({
  actual: `\n`,
  expect: ``,
});
```

![img](<./string/add empty line.svg>)

# remove empty line

```js
assert({
  actual: ``,
  expect: `\n`,
});
```

![img](<./string/remove empty line.svg>)

# one line vs two lines

```js
assert({
  actual: "Hel",
  expect: `Hello
world`,
});
```

![img](<./string/one line vs two lines.svg>)

# second line differs

```js
assert({
  actual: `Hello
world`,
  expect: `Hello
france`,
});
```

![img](<./string/second line differs.svg>)

# too many lines before and after

```js
assert({
  actual: `one
two
three
four/true
five
six
seven/0`,
  expect: `one
two
three
four/false
five
six
seven/1`,
});
```

![img](<./string/too many lines before and after.svg>)

# many lines added

```js
assert({
  actual: `one
two
three
four
five six`,
  expect: `one`,
});
```

![img](<./string/many lines added.svg>)

# many lines removed

```js
assert({
  actual: `one`,
  expect: `one
two
three
four
five six`,
});
```

![img](<./string/many lines removed.svg>)

