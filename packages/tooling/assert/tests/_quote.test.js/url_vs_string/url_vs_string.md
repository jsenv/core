# [url vs string](../../quote.test.js#L94)

```js
assert({
  actual: "http://example.com",
  expect: `test"quotes`,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: "http://example.com"
expect: 'test"quotes'
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
