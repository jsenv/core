# [array subclass](../../array.test.js#L167)

```js
class MyArray extends Array {}
assert({
  actual: [true],
  expect: new MyArray(true),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: [true]
expect: MyArray [true]
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
