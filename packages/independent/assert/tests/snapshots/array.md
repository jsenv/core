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

