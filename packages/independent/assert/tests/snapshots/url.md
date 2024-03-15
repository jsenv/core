# url port

```js
assert({
  actual: new URL("http://example.com"),
  expected: new URL("http://example.com:8000"),
});
```

![img](<./url/url port.svg>)

# url and url string

```js
assert({
  actual: new URL("http://example.com"),
  expected: "http://example.com:8000",
});
```

![img](<./url/url and url string.svg>)

# url string and url

```js
assert({
  actual: "http://example.com",
  expected: new URL("http://example.com:8000"),
});
```

![img](<./url/url string and url.svg>)

# url string and url string

```js
assert({
  actual: "http://example.com",
  expected: "http://example.com:8000",
});
```

![img](<./url/url string and url string.svg>)

# url and non url string

```js
assert({
  actual: new URL("http://example.com"),
  expected: "totoabcexample.com",
});
```

![img](<./url/url and non url string.svg>)

# non url string and url

```js
assert({
  actual: "totoabcexample.com",
  expected: new URL("http://example.com"),
});
```

![img](<./url/non url string and url.svg>)

# url and boolean

```js
assert({
  actual: new URL("http://example.com"),
  expected: true,
});
```

![img](<./url/url and boolean.svg>)

