# non enumerable hidden when value same

```js
const actual = { a: true };
const expected = { a: false };
Object.defineProperty(actual, "b", {
  enumerable: false,
  value: "b",
});
Object.defineProperty(expected, "b", {
  enumerable: false,
  value: "b",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/non enumerable hidden when value same.svg>)

# non enumerable displayed when value modified

```js
const actual = {};
const expected = {};
Object.defineProperty(actual, "b", {
  enumerable: false,
  value: "b",
});
Object.defineProperty(expected, "b", {
  enumerable: false,
  value: "c",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/non enumerable displayed when value modified.svg>)

# enumerable diff

```js
const actual = {};
const expected = {};
Object.defineProperty(actual, "a", {
  enumerable: true,
  value: "a",
});
Object.defineProperty(expected, "a", {
  enumerable: false,
  value: "a",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/enumerable diff.svg>)

# enumerable and value diff

```js
const actual = {};
const expected = {};
Object.defineProperty(actual, "a", {
  enumerable: false,
  value: "a",
});
Object.defineProperty(expected, "a", {
  enumerable: true,
  value: "b",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/enumerable and value diff.svg>)

# enumerable and configurable and value diff

```js
const actual = {};
const expected = {};
Object.defineProperty(actual, "a", {
  enumerable: true,
  configurable: true,
  value: "a",
});
Object.defineProperty(expected, "a", {
  enumerable: false,
  configurable: false,
  value: "b",
});
assert({
  actual,
  expected,
});
```

![img](<./property_descriptor/enumerable and configurable and value diff.svg>)

# getter and value

```js
assert({
  actual: {
    get a() {
      return true;
    },
  },
  expected: {
    a: true,
  },
});
```

![img](<./property_descriptor/getter and value.svg>)

