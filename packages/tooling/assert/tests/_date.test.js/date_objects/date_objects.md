# [date objects](../../date.test.js#L70)

```js
assert({
  actual: new Date("1970-01-01 10:00:00Z"),
  expect: new Date("1970-01-01 8:00:00Z"),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: Date("1970-01-01 10:00:00Z")
expect: Date("1970-01-01 08:00:00Z")
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
