# url object port

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com:8000"),
});
```

![img](<./url/url object port.svg>)

# url string port

```js
assert({
  actual: "http://example.com",
  expect: "http://example.com:8000",
});
```

![img](<./url/url string port.svg>)

# url string vs url object port

```js
assert({
  actual: "http://example.com",
  expect: new URL("http://example.com:8000"),
});
```

![img](<./url/url string vs url object port.svg>)

# url search param modified

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com?foo=b"),
});
```

![img](<./url/url search param modified.svg>)

# url search param added

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com"),
});
```

![img](<./url/url search param added.svg>)

# url search param added 2

```js
assert({
  actual: new URL("http://example.com?foo=a&bar=b"),
  expect: new URL("http://example.com?foo=a"),
});
```

![img](<./url/url search param added 2.svg>)

# url search param removed

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com?foo=a"),
});
```

![img](<./url/url search param removed.svg>)

# url search param removed 2

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com?foo=a&bar=b"),
});
```

![img](<./url/url search param removed 2.svg>)

# multi search param 2nd value modified

```js
assert({
  actual: "http://example.com?foo=a&foo=b&foo=a",
  expect: "http://example.com?foo=a&foo=a&foo=a",
});
```

![img](<./url/multi search param 2nd value modified.svg>)

# adding multi search

```js
assert({
  actual: "http://example.com?foo=a&foo=b",
  expect: "http://example.com?foo=a",
});
```

![img](<./url/adding multi search.svg>)

# multi search adding a 3rd param

```js
assert({
  actual: "http://example.com?foo=a&foo=a&foo=a",
  expect: "http://example.com?foo=a&foo=a",
});
```

![img](<./url/multi search adding a 3rd param.svg>)

# multi search removing a 3rd param

```js
assert({
  actual: "http://example.com?foo=a&foo=a",
  expect: "http://example.com?foo=a&foo=a&foo=a",
});
```

![img](<./url/multi search removing a 3rd param.svg>)

# removing multi search

```js
assert({
  actual: "http://example.com?foo=a",
  expect: "http://example.com?foo=a&foo=b",
});
```

![img](<./url/removing multi search.svg>)

