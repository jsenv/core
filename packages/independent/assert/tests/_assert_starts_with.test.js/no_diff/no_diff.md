# [no diff](../../assert_starts_with.test.js#L5)

```js
assert({
  actual: {
    a: "AABB",
    b: true,
  },
  expect: {
    a: assert.startsWith("AAB"),
    b: false,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: "AABB",
  b: true,
}
expect: {
  a: assert.startsWith("AAB"),
  b: false,
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>