# [exactly on line break](../../string_multiline.test.js#L170)

```js
assert({
  actual: `abc`,
  expect: `ab\nc`,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: 1| abc
expect: 1| ab
        2| c
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
