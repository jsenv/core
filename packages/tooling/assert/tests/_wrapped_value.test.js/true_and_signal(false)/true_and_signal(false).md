# [true and signal(false)](../../wrapped_value.test.js#L168)

```js
assert({
  actual: true,
  expect: {
    [Symbol.toStringTag]: "Signal",
    valueOf: () => false,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: true
expect: Signal(false)
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
