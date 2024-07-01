# request with custom options

```js
assert({
  actual: new Request("http://example.com", {
    cache: "default",
    credentials: "same-origin",
    destination: "",
    method: "PUT",
    mode: "cors",
    priority: "auto",
    redirect: "follow",
    referrerPolicy: "",
    referrer: "about:client",
  }),
  expect: new Request("http://example.com", {
    body: '{"foo": "bar"}',
    cache: "no-store",
    credentials: "omit",
    destination: "document",
    headers: { from: "developer@example.org" },
    method: "POST",
    mode: "same-origin",
    priority: "high",
    redirect: "manual",
    referrerPolicy: "strict-origin",
    referrer: "http://google.com",
  }),
  MAX_CONTEXT_AFTER_DIFF: 8,
  MAX_CONTEXT_BEFORE_DIFF: 8,
  MAX_DEPTH_INSIDE_DIFF: 5,
});
```

![img](<./fetch/request with custom options.svg>)

