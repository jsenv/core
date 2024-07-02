# abort signal pending vs aborted

```js
const expectAbortController = new AbortController();
expectAbortController.abort("toto");
assert({
  actual: new AbortController().signal,
  expect: expectAbortController.signal,
});
```

![img](<./fetch/abort_signal_pending_vs_aborted.svg>)

# request url diff

```js
assert({
  actual: new Request("https://foo.com"),
  expect: new Request("https://bar.com"),
});
```

![img](<./fetch/request_url_diff.svg>)

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

![img](<./fetch/request_with_custom_options.svg>)

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

![img](<./fetch/request_abort_signal_pending_vs_aborted.svg>)

# response body diff

```js
assert({
  actual: {
    a: new Response("foo"),
    b: true,
  },
  expect: {
    a: new Response("bar"),
    b: false,
  },
});
```

![img](<./fetch/response_body_diff.svg>)

# response status diff

```js
assert({
  actual: new Response("", {
    status: 200,
  }),
  expect: new Response("", {
    status: 400,
  }),
});
```

![img](<./fetch/response_status_diff.svg>)

# response prop diff

```js
assert({
  actual: new Response("", {
    status: 200,
    statusText: "",
    type: "basic",
  }),
  expect: new Response("", {
    status: 400,
    statusText: "Bad request",
    headers: {
      "content-length": "0",
    },
    type: "opaque",
  }),
  MAX_CONTEXT_BEFORE_DIFF: 8,
  MAX_CONTEXT_AFTER_DIFF: 8,
});
```

![img](<./fetch/response_prop_diff.svg>)

# redirected response

```js
assert({
  actual: new Response("", { status: 200 }),
  expect: Response.redirect("http://example.com"),
});
```

![img](<./fetch/redirected_response.svg>)

