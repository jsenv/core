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

# same ref to self

```js
const actual = {
  a: true,
};
actual.self = actual;
const expect = {
  a: false,
};
expect.self = expect;
assert({
  actual,
  expect,
});
```

![img](<./ref/same ref to self.svg>)

