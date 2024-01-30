# false should be an object at property

```js
assert({
  actual: {
    foo: false,
  },
  expected: {
    foo: { a: true },
  },
});
```

![img](<./object/false should be an object at property.svg>)

