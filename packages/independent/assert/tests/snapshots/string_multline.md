# add empty line

```js
assert({
  actual: `\n`,
  expect: ``,
});
```

![img](<./string_multline/add_empty_line.svg>)

# remove empty line

```js
assert({
  actual: ``,
  expect: `\n`,
});
```

![img](<./string_multline/remove_empty_line.svg>)

# one line vs two lines

```js
assert({
  actual: "Hel",
  expect: `Hello
world`,
});
```

![img](<./string_multline/one_line_vs_two_lines.svg>)

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

![img](<./string_multline/second_line_contains_extra_chars.svg>)

# second line differs

```js
assert({
  actual: `Hello
world`,
  expect: `Hello
france`,
});
```

![img](<./string_multline/second_line_differs.svg>)

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
  MAX_CONTEXT_BEFORE_DIFF: 2,
  MAX_CONTEXT_AFTER_DIFF: 2,
});
```

![img](<./string_multline/too_many_lines_before_and_after.svg>)

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

![img](<./string_multline/many_lines_added.svg>)

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

![img](<./string_multline/many_lines_removed.svg>)

# prop before and after

```js
assert({
  actual: {
    a: true,
    b: `a\nb`,
    c: true,
  },
  expect: {
    a: true,
    b: `a\nc`,
    c: true,
  },
});
```

![img](<./string_multline/prop_before_and_after.svg>)

# new line escaped

```js
assert({
  actual: {
    a: `\\n`,
    b: true,
  },
  expect: {
    a: `\\n`,
    b: false,
  },
});
```

![img](<./string_multline/new_line_escaped.svg>)

# multiline without diff

```js
assert({
  actual: {
    a: "a\nb",
    b: true,
  },
  expect: {
    a: `a\nb`,
    b: false,
  },
});
```

![img](<./string_multline/multiline_without_diff.svg>)

# many lines around

```js
assert({
  actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello world
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
  expect: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello europa
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
});
```

![img](<./string_multline/many_lines_around.svg>)

# many lines before

```js
assert({
  actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz`,
  expect: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello france]abcdefghijklmnopqrstuvwxyz`,
});
```

![img](<./string_multline/many_lines_before.svg>)

# exactly on line break

```js
assert({
  actual: `abc`,
  expect: `ab\nc`,
});
```

![img](<./string_multline/exactly_on_line_break.svg>)

