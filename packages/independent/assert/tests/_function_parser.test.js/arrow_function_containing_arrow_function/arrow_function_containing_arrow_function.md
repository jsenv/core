# [arrow function containing arrow function](../../function_parser.test.js#L10)

```js
generateFunctionBody(() => {
  const a = () => {};
  a();
})
```

```js
const a = () => {};
a();
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>
