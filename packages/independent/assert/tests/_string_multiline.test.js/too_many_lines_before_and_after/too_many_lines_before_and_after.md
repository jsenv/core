# [too many lines before and after](../../string_multiline.test.js#L61)

```js
assert({
  actual: `one
two
three
four/true
five
six
seven/0`,
  expect: `one
two
three
four/false
five
six
seven/1`,
  MAX_CONTEXT_BEFORE_DIFF: 2,
  MAX_CONTEXT_AFTER_DIFF: 2,
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: ↑ 2 lines ↑
        3| three
        4| four/true
        5| five
        ↓ 2 lines ↓
expect: ↑ 2 lines ↑
        3| three
        4| four/false
        5| five
        ↓ 2 lines ↓
```

</details>

---
<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>