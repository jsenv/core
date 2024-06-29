# enumerable and configurable and value diff

```js
assert({
  actual: Object.defineProperty({}, "a", {
    enumerable: true,
    configurable: true,
    value: "a",
  }),
  expect: Object.defineProperty({}, "a", {
    enumerable: false,
    configurable: false,
    value: "b",
  }),
});
```

![img](<./property_descriptor/enumerable and configurable and value diff.svg>)

# non enumerable hidden when value same

```js
assert({
  actual: Object.defineProperty({ a: true }, "b", {
    enumerable: false,
    value: "b",
  }),
  expect: Object.defineProperty({ a: false }, "b", {
    enumerable: false,
    value: "b",
  }),
});
```

![img](<./property_descriptor/non enumerable hidden when value same.svg>)

# non enumerable displayed when value modified

```js
const actual = {};
const expect = {};
Object.defineProperty(actual, "b", {
  enumerable: false,
  value: "b",
});
Object.defineProperty(expect, "b", {
  enumerable: false,
  value: "c",
});
assert({
  actual,
  expect,
});
```

![img](<./property_descriptor/non enumerable displayed when value modified.svg>)

# enumerable diff

```js
const actual = {};
const expect = {};
Object.defineProperty(actual, "a", {
  enumerable: true,
  value: "a",
});
Object.defineProperty(expect, "a", {
  enumerable: false,
  value: "a",
});
assert({
  actual,
  expect,
});
```

![img](<./property_descriptor/enumerable diff.svg>)

# enumerable and value diff

```js
const actual = {};
const expect = {};
Object.defineProperty(actual, "a", {
  enumerable: false,
  value: "a",
});
Object.defineProperty(expect, "a", {
  enumerable: true,
  value: "b",
});
assert({
  actual,
  expect,
});
```

![img](<./property_descriptor/enumerable and value diff.svg>)

# getter and value

```js
assert({
  actual: {
    get a() {
      return true;
    },
  },
  expect: {
    a: true,
  },
});
```

![img](<./property_descriptor/getter and value.svg>)

# getter/setter and value

```js
assert({
  actual: {
    get a() {
      return true;
    },
    set a(v) {},
  },
  expect: {
    a: true,
  },
});
```

![img](<./property_descriptor/getter/setter and value.svg>)

# getter only and setter only

```js
assert({
  actual: {
    get a() {
      return true;
    },
  },
  expect: {
    set a(v) {},
  },
});
```

![img](<./property_descriptor/getter only and setter only.svg>)

# setter only and getter only

```js
assert({
  actual: {
    set a(v) {},
  },
  expect: {
    get a() {
      return true;
    },
  },
});
```

![img](<./property_descriptor/setter only and getter only.svg>)

# getter source code same

```js
assert({
  actual: {
    get a() {
      return true;
    },
    b: true,
  },
  expect: {
    get a() {
      return true;
    },
    b: false,
  },
});
```

![img](<./property_descriptor/getter source code same.svg>)

# getter source code diff

```js
assert({
  actual: {
    get a() {
      return false;
    },
  },
  expect: {
    get a() {
      return true;
    },
  },
});
```

![img](<./property_descriptor/getter source code diff.svg>)

