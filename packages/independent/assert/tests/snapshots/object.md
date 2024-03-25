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

# false should be an object

```js
assert({
  actual: false,
  expected: { foo: true },
});
```

![img](<./object/false should be an object.svg>)

# object should be false

```js
assert({
  actual: {
    foo: {
      a: {},
    },
  },
  expected: false,
});
```

![img](<./object/object should be false.svg>)

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

# object should be false at property

```js
assert({
  actual: {
    foo: { a: true },
  },
  expected: {
    foo: false,
  },
});
```

![img](<./object/object should be false at property.svg>)

# object should be false at deep property truncated

```js
assert({
  actual: {
    the: { nesting: { is: {} } },
    toto: "actual",
  },
  expected: false,
  maxDepth: 0,
});
```

![img](<./object/object should be false at deep property truncated.svg>)

# object should be false at deep property

```js
assert({
  actual: {
    the: {
      nesting: {
        is: {
          very: {
            deep: {
              in: {
                this: {
                  one: {
                    foo: {
                      a: true,
                      tata: { test: true, bar: { a: "1" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    toto: "actual",
  },
  expected: {
    the: {
      nesting: {
        is: {
          very: {
            deep: {
              in: {
                this: {
                  one: {
                    foo: false,
                  },
                },
              },
            },
          },
        },
      },
    },
    toto: "expected",
  },
  maxDepth: 5,
});
```

![img](<./object/object should be false at deep property.svg>)

