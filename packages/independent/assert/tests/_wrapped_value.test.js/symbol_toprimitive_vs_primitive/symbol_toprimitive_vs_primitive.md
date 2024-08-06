# [Symbol.toPrimitive vs primitive](../../wrapped_value.test.js#L25)

```js
assert({
  actual: {
    [Symbol.toPrimitive]: () => {
      return 10;
    },
  },
  expect: 10,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  [Symbol.toPrimitive()]: 10,
}
expect: 10
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>