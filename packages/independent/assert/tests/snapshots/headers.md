# content-type added

```js
assert({
  actual: new Headers({
    "content-type": "text/xml",
  }),
  expect: new Headers(),
});
```

![img](<./headers/content-type_added.svg>)

# content-type removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "content-type": "text/xml",
  }),
});
```

![img](<./headers/content-type_removed.svg>)

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

![img](<./headers/content-type_modified.svg>)

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

![img](<./headers/content-type_multi_diff.svg>)

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

![img](<./headers/content-type_spacing_diff.svg>)

# set cookie added

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1",
  }),
  expect: new Headers({}),
});
```

![img](<./headers/set_cookie_added.svg>)

# set cookie removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "set-cookie": "a=1;",
  }),
});
```

![img](<./headers/set_cookie_removed.svg>)

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

![img](<./headers/cookie_added.svg>)

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

![img](<./headers/cookie_removed.svg>)

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

![img](<./headers/cookie_order_modified.svg>)

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

![img](<./headers/cookie_name_used_several_times.svg>)

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

![img](<./headers/cookie_becomes_secure.svg>)

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

# accept diff on non standard attribute

```js
assert({
  actual: new Headers({
    accept: "text/html; a=1; b=2",
  }),
  expect: new Headers({
    accept: "text/html; a=9; b=9",
  }),
});
```

![img](<./headers/accept_diff_on_non_standard_attribute.svg>)

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

![img](<./headers/add_accepted_encoding.svg>)

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

![img](<./headers/remove_accepted_encoding.svg>)

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

![img](<./headers/accept-encoding_diff_on_q.svg>)

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

![img](<./headers/add_metric_in_server_timing.svg>)

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

![img](<./headers/remove_metric_in_server_timing.svg>)

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

![img](<./headers/add_description_to_a_metric.svg>)

# content length diff

```js
assert({
  actual: new Headers({
    "content-length": "1456",
  }),
  expect: new Headers({
    "content-length": "1356",
  }),
});
```

![img](<./headers/content_length_diff.svg>)

