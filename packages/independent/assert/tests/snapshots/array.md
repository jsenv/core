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

