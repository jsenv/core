# [not sealed vs sealed](../../object_integrity.test.js#L28)

```js
assert({
  actual: { a: true },
  expect: Object.seal({ a: true }),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: { a: true }
expect: Object.seal({ a: true })
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>