# object expected, array received

```js
assert({
  actual: [],
  expected: {},
});
```

![img](<./array/object expected, array received.svg>)

# array expected, object received

```js
assert({
  actual: {},
  expected: [],
});
```

![img](<./array/array expected, object received.svg>)

# false should be an array

```js
assert({
  actual: false,
  expected: [],
});
```

![img](<./array/false should be an array.svg>)

# associative array expected, object received

```js
const array = [];
array.foo = true;
assert({
  actual: array,
  expected: {
    foo: true,
  },
});
```

![img](<./array/associative array expected, object received.svg>)

# diff on associate array.foo and object.foo

```js
const array = [];
array.foo = true;
assert({
  actual: array,
  expected: {
    foo: false,
  },
});
```

![img](<./array/diff on associate array.foo and object.foo.svg>)

# diff on associate array deep property and object deep property

```js
const array = [];
array.user = {
  name: "bob",
};
assert({
  actual: array,
  expected: {
    user: {
      name: "alice",
    },
  },
});
```

![img](<./array/diff on associate array deep property and object deep property.svg>)

