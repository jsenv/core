# diff very deep

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
                    foo: true,
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
});
```

![img](<./assert/diff very deep.svg>)

