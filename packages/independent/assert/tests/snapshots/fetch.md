# abort signal pending vs aborted

```js
const expectAbortController = new AbortController();
expectAbortController.abort("toto");
assert({
  actual: new AbortController().signal,
  expect: expectAbortController.signal,
});
```

![img](<./fetch/abort signal pending vs aborted.svg>)

# Request url diff

```js
assert({
  actual: new Request("https://foo.com"),
  expect: new Request("https://bar.com"),
});
```

![img](<./fetch/Request url diff.svg>)

# request with custom options

```js
assert({
  actual: new Request("http://example.com", {
    cache: "default",
    credentials: "same-origin",
    destination: "",
    method: "GET",
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
  MAX_CONTEXT_AFTER_DIFF: 10,
  MAX_CONTEXT_BEFORE_DIFF: 10,
  MAX_DEPTH_INSIDE_DIFF: 5,
});
```

![img](<./fetch/request with custom options.svg>)

# request abort signal pending vs aborted

```js
const expectAbortController = new AbortController();
expectAbortController.abort("toto");
assert({
  actual: new Request("http://example.com", {
    signal: new AbortController().signal,
  }),
  expect: new Request("http://example.com", {
    signal: expectAbortController.signal,
  }),
});
```

![img](<./fetch/request abort signal pending vs aborted.svg>)

