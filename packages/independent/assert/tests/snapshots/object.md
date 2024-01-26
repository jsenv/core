# false should be an object

```js
assert({
  actual: false,
  expected: { foo: true },
});
```

![img](<./object/false should be an object.svg>)

# two properties are different

```js
assert({
  actual: { a: true, b: true },
  expected: { a: false, b: false },
});
```

![img](<./object/two properties are different.svg>)

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
    the: {
      nesting: {
        is: {},
      },
    },
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
                      toto: { test: true, bar: { a: "1" } },
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

# maxDepth on diff

```js
assert({
  actual: {
    foo: {
      a: { b: { c: { d: { e: { f: {} } } } } },
    },
  },
  expected: {
    foo: {
      a: true,
    },
  },
  maxDepth: 5,
});
```

![img](<./object/maxDepth on diff.svg>)

# collapsed when no diff

```js
assert({
  actual: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: true,
  },
  expected: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: false,
  },
});
```

![img](<./object/collapsed when no diff.svg>)

