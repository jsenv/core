# [arrow function source same, name same](../../function.test.js#L264)

```js
const fn = () => {};
assert({
  actual: {
    a: fn,
    b: true,
  },
  expect: {
    a: fn,
    b: false,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: () => { [source code] },
  b: true,
}
expect: {
  a: () => { [source code] },
  b: false,
}
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>