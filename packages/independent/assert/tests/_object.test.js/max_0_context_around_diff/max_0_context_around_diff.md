# [max 0 context around diff](../../object.test.js#L322)

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
  },
  expect: {
    c: true,
    b: false,
    a: true,
  },
  MAX_CONTEXT_BEFORE_DIFF: 0,
  MAX_CONTEXT_AFTER_DIFF: 0,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  ↑ 1 prop ↑
  b: true,
  ↓ 1 prop ↓
}
expect: {
  ↑ 1 prop ↑
  b: false,
  ↓ 1 prop ↓
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>