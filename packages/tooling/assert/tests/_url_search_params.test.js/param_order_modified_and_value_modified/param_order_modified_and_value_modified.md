# [param order modified and value modified](../../url_search_params.test.js#L41)

```js
assert({
  actual: new URLSearchParams("foo=a&bar=a"),
  expect: new URLSearchParams("bar=b&foo=b"),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: URLSearchParams(
  "foo" => [
    "a",
  ],
  "bar" => [
    "a",
  ],
)
expect: URLSearchParams(
  "bar" => [
    "b",
  ],
  "foo" => [
    "b",
  ],
)
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
