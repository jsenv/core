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

# url search param + vs space

```js
assert({
  actual: {
    a: `http://example.com?a=+&b=1`,
    b: true,
  },
  expect: {
    a: `http://example.com?a= &b=1`,
    b: false,
  },
});
```

![img](<./url/url search param + vs space.svg>)

# param order modified and value modified

```js
assert({
  actual: "http://example.com?foo=a&bar=a",
  expect: "http://example.com?bar=b&foo=b",
});
```

![img](<./url/param order modified and value modified.svg>)

# url hash modified

```js
assert({
  actual: new URL("http://example.com#foo"),
  expect: new URL("http://example.com#bar"),
});
```

![img](<./url/url hash modified.svg>)

# url hash removed

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com#bar"),
});
```

![img](<./url/url hash removed.svg>)

# url and url string

```js
assert({
  actual: new URL("http://example.com"),
  expect: "http://example.com:8000",
});
```

![img](<./url/url and url string.svg>)

# url string and url string

```js
assert({
  actual: "http://example.com",
  expect: "http://example.com:8000",
});
```

![img](<./url/url string and url string.svg>)

# url and non url string

```js
assert({
  actual: new URL("http://example.com"),
  expect: "totoabcexample.com",
});
```

![img](<./url/url and non url string.svg>)

# non url string and url

```js
assert({
  actual: "totoabcexample.com",
  expect: new URL("http://example.com"),
});
```

![img](<./url/non url string and url.svg>)

# url and boolean

```js
assert({
  actual: new URL("http://example.com"),
  expect: true,
});
```

![img](<./url/url and boolean.svg>)

# url string inside a prop

```js
assert({
  actual: {
    a: "http://example.com",
    b: true,
  },
  expect: {
    a: "http://example.com",
    b: false,
  },
});
```

![img](<./url/url string inside a prop.svg>)

# url string and object with href

```js
assert({
  actual: "http://example.com",
  expect: {
    href: "http://example.com",
  },
});
```

![img](<./url/url string and object with href.svg>)

# url object port and object with port

```js
assert({
  actual: new URL("http://example.com:45"),
  expect: {
    port: 45,
  },
});
```

![img](<./url/url object port and object with port.svg>)

# file protocol vs http protocol

```js
assert({
  actual: "http://example/file.txt",
  expect: "file://example/file.js",
});
```

![img](<./url/file protocol vs http protocol.svg>)

# url origin is case insensitive

```js
assert({
  actual: {
    a: `http://example.com/page`,
    b: true,
  },
  expect: {
    a: `HTTP://EXAMPLE.COM/PAGE`,
    b: false,
  },
});
```

![img](<./url/url origin is case insensitive.svg>)

# internal string vs url object

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "toto",
  },
  expect: new URL("http://toto.com"),
});
```

![img](<./url/internal string vs url object.svg>)

# internal url string vs url string

```js
assert({
  actual: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => "http://a.com/",
  },
  expect: "http://b.com",
});
```

![img](<./url/internal url string vs url string.svg>)

