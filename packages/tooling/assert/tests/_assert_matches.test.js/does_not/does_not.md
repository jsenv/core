# [does not](../../assert_matches.test.js#L17)

```js
assert({
  actual: "expired n seconds ago",
  expect: assert.matches(/expired \d seconds ago/),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: "expired n seconds ago"
expect: assert.matches(/expired \d seconds ago/)
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
