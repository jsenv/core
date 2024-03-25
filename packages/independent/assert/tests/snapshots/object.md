# property are different

```js
assert({
  actual: {
    a: true,
  },
  expected: {
    a: {
      b: true,
    },
  },
});
```

![img](<./object/property are different.svg>)

# property should be there

```js
assert({
  actual: {
    a: true,
  },
  expected: {
    a: true,
    should_be_there: true,
  },
});
```

![img](<./object/property should be there.svg>)

# property should not be there

```js
assert({
  actual: {
    a: true,
    should_not_be_there: true,
  },
  expected: {
    a: true,
  },
});
```

![img](<./object/property should not be there.svg>)

