# string contains escaped double quote

```js
assert({
  // prettier-ignore
  actual: "I\\\"m dam",
  // prettier-ignore
  expect: "I\\\"m seb",
});
```

![img](<./quote/string_contains_escaped_double_quote.svg>)

# single quote best in actual

```js
assert({
  actual: `My name is "dam"`,
  expect: `My name is ZdamZ`,
});
```

![img](<./quote/single_quote_best_in_actual.svg>)

# single quote best in expect

```js
assert({
  actual: `My name is ZdamZ`,
  expect: `My name is "dam"`,
});
```

![img](<./quote/single_quote_best_in_expect.svg>)

# template quote best in expect

```js
assert({
  actual: `I'm "zac"`,
  expect: `I'm "dam"`,
});
```

![img](<./quote/template_quote_best_in_expect.svg>)

# double best and must be escaped

```js
assert({
  actual: `START "dam" \`''' END`,
  expect: `START "zac" \`''' END`,
});
```

![img](<./quote/double_best_and_must_be_escaped.svg>)

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

![img](<./quote/single_quote.svg>)

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

![img](<./quote/double_quote.svg>)

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

![img](<./quote/single_and_double.svg>)

# double quote in url string

```js
assert({
  actual: `http://a.com"`,
  expect: `http://b.com"`,
});
```

![img](<./quote/double_quote_in_url_string.svg>)

# double quote in url search param key

```js
assert({
  actual: `http://a.com?fo"=true`,
  expect: `http://a.com?fo"=false`,
});
```

![img](<./quote/double_quote_in_url_search_param_key.svg>)

# double quote in url search param value

```js
assert({
  actual: `http://a.com?foo="dam"`,
  expect: `http://a.com?foo="seb"`,
});
```

![img](<./quote/double_quote_in_url_search_param_value.svg>)

# double quote in url pathname

```js
assert({
  actual: `http://a.com/dir/"dam"`,
  expect: `http://b.com/dir/"dam"`,
});
```

![img](<./quote/double_quote_in_url_pathname.svg>)

# url vs string

```js
assert({
  actual: "http://example.com",
  expect: `test"quotes`,
});
```

![img](<./quote/url_vs_string.svg>)

# url search param quotes

```js
assert({
  actual: `http://example.com?name="dam"`,
  expect: `http://example.com?name="seb"`,
});
```

![img](<./quote/url_search_param_quotes.svg>)

