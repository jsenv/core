# string single char

```js
assert({
  actual: "a",
  expected: "b",
});
```

![img](<./string/string single char.svg>)

# diff end of string

```js
assert({
  actual: "hello world",
  expected: "hello france",
});
```

![img](<./string/diff end of string.svg>)

# one char should be empty

```js
assert({
  actual: "a",
  expected: "",
});
```

![img](<./string/one char should be empty.svg>)

# empty should be one char

```js
assert({
  actual: "",
  expected: "a",
});
```

![img](<./string/empty should be one char.svg>)

# tab vs space

```js
assert({
  actual: "	",
  expected: "  ",
});
```

![img](<./string/tab vs space.svg>)

# blank char should be empty

```js
assert({
  actual: String.fromCharCode(127),
  expected: "",
});
```

![img](<./string/blank char should be empty.svg>)

# diff unicode

```js
assert({
  actual: "⚫️",
  expected: "⚪️",
});
```

![img](<./string/diff unicode.svg>)

# diff emoticon

```js
assert({
  actual: "👨‍👩‍👧‍👧",
  expected: "😍",
});
```

![img](<./string/diff emoticon.svg>)

# diff special char

```js
assert({
  actual: "ñ",
  expected: "n",
});
```

![img](<./string/diff special char.svg>)

# added char

```js
assert({
  actual: "ab",
  expected: "a",
});
```

![img](<./string/added char.svg>)

# removed char

```js
assert({
  actual: "a",
  expected: "ab",
});
```

![img](<./string/removed char.svg>)

# diff at end of long string, start truncated

```js
assert({
  actual: "abcdefghijk",
  expected: "abcdefghijj",
  maxColumns: 18,
});
```

![img](<./string/diff at end of long string, start truncated.svg>)

# diff at start of long string, end truncated

```js
assert({
  actual: "a2cdefghijk",
  expected: "a3cdefghijk",
  maxColumns: 18,
});
```

![img](<./string/diff at start of long string, end truncated.svg>)

# many diff in long string, only first is shown truncated

```js
assert({
  actual: "a2cdefZZZghijk",
  expected: "a3cdefYYYghijk",
  maxColumns: 18,
});
```

![img](<./string/many diff in long string, only first is shown truncated.svg>)

# diff at middle of long string, start + end truncated

```js
assert({
  actual: "abcdefgh5jklmnopqrstu",
  expected: "abcdefgh6jklmnopqrstu",
  maxColumns: 15,
});
```

![img](<./string/diff at middle of long string, start + end truncated.svg>)

# diff new String value

```js
assert({
  actual: new String("a"),
  expected: new String("b"),
});
```

![img](<./string/diff new String value.svg>)

# diff String object vs literal

```js
assert({
  actual: new String("abc"),
  expected: "a2",
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
  expected: {
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
  expected: {
    bar: {
      a: new String("toto"),
    },
  },
  maxDepthInsideDiff: 0,
});
```

![img](<./string/new String collapsed.svg>)

# new String prop

```js
assert({
  actual: Object.assign(new String("toto"), { foo: "a" }),
  expected: Object.assign(new String("tata"), { foo: "b" }),
});
```

![img](<./string/new String prop.svg>)

# compare multiline

```js
assert({
  actual: {
    foo: `Hello,
my name is Benjamin`,
  },
  expected: {
    foo: `Hello,
my name is Ben`,
  },
});
```

![img](<./string/compare multiline.svg>)

# compare single and multi

```js
assert({
  actual: "Hel",
  expected: `Hello
world`,
});
```

![img](<./string/compare single and multi.svg>)

