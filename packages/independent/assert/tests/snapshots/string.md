# string single char

```js
assert({
  actual: "a",
  expect: "b",
});
```

![img](<./string/string_single_char.svg>)

# diff end of string

```js
assert({
  actual: "hello world",
  expect: "hello france",
});
```

![img](<./string/diff_end_of_string.svg>)

# one char should be empty

```js
assert({
  actual: "a",
  expect: "",
});
```

![img](<./string/one_char_should_be_empty.svg>)

# empty should be one char

```js
assert({
  actual: "",
  expect: "a",
});
```

![img](<./string/empty_should_be_one_char.svg>)

# tab vs space

```js
assert({
  actual: "	",
  expect: "  ",
});
```

![img](<./string/tab_vs_space.svg>)

# blank char should be empty

```js
assert({
  actual: String.fromCharCode(127),
  expect: "",
});
```

![img](<./string/blank_char_should_be_empty.svg>)

# blank char should be empty 2

```js
assert({
  actual: String.fromCharCode(0),
  expect: "",
});
```

![img](<./string/blank_char_should_be_empty_2.svg>)

# diff unicode

```js
assert({
  actual: "⚫️",
  expect: "⚪️",
});
```

![img](<./string/diff_unicode.svg>)

# diff emoticon

```js
assert({
  actual: "👨‍👩‍👧‍👧",
  expect: "😍",
});
```

![img](<./string/diff_emoticon.svg>)

# diff special char

```js
assert({
  actual: "ñ",
  expect: "n",
});
```

![img](<./string/diff_special_char.svg>)

# special char diff

```js
assert({
  actual: "",
  expect: "",
});
```

![img](<./string/special_char_diff.svg>)

# more special char diff

```js
assert({
  actual: "!'#$%&'()*+,-./:;<=>",
  expect: "?@^[\\]_`{|}~",
});
```

![img](<./string/more_special_char_diff.svg>)

# diff blackslash and ellipsis special chars

```js
assert({
  actual: "\\",
  expect: "",
});
```

![img](<./string/diff_blackslash_and_ellipsis_special_chars.svg>)

# diff single space with 2 space

```js
assert({
  actual: " ",
  expect: "  ",
});
```

![img](<./string/diff_single_space_with_2_space.svg>)

# added char

```js
assert({
  actual: "ab",
  expect: "a",
});
```

![img](<./string/added_char.svg>)

# removed char

```js
assert({
  actual: "a",
  expect: "ab",
});
```

![img](<./string/removed_char.svg>)

# diff at end of long string, start truncated

```js
assert({
  actual: "abcdefghijk",
  expect: "abcdefghijj",
  MAX_COLUMNS: 18,
});
```

![img](<./string/diff_at_end_of_long_string__start_truncated.svg>)

# diff at start of long string, end truncated

```js
assert({
  actual: "a2cdefghijk",
  expect: "a3cdefghijk",
  MAX_COLUMNS: 18,
});
```

![img](<./string/diff_at_start_of_long_string__end_truncated.svg>)

# many diff in long string, only first is shown truncated

```js
assert({
  actual: "a2cdefZZZghijk",
  expect: "a3cdefYYYghijk",
  MAX_COLUMNS: 18,
});
```

![img](<./string/many_diff_in_long_string__only_first_is_shown_truncated.svg>)

# diff at middle of long string, start + end truncated

```js
assert({
  actual: "abcdefgh5jklmnopqrstu",
  expect: "abcdefgh6jklmnopqrstu",
  MAX_COLUMNS: 15,
});
```

![img](<./string/diff_at_middle_of_long_string__start_+_end_truncated.svg>)

# diff new String value

```js
assert({
  actual: new String("a"),
  expect: new String("b"),
});
```

![img](<./string/diff_new_string_value.svg>)

# diff String object vs literal

```js
assert({
  actual: new String("abc"),
  expect: "a2",
});
```

![img](<./string/diff_string_object_vs_literal.svg>)

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

![img](<./string/new_string_collapsed_with_overview.svg>)

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

![img](<./string/new_string_collapsed.svg>)

# new String prop

```js
assert({
  actual: Object.assign(new String("a"), { foo: true }),
  expect: Object.assign(new String("b"), { foo: false }),
});
```

![img](<./string/new_string_prop.svg>)

