# [enumerable and value diff](../../property_descriptor.test.js#L64)

```js
const actual = {};
const expect = {};
Object.defineProperty(actual, "a", {
  enumerable: false,
  value: "a",
});
Object.defineProperty(expect, "a", {
  enumerable: true,
  value: "b",
});
assert({
  actual,
  expect,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: {
  a: "a",
  enumerable a: false,
}
expect: {
  a: "b",
}
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
