# [accept diff on non standard attribute](../../headers.test.js#L136)

```js
assert({
  actual: new Headers({
    accept: "text/html; a=1; b=2",
  }),
  expect: new Headers({
    accept: "text/html; a=9; b=9",
  }),
});
```

![img](throw.svg)

<details>
  <summary>see without style</summary>

```console
AssertionError: actual and expect are different

actual: Headers(
  "accept" => "text/html; a=1; b=2"
)
expect: Headers(
  "accept" => "text/html; a=9; b=9"
)
```

</details>


---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
