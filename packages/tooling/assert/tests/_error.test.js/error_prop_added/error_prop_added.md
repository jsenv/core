# [error prop added](../../error.test.js#L43)

```js
assert({
  actual: Object.assign(new Error("message"), { a: true }),
  expect: new Error("message"),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: Error: message {
  a: true,
}
expect: Error: message
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
