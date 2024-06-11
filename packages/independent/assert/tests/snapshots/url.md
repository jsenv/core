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

