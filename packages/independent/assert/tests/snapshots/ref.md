# true should be object using ref

```js
const item = { id: "a" };
assert({
  actual: true,
  expect: {
    foo: item,
    bar: item,
  },
});
```

![img](<./ref/true should be object using ref.svg>)

