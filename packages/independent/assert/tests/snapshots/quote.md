# string contains escaped double quote

```js
assert({
  // prettier-ignore
  actual: "I\\\"m dam",
  // prettier-ignore
  expect: "I\\\"m seb",
});
```

![img](<./quote/string contains escaped double quote.svg>)

# single quote best in actual

```js
assert({
  actual: `My name is "dam"`,
  expect: `My name is ZdamZ`,
});
```

![img](<./quote/single quote best in actual.svg>)

# single quote best in expect

```js
assert({
  actual: `My name is ZdamZ`,
  expect: `My name is "dam"`,
});
```

![img](<./quote/single quote best in expect.svg>)

# template quote best in expect

```js
assert({
  actual: `I'm "zac"`,
  expect: `I'm "dam"`,
});
```

![img](<./quote/template quote best in expect.svg>)

# double best and must be escaped

```js
assert({
  actual: `START "dam" \`''' END`,
  expect: `START "zac" \`''' END`,
});
```

![img](<./quote/double best and must be escaped.svg>)

# single quote

```js
assert({
  actual: {
    "I'm": true,
  },
  expect: {
    "I'm": false,
  },
});
```

![img](<./quote/single quote.svg>)

# double quote

```js
assert({
  actual: {
    'He is "crazy"': true,
  },
  expect: {
    'He is "crazy"': false,
  },
});
```

![img](<./quote/double quote.svg>)

# single and double

```js
assert({
  actual: {
    [`You're "crazy"`]: true,
  },
  expect: {
    [`You're "crazy"`]: false,
  },
});
```

![img](<./quote/single and double.svg>)

# double quote in url string

```js
assert({
  actual: `http://a.com"`,
  expect: `http://b.com"`,
});
```

![img](<./quote/double quote in url string.svg>)

# double quote in url search param key

```js
assert({
  actual: `http://a.com?fo"=true`,
  expect: `http://a.com?fo"=false`,
});
```

![img](<./quote/double quote in url search param key.svg>)

# double quote in url search param value

```js
assert({
  actual: `http://a.com?foo="dam"`,
  expect: `http://a.com?foo="seb"`,
});
```

![img](<./quote/double quote in url search param value.svg>)

# double quote in url pathname

```js
assert({
  actual: `http://a.com/dir/"dam"`,
  expect: `http://b.com/dir/"dam"`,
});
```

![img](<./quote/double quote in url pathname.svg>)

# url vs string

```js
assert({
  actual: "http://example.com",
  expect: `test"quotes`,
});
```

![img](<./quote/url vs string.svg>)

# url search param quotes

```js
assert({
  actual: `http://example.com?name="dam"`,
  expect: `http://example.com?name="seb"`,
});
```

![img](<./quote/url search param quotes.svg>)

