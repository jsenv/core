# headers.md

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../headers.test.js">../headers.test.js</a>
</sub>

## content-type added

```js
assert({
  actual: new Headers({
    "content-type": "text/xml",
  }),
  expect: new Headers(),
});
```

![img](content-type_added/content-type_added_throw.svg)

## content-type removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "content-type": "text/xml",
  }),
});
```

![img](content-type_removed/content-type_removed_throw.svg)

## content-type modified

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

![img](content-type_modified/content-type_modified_throw.svg)

## content-type multi diff

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

![img](content-type_multi_diff/content-type_multi_diff_throw.svg)

## content-type spacing diff

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

![img](content-type_spacing_diff/content-type_spacing_diff_throw.svg)

## set cookie added

```js
assert({
  actual: new Headers({
    "set-cookie": "a=1",
  }),
  expect: new Headers({}),
});
```

![img](set_cookie_added/set_cookie_added_throw.svg)

## set cookie removed

```js
assert({
  actual: new Headers({}),
  expect: new Headers({
    "set-cookie": "a=1;",
  }),
});
```

![img](set_cookie_removed/set_cookie_removed_throw.svg)

## cookie added

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

![img](cookie_added/cookie_added_throw.svg)

## cookie removed

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

![img](cookie_removed/cookie_removed_throw.svg)

## cookie order modified

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

![img](cookie_order_modified/cookie_order_modified_throw.svg)

## cookie name used several times

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

![img](cookie_name_used_several_times/cookie_name_used_several_times_throw.svg)

## cookie becomes secure

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

![img](cookie_becomes_secure/cookie_becomes_secure_throw.svg)

## accept

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

![img](accept/accept_throw.svg)

## accept diff on non standard attribute

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

![img](accept_diff_on_non_standard_attribute/accept_diff_on_non_standard_attribute_throw.svg)

## add accepted encoding

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

![img](add_accepted_encoding/add_accepted_encoding_throw.svg)

## remove accepted encoding

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

![img](remove_accepted_encoding/remove_accepted_encoding_throw.svg)

## accept-encoding diff on q

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

![img](accept-encoding_diff_on_q/accept-encoding_diff_on_q_throw.svg)

## accept-language

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

![img](accept-language/accept-language_throw.svg)

## add metric in server timing

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

![img](add_metric_in_server_timing/add_metric_in_server_timing_throw.svg)

## remove metric in server timing

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

![img](remove_metric_in_server_timing/remove_metric_in_server_timing_throw.svg)

## add description to a metric

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

![img](add_description_to_a_metric/add_description_to_a_metric_throw.svg)

## content length diff

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

![img](content_length_diff/content_length_diff_throw.svg)