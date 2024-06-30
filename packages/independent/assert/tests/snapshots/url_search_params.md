# foo added

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams(),
});
```

![img](<./url_search_params/foo added.svg>)

# foo removed

```js
assert({
  actual: new URLSearchParams(),
  expect: new URLSearchParams("foo=a"),
});
```

![img](<./url_search_params/foo removed.svg>)

# foo modified

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams("foo=b"),
});
```

![img](<./url_search_params/foo modified.svg>)

# foo second value added

```js
assert({
  actual: new URLSearchParams("foo=a&foo=a"),
  expect: new URLSearchParams("foo=a"),
});
```

![img](<./url_search_params/foo second value added.svg>)

# foo second value removed

```js
assert({
  actual: new URLSearchParams("foo=a"),
  expect: new URLSearchParams("foo=a&foo=a"),
});
```

![img](<./url_search_params/foo second value removed.svg>)

# foo second value modified

```js
assert({
  actual: new URLSearchParams("foo=a&foo=b"),
  expect: new URLSearchParams("foo=a&foo=a"),
});
```

![img](<./url_search_params/foo second value modified.svg>)

# param order modified and value modified

```js
assert({
  actual: new URLSearchParams("foo=a&bar=a"),
  expect: new URLSearchParams("bar=b&foo=b"),
});
```

![img](<./url_search_params/param order modified and value modified.svg>)

