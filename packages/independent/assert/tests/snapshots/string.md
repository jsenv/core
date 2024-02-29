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

