# [own valueOf order respected](../../wrapped_value.test.js#L318)

```js
assert({
  actual: {
    a: true,
    valueOf: () => 0,
    b: true,
  },
  expect: {
    a: true,
    valueOf: () => 1,
    b: true,
  },
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: true,
  valueOf(): 0,
  b: true,
}
expect: {
  a: true,
  valueOf(): 1,
  b: true,
}
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
