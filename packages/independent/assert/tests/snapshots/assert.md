# ref_twice_in_object_becomes_true

```js
const item = { id: "a" };
assert({
  actual: true,
  expected: { foo: item, bar: item },
});
```

![img](./assert/ref_twice_in_object_becomes_true.svg)

