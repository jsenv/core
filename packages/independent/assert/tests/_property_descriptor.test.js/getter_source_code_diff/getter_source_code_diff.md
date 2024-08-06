# [getter source code diff](../../property_descriptor.test.js#L145)

```js
assert({
  actual: {
    get a() {
      return false;
    },
  },
  expect: {
    get a() {
      return true;
    },
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  get a() {
    [source code],
  },
}
expect: {
  get a() {
    [source code],
  },
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>