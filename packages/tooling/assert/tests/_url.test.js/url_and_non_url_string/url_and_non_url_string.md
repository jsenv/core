# [url and non url string](../../url.test.js#L133)

```js
assert({
  actual: new URL("http://example.com"),
  expect: "totoabcexample.com",
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: URL("http://example.com/")
expect: "totoabcexample.com"
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
