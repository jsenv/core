# [buffer.from("") vs buffer.from("a")](../../array_typed.test.js#L5)

```js
assert({
  actual: Buffer.from(""),
  expect: Buffer.from("a"),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: Buffer []
expect: Buffer [
  97,
]
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
