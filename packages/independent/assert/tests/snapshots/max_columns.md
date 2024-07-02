# at removed char

```js
assert({
  actual: "str",
  expect: "str_123456789",
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at_removed_char.svg>)

# at added char

```js
assert({
  actual: "str_123456789",
  expect: "str",
  MAX_COLUMNS: 15,
});
```

![img](<./max_columns/at_added_char.svg>)

# at removed char 2

```js
assert({
  actual: "a_long_string",
  expect: "a_long_string_123456789",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/at_removed_char_2.svg>)

# at added char 2

```js
assert({
  actual: "a_long_string_123456789",
  expect: "a_long_string",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/at_added_char_2.svg>)

# at removed char 3

```js
assert({
  actual: "a_long_string",
  expect: "a_long_string_123456789",
  MAX_COLUMNS: 22,
});
```

![img](<./max_columns/at_removed_char_3.svg>)

# at added char 3

```js
assert({
  actual: "a_long_string_123456789",
  expect: "a_long_string",
  MAX_COLUMNS: 22,
});
```

![img](<./max_columns/at_added_char_3.svg>)

# string at 9

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_9.svg>)

# string at 10

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_10.svg>)

# string at 11

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_11.svg>)

# string at 12

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_12.svg>)

# string at 13

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_13.svg>)

# string at 19

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_19.svg>)

# string at 20

```js
assert({
  actual: "abcdefghij",
  expect: "ABCDEFGHIJ",
  MAX_COLUMNS,
});
```

![img](<./max_columns/string_at_20.svg>)

# number at 9

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_9.svg>)

# number at 10

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_10.svg>)

# number at 12

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_12.svg>)

# number at 13

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_13.svg>)

# number at 14

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_14.svg>)

# number at 16

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_16.svg>)

# number at 18

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_18.svg>)

# number at 19

```js
assert({
  actual: 123456789,
  expect: 123450789,
  MAX_COLUMNS,
});
```

![img](<./max_columns/number_at_19.svg>)

# boolean in property at 10

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

![img](<./max_columns/boolean_in_property_at_10.svg>)

# boolean in property at 11

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

![img](<./max_columns/boolean_in_property_at_11.svg>)

# boolean in property at 12

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

![img](<./max_columns/boolean_in_property_at_12.svg>)

# boolean in property at 13

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

![img](<./max_columns/boolean_in_property_at_13.svg>)

# boolean in property at 14

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

![img](<./max_columns/boolean_in_property_at_14.svg>)

# boolean in property at 15

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

![img](<./max_columns/boolean_in_property_at_15.svg>)

# array in property at 20

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

![img](<./max_columns/array_in_property_at_20.svg>)

# array in property at 21

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

![img](<./max_columns/array_in_property_at_21.svg>)

# array in property at 22

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

![img](<./max_columns/array_in_property_at_22.svg>)

# array in property at 23

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

![img](<./max_columns/array_in_property_at_23.svg>)

# array in property at 24

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

![img](<./max_columns/array_in_property_at_24.svg>)

# array in property at 25

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

![img](<./max_columns/array_in_property_at_25.svg>)

# array in property at 26

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

![img](<./max_columns/array_in_property_at_26.svg>)

# array in property at 27

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

![img](<./max_columns/array_in_property_at_27.svg>)

# array in property at 28

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

![img](<./max_columns/array_in_property_at_28.svg>)

# array in property at 29

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

![img](<./max_columns/array_in_property_at_29.svg>)

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

![img](<./max_columns/on_property_at_15_and_value_width_is_1.svg>)

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

![img](<./max_columns/on_middle_of_property_key.svg>)

# max column exactly on diff

```js
assert({
  actual: `abc`,
  expect: `abC`,
  MAX_COLUMNS: 12,
});
```

![img](<./max_columns/max_column_exactly_on_diff.svg>)

# double slash and truncate line

```js
assert({
  actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
  expect: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
  MAX_COLUMNS: 50,
});
```

![img](<./max_columns/double_slash_and_truncate_line.svg>)

# url search param modified, middle of long params

```js
assert({
  actual: "http://example_that_is_long.com?this_is_relatively_long=1&foo=a",
  expect: "http://example_that_is_long.com?this_is_relatively_long=1&foo=b",
  MAX_COLUMNS: 30,
});
```

![img](<./max_columns/url_search_param_modified__middle_of_long_params.svg>)

# long url diff at end

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "http://example_that_is_quite_long.com/dir/file.css",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long_url_diff_at_end.svg>)

# long url diff at start

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "file://example_that_is_quite_long.com/dir/file.txt",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long_url_diff_at_start.svg>)

# long url diff in the middle

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "http://example_that_AA_quite_long.com/dir/file.txt",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long_url_diff_in_the_middle.svg>)

# long url diff start middle end

```js
assert({
  actual: "http://example_that_is_quite_long.com/dir/file.txt",
  expect: "file://example_that_AA_quite_long.com/dir/file.css",
  MAX_COLUMNS: 40,
});
```

![img](<./max_columns/long_url_diff_start_middle_end.svg>)

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

![img](<./max_columns/lines_around_start_partially_truncated.svg>)

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

![img](<./max_columns/lines_around_start_fully_truncated.svg>)

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

![img](<./max_columns/lines_around_start_fully_truncated_2.svg>)

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

![img](<./max_columns/lines_around_end_is_truncated.svg>)

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

![img](<./max_columns/lines_around_end_is_truncated_2.svg>)

