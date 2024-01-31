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

