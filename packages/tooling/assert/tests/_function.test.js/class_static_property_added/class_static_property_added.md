# [class static property added](../../function.test.js#L181)

```js
assert({
  actual: class A {
    static a = true;
  },
  expect: class A {},
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: class A {
  [source code];
  static a = true;
}
expect: class A {
  [source code];
}
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
