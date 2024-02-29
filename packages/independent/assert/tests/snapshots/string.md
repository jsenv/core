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

# truncate some chars before diff

```js
assert({
  actual: "abcdefghijk",
  expected: "abcdefghijj",
  maxColumns: 7,
});
```

![img](<./string/truncate some chars before diff.svg>)

