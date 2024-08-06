# [anonymous Symbol() property value modified](../../symbol.test.js#L65)

```js
assert({
  actual: {
    [Symbol()]: true,
  },
  expect: {
    [Symbol()]: false,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  Symbol(): true,
}
expect: {
  Symbol(): false,
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>