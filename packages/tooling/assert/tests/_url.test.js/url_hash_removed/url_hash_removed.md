# [url hash removed](../../url.test.js#L115)

```js
assert({
  actual: new URL("http://example.com"),
  expect: new URL("http://example.com#bar"),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: URL("http://example.com/")
expect: URL("http://example.com/#bar")
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
