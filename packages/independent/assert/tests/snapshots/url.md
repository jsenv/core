# url object port

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com:8000"),
});
```

![img](<./url/url_object_port.svg>)

# url string port

```js
assert({
  actual: "http://example.com",
  expect: "http://example.com:8000",
});
```

![img](<./url/url_string_port.svg>)

# url string vs url object port

```js
assert({
  actual: "http://example.com",
  expect: new URL("http://example.com:8000"),
});
```

![img](<./url/url_string_vs_url_object_port.svg>)

# url search param modified

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com?foo=b"),
});
```

![img](<./url/url_search_param_modified.svg>)

# url search param added

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com"),
});
```

![img](<./url/url_search_param_added.svg>)

# url search param added 2

```js
assert({
  actual: new URL("http://example.com?foo=a&bar=b"),
  expect: new URL("http://example.com?foo=a"),
});
```

![img](<./url/url_search_param_added_2.svg>)

# url search param removed

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com?foo=a"),
});
```

![img](<./url/url_search_param_removed.svg>)

# url search param removed 2

```js
assert({
  actual: new URL("http://example.com?foo=a"),
  expect: new URL("http://example.com?foo=a&bar=b"),
});
```

![img](<./url/url_search_param_removed_2.svg>)

# multi search param 2nd value modified

```js
assert({
  actual: "http://example.com?foo=a&foo=b&foo=a",
  expect: "http://example.com?foo=a&foo=a&foo=a",
});
```

![img](<./url/multi_search_param_2nd_value_modified.svg>)

# adding multi search

```js
assert({
  actual: "http://example.com?foo=a&foo=b",
  expect: "http://example.com?foo=a",
});
```

![img](<./url/adding_multi_search.svg>)

# multi search adding a 3rd param

```js
assert({
  actual: "http://example.com?foo=a&foo=a&foo=a",
  expect: "http://example.com?foo=a&foo=a",
});
```

![img](<./url/multi_search_adding_a_3rd_param.svg>)

# multi search removing a 3rd param

```js
assert({
  actual: "http://example.com?foo=a&foo=a",
  expect: "http://example.com?foo=a&foo=a&foo=a",
});
```

![img](<./url/multi_search_removing_a_3rd_param.svg>)

# removing multi search

```js
assert({
  actual: "http://example.com?foo=a",
  expect: "http://example.com?foo=a&foo=b",
});
```

![img](<./url/removing_multi_search.svg>)

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

![img](<./url/url_search_param_+_vs_space.svg>)

# param order modified and value modified

```js
assert({
  actual: "http://example.com?foo=a&bar=a",
  expect: "http://example.com?bar=b&foo=b",
});
```

![img](<./url/param_order_modified_and_value_modified.svg>)

# param order modified and value modified 2

```js
assert({
  actual: "http://example.com?foo=foo_1&bar=bar_1&foo=foo_2&bar=bar_2",
  expect: "http://example.com?bar=BAR_1&foo=FOO_1&bar=BAR_2&foo=FOO_2",
});
```

![img](<./url/param_order_modified_and_value_modified_2.svg>)

# url hash modified

```js
assert({
  actual: new URL("http://example.com#foo"),
  expect: new URL("http://example.com#bar"),
});
```

![img](<./url/url_hash_modified.svg>)

# url hash removed

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com#bar"),
});
```

![img](<./url/url_hash_removed.svg>)

# url and url string

```js
assert({
  actual: new URL("http://example.com"),
  expect: "http://example.com:8000",
});
```

![img](<./url/url_and_url_string.svg>)

# url string and url string

```js
assert({
  actual: "http://example.com",
  expect: "http://example.com:8000",
});
```

![img](<./url/url_string_and_url_string.svg>)

# url and non url string

```js
assert({
  actual: new URL("http://example.com"),
  expect: "totoabcexample.com",
});
```

![img](<./url/url_and_non_url_string.svg>)

# non url string and url

```js
assert({
  actual: "totoabcexample.com",
  expect: new URL("http://example.com"),
});
```

![img](<./url/non_url_string_and_url.svg>)

# url and boolean

```js
assert({
  actual: new URL("http://example.com"),
  expect: true,
});
```

![img](<./url/url_and_boolean.svg>)

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

![img](<./url/url_string_inside_a_prop.svg>)

# url string and object with href

```js
assert({
  actual: "http://example.com",
  expect: {
    href: "http://example.com",
  },
});
```

![img](<./url/url_string_and_object_with_href.svg>)

# url object port and object with port

```js
assert({
  actual: new URL("http://example.com:45"),
  expect: {
    port: 45,
  },
});
```

![img](<./url/url_object_port_and_object_with_port.svg>)

# file protocol vs http protocol

```js
assert({
  actual: "http://example/file.txt",
  expect: "file://example/file.js",
});
```

![img](<./url/file_protocol_vs_http_protocol.svg>)

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

![img](<./url/url_origin_is_case_insensitive.svg>)

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

![img](<./url/internal_string_vs_url_object.svg>)

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

![img](<./url/internal_url_string_vs_url_string.svg>)

