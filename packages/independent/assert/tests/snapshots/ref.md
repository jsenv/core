# true should be object using ref

```js
const item = { id: "a" };
assert({
  actual: true,
  expected: { foo: item, bar: item },
});
```

![img](<./ref/true should be object using ref.svg>)

