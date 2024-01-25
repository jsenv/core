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
                      toto: { test: true },
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

