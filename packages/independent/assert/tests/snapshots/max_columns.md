# string open quote

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 9,
});
```

![img](<./max_columns/string open quote.svg>)

# string first char

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 10,
});
```

![img](<./max_columns/string first char.svg>)

# string second char

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 11,
});
```

![img](<./max_columns/string second char.svg>)

# string third char

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 12,
});
```

![img](<./max_columns/string third char.svg>)

# string fourth char

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 13,
});
```

![img](<./max_columns/string fourth char.svg>)

# string last char

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 19,
});
```

![img](<./max_columns/string last char.svg>)

# string close quote

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS: 20,
});
```

![img](<./max_columns/string close quote.svg>)

# at property value

```js
assert({
  actual: {
    zzz: "abcdefghijklmn",
  },
  expect: {
    zzz: "ABCDEFGHIJKLMN",
  },
  MAX_COLUMNS: 20,
});
```

![img](<./max_columns/at property value.svg>)

# at property key

```js
assert({
  actual: {
    "a quite long property key that will be truncated": true,
  },
  expect: {
    "a quite long property key that will be truncated": false,
  },
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/at property key.svg>)

# at property name last char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 10,
});
```

![img](<./max_columns/at property name last char.svg>)

# at property name separator

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 11,
});
```

![img](<./max_columns/at property name separator.svg>)

# at space after property name separator

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 12,
});
```

![img](<./max_columns/at space after property name separator.svg>)

# at property value first char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 13,
});
```

![img](<./max_columns/at property value first char.svg>)

# at property value second char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 14,
});
```

![img](<./max_columns/at property value second char.svg>)

# at property value second char (and value width is 1)

```js
assert({
  actual: {
    abcdefgh: 0,
  },
  expect: {
    abcdefgh: 1,
  },
  MAX_COLUMNS: 14,
});
```

![img](<./max_columns/at property value second char (and value width is 1).svg>)

# at property value third char

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at property value third char.svg>)

# url search param modified, middle of long params

```js
assert({
  actual: "http://example_that_is_long.com?this_is_relatively_long=1&foo=a",
  expect: "http://example_that_is_long.com?this_is_relatively_long=1&foo=b",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/url search param modified, middle of long params.svg>)

# long url diff at end

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "http://example_that_is_quite_long.com/dir/file.css",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long url diff at end.svg>)

# long url diff at start

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "file://example_that_is_quite_long.com/dir/file.txt",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long url diff at start.svg>)

# long url diff in the middle

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "http://example_that_AA_quite_long.com/dir/file.txt",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long url diff in the middle.svg>)

# long url diff start middle end

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "file://example_that_AA_quite_long.com/dir/file.css",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long url diff start middle end.svg>)

