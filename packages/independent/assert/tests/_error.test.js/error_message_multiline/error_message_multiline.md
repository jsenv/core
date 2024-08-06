# [error message multiline](../../error.test.js#L35)

```js
assert({
  actual: new Error(`Hello
world`),
  expect: new Error(`Hello
france`),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: Error: Hello
world
expect: Error: Hello
france
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>