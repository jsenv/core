# at removed char

```js
assert({
  actual: "str",
  expect: "str_123456789",
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at removed char.svg>)

# at added char

```js
assert({
  actual: "str_123456789",
  expect: "str",
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at added char.svg>)

# at removed char 2

```js
assert({
  actual: "a_long_string",
  expect: "a_long_string_123456789",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/at removed char 2.svg>)

# at added char 2

```js
assert({
  actual: "a_long_string_123456789",
  expect: "a_long_string",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/at added char 2.svg>)

# at removed char 3

```js
assert({
  actual: "a_long_string",
  expect: "a_long_string_123456789",
  MAX_COLUMNS: 22,
});
```

![img](<./max_columns/at removed char 3.svg>)

# at added char 3

```js
assert({
  actual: "a_long_string_123456789",
  expect: "a_long_string",
  MAX_COLUMNS: 22,
});
```

![img](<./max_columns/at added char 3.svg>)

# on string at 9

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 9.svg>)

# on string at 10

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 10.svg>)

# on string at 11

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 11.svg>)

# on string at 12

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 12.svg>)

# on string at 13

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 13.svg>)

# on string at 19

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 19.svg>)

# on string at 20

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/on string at 20.svg>)

# on property at 10

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 10.svg>)

# on property at 11

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 11.svg>)

# on property at 12

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 12.svg>)

# on property at 13

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 13.svg>)

# on property at 14

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 14.svg>)

# on property at 15

```js
assert({
  actual: {
    abcdefgh: true,
  },
  expect: {
    abcdefgh: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on property at 15.svg>)

# on array at 20

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 20.svg>)

# on array at 21

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 21.svg>)

# on array at 22

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 22.svg>)

# on array at 23

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 23.svg>)

# on array at 24

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 24.svg>)

# on array at 25

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 25.svg>)

# on array at 26

```js
// expecting to go through the following phases
// but not as soon as columns+1 as some steps require 2 more chars to be displayed
// 1. "abcdefghijklmno,"
// 2. "abcdefghijklmno: …,"
// 3. "abcdefghijklmno: […],"
// 4. "abcdefghijklmno: [0, …],"
assert({
  actual: {
    abcdefghijklmno: [0, 1, 2],
    z: true,
  },
  expect: {
    abcdefghijklmno: [0, 1, 2],
    z: false,
  },
  MAX_COLUMNS,
});
```

![img](<./max_columns/on array at 26.svg>)

# on property at 15 and value width is 1

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

![img](<./max_columns/on property at 15 and value width is 1.svg>)

# on middle of property key

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

![img](<./max_columns/on middle of property key.svg>)

# max column exactly on diff

```js
assert({
  actual: `abc`,
  expect: `abC`,
  MAX_COLUMNS: 12,
});
```

![img](<./max_columns/max column exactly on diff.svg>)

# double slash and truncate line

```js
assert({
  actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
  expect: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
  MAX_COLUMNS: 50,
});
```

![img](<./max_columns/double slash and truncate line.svg>)

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

# lines around start partially truncated

```js
assert({
  actual: `
123456789
abcdefghijkl`,
  expect: `
123456789
abcdefghZjkl`,
  MAX_COLUMNS: 16,
});
```

![img](<./max_columns/lines around start partially truncated.svg>)

# lines around start fully truncated

```js
assert({
  actual: `
1
abcd`,
  expect: `
1
abcZ`,
  MAX_COLUMNS: 14,
});
```

![img](<./max_columns/lines around start fully truncated.svg>)

# lines around start fully truncated 2

```js
assert({
  actual: `
1
abcdefgh`,
  expect: `
1
abcdeZgh`,
  MAX_COLUMNS: 16,
});
```

![img](<./max_columns/lines around start fully truncated 2.svg>)

# lines around end is truncated

```js
assert({
  actual: `
123456789
abcdef
1234567`,
  expect: `
123456789
Zbcdef
123456789`,
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/lines around end is truncated.svg>)

# lines around end is truncated 2

```js
assert({
  actual: `
123456789
abcdefghi
123456789`,
  expect: `
123456789
abcdZfghi
123456789`,
  MAX_COLUMNS: 18,
});
```

![img](<./max_columns/lines around end is truncated 2.svg>)

