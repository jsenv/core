# [buffer vs array](../../array_typed.test.js#L59)

```js
assert({
  actual: {
    a: Buffer.from("a"),
    b: Buffer.from("a"),
  },
  expect: {
    a: [97],
    b: [61],
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: Buffer [97],
  b: Buffer [
    97,
  ],
}
expect: {
  a: [97],
  b: [
    61,
  ],
}
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
