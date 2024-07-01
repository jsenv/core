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
    "set-cookie": "a=1",
  }),
});
```

![img](<./headers/cookie added.svg>)

# cookie removed

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1",
  }),
  expect: new Headers({
    "set-cookie": "a=1,b=2,",
  }),
});
```

![img](<./headers/cookie removed.svg>)

# cookie order modified

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1,b=2",
  }),
  expect: new Headers({
    "set-cookie": "b=2,a=1",
  }),
});
```

![img](<./headers/cookie order modified.svg>)

# cookie name used several times

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1,a=2",
  }),
  expect: new Headers({
    "set-cookie": "a=9,a=8",
  }),
});
```

![img](<./headers/cookie name used several times.svg>)

# cookie becomes secure

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1; Secure",
  }),
  expect: new Headers({
    "set-cookie": "a=1",
  }),
});
```

![img](<./headers/cookie becomes secure.svg>)

# accept

```js
assert({
  actual: new Headers({
    accept: "text/html, application/xml;q=0.9, */*;q=0.8",
  }),
  expect: new Headers({
    accept: "text/html, application/xml;q=0.8, */*;q=0.7, text/css",
  }),
});
```

![img](<./headers/accept.svg>)

# add accepted encoding

```js
assert({
  actual: new Headers({
    "accept-encoding": "deflate, gzip, br",
  }),
  expect: new Headers({
    "accept-encoding": "deflate, gzip",
  }),
});
```

![img](<./headers/add accepted encoding.svg>)

# remove accepted encoding

```js
assert({
  actual: new Headers({
    "accept-encoding": "deflate, gzip",
  }),
  expect: new Headers({
    "accept-encoding": "deflate, gzip, br",
  }),
});
```

![img](<./headers/remove accepted encoding.svg>)

# accept-encoding diff on q

```js
assert({
  actual: new Headers({
    "accept-encoding": "deflate, gzip;q=1.0, *;q=0.5",
  }),
  expect: new Headers({
    "accept-encoding": "deflate, gzip;q=0.9, *;q=0.4",
  }),
});
```

![img](<./headers/accept-encoding diff on q.svg>)

# accept-language

```js
assert({
  actual: new Headers({
    "accept-language": "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5",
  }),
  expect: new Headers({
    "accept-language": "en-US,en;q=0.5",
  }),
});
```

![img](<./headers/accept-language.svg>)

# add metric in server timing

```js
assert({
  actual: new Headers({
    "server-timing": `cpu;dur=2.4, app;dur=47.2`,
  }),
  expect: new Headers({
    "server-timing": `cpu;dur=2.4`,
  }),
});
```

![img](<./headers/add metric in server timing.svg>)

# remove metric in server timing

```js
assert({
  actual: new Headers({
    "server-timing": `cpu;dur=2.4`,
  }),
  expect: new Headers({
    "server-timing": `cpu;dur=2.4, app;dur=47.2`,
  }),
});
```

![img](<./headers/remove metric in server timing.svg>)

# add description to a metric

```js
assert({
  actual: new Headers({
    "server-timing": `cache;dur=23.2`,
  }),
  expect: new Headers({
    "server-timing": `cache;desc="Cache Read";dur=23.2`,
  }),
});
```

![img](<./headers/add description to a metric.svg>)

