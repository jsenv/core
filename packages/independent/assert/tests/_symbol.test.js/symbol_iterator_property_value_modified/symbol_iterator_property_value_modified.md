# [Symbol.iterator property value modified](../../symbol.test.js#L75)

```js
assert({
  actual: {
    [Symbol.iterator]: true,
  },
  expect: {
    [Symbol.iterator]: false,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  Symbol.iterator: true,
}
expect: {
  Symbol.iterator: false,
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>