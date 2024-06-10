# reference removed

```js
const actual = {};
const expect = {
  self: null,
};
expect.self = expect;
assert({
  actual,
  expect,
});
```

![img](<./ref/reference removed.svg>)

# reference added

```js
const actual = {
  self: null,
};
actual.self = actual;
const expect = {};
assert({
  actual,
  expect,
});
```

![img](<./ref/reference added.svg>)

# same ref to self

```js
const actual = {
  a: true,
  self: null,
};
actual.self = actual;
const expect = {
  a: false,
  self: null,
};
expect.self = expect;
assert({
  actual,
  expect,
});
```

![img](<./ref/same ref to self.svg>)

# ref changed

```js
const actual = {
  object: {
    self: null,
  },
};
actual.object.self = actual;
const expect = {
  object: {
    self: null,
  },
};
expect.object.self = expect.object;
assert({ actual, expect });
```

![img](<./ref/ref changed.svg>)

# true should be a ref to self

```js
const actual = {
  self: true,
};
const expect = {
  self: null,
};
expect.self = expect;
assert({
  actual,
  expect,
});
```

![img](<./ref/true should be a ref to self.svg>)

# ref to self should be true

```js
const actual = {
  self: null,
};
actual.self = actual;
const expect = {
  self: true,
};
assert({
  actual,
  expect,
});
```

![img](<./ref/ref to self should be true.svg>)

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

