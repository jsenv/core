# [2_renaming_into_array](../../sigi.test.mjs#L33)

```js
const state = signal([{ name: "a" }, { name: "b" }]);
const currentItemSignal = signal({ name: "a" });
const values = [];
effect(() => {
  const currentItem = currentItemSignal.value;
  for (const item of state) {
    if (item.name === currentItem.name) {
      const prev = sigi.prev(item);
      if (prev.value.name !== item.name) {
        values.push(`renamed from: ${prev.value.name}, to: ${item.name}`);
      }
    }
  }
});
state[0].name = "a_renamed";
return values;
```

```console
TypeError: state is not iterable
  at p.<anonymous> (base/sigi.test.mjs:39:26)
  at base/sigi.test.mjs:37:5
  at async base/sigi.test.mjs:5:1
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
