# property_descriptor.md

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../property_descriptor.test.js">../property_descriptor.test.js</a>
</sub>

## enumerable and configurable and value diff

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

```console
AssertionError: actual and expect are different

actual: {
  a: "a",
}
expect: {
  a: "b",
  enumerable a: false,
  configurable a: false,
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/enumerable_and_configurable_and_value_diff_throw.svg" alt="img" />

</details>


## non enumerable hidden when value same

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

```console
AssertionError: actual and expect are different

actual: {
  a: true,
  b: "b",
}
expect: {
  a: false,
  b: "b",
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/non_enumerable_hidden_when_value_same_throw.svg" alt="img" />

</details>


## non enumerable displayed when value modified

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

```console
AssertionError: actual and expect are different

actual: {
  b: "b",
}
expect: {
  b: "c",
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/non_enumerable_displayed_when_value_modified_throw.svg" alt="img" />

</details>


## enumerable diff

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

```console
AssertionError: actual and expect are different

actual: {
  a: "a",
}
expect: {
  a: "a",
  enumerable a: false,
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/enumerable_diff_throw.svg" alt="img" />

</details>


## enumerable and value diff

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

```console
AssertionError: actual and expect are different

actual: {
  a: "a",
  enumerable a: false,
}
expect: {
  a: "b",
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/enumerable_and_value_diff_throw.svg" alt="img" />

</details>


## getter and value

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

```console
AssertionError: actual and expect are different

actual: {
  get a() {
    [source code],
  },
}
expect: {
  a: true,
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/getter_and_value_throw.svg" alt="img" />

</details>


## getter/setter and value

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

```console
AssertionError: actual and expect are different

actual: {
  get a() {
    [source code],
  },
  set a() {
    [source code],
  },
}
expect: {
  a: true,
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/gettersetter_and_value_throw.svg" alt="img" />

</details>


## getter only and setter only

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

```console
AssertionError: actual and expect are different

actual: {
  get a() {
    [source code],
  },
}
expect: {
  set a() {
    [source code],
  },
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/getter_only_and_setter_only_throw.svg" alt="img" />

</details>


## setter only and getter only

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

```console
AssertionError: actual and expect are different

actual: {
  set a() {
    [source code],
  },
}
expect: {
  get a() {
    [source code],
  },
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/setter_only_and_getter_only_throw.svg" alt="img" />

</details>


## getter source code same

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

```console
AssertionError: actual and expect are different

actual: {
  get a() { [source code] },
  b: true,
}
expect: {
  get a() { [source code] },
  b: false,
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/getter_source_code_same_throw.svg" alt="img" />

</details>


## getter source code diff

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

```console
AssertionError: actual and expect are different

actual: {
  get a() {
    [source code],
  },
}
expect: {
  get a() {
    [source code],
  },
}
```

<details>
  <summary>see colored</summary>

  <img src="property_descriptor/getter_source_code_diff_throw.svg" alt="img" />

</details>