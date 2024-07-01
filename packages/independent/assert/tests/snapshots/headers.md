# content-type added

```js
assert({
  actual: new Headers({
    "content-type": "text/xml",
  }),
  expect: new Headers(),
});
```

![img](<./headers/content-type added.svg>)

# content-type removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "content-type": "text/xml",
  }),
});
```

![img](<./headers/content-type removed.svg>)

# content-type modified

```js
assert({
  actual: new Headers({
    "content-type": "text/css",
  }),
  expect: new Headers({
    "content-type": "text/xml",
  }),
});
```

![img](<./headers/content-type modified.svg>)

# content-type multi diff

```js
assert({
  actual: new Headers({
    "content-type": "text/xml, text/css",
  }),
  expect: new Headers({
    "content-type": "text/xml, text/html",
  }),
});
```

![img](<./headers/content-type multi diff.svg>)

# content-type spacing diff

```js
assert({
  actual: new Headers({
    "content-type": "text/xml,text/css",
  }),
  expect: new Headers({
    "content-type": "text/xml, text/css",
  }),
});
```

![img](<./headers/content-type spacing diff.svg>)

# set cookie added

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1",
  }),
  expect: new Headers({}),
});
```

![img](<./headers/set cookie added.svg>)

# set cookie removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "set-cookie": "a=1;",
  }),
});
```

![img](<./headers/set cookie removed.svg>)

# cookie added

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1,b=2",
  }),
  expect: new Headers({
    "set-cookie": "a=9",
  }),
});
```

![img](<./headers/cookie added.svg>)

