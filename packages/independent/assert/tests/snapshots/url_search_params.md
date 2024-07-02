# foo added

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams(),
});
```

![img](<./url_search_params/foo_added.svg>)

# foo removed

```js
assert({
  actual: new URLSearchParams(),
  expect: new URLSearchParams("foo=a"),
});
```

![img](<./url_search_params/foo_removed.svg>)

# foo modified

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams("foo=b"),
});
```

![img](<./url_search_params/foo_modified.svg>)

# foo second value added

```js
assert({
  actual: new URLSearchParams("foo=a&foo=a"),
  expect: new URLSearchParams("foo=a"),
});
```

![img](<./url_search_params/foo_second_value_added.svg>)

# foo second value removed

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams("foo=a&foo=a"),
});
```

![img](<./url_search_params/foo_second_value_removed.svg>)

# foo second value modified

```js
assert({
  actual: new URLSearchParams("foo=a&foo=b"),
  expect: new URLSearchParams("foo=a&foo=a"),
});
```

![img](<./url_search_params/foo_second_value_modified.svg>)

# param order modified and value modified

```js
assert({
  actual: new URLSearchParams("foo=a&bar=a"),
  expect: new URLSearchParams("bar=b&foo=b"),
});
```

![img](<./url_search_params/param_order_modified_and_value_modified.svg>)

