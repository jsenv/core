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
  actual: {
    a: true,
    b: true,
  },
  expected: {
    a: false,
    b: false,
  },
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

# max 2 props above prop diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expected: {
    a: true,
    b: true,
    c: true,
    d: false,
  },
});
```

![img](<./object/max 2 props above prop diff.svg>)

# max 2 props above prop diff and there is exactly 2

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expected: {
    a: true,
    b: true,
    c: false,
    d: true,
  },
});
```

![img](<./object/max 2 props above prop diff and there is exactly 2.svg>)

# max 2 props after prop diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expected: {
    a: false,
    b: true,
    c: true,
    d: true,
  },
});
```

![img](<./object/max 2 props after prop diff.svg>)

# max 2 props above after diff and there is exactly 2

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expected: {
    a: true,
    b: false,
    c: true,
    d: true,
  },
});
```

![img](<./object/max 2 props above after diff and there is exactly 2.svg>)

# max 2 props around prop diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
    e: true,
    f: true,
    g: true,
    h: true,
    i: true,
    j: true,
    k: true,
    l: true,
    m: true,
    n: true,
    o: true,
  },
  expected: {
    a: true,
    b: true,
    c: true,
    d: false,
    e: true,
    f: true,
    g: true,
    h: false,
    i: true,
    j: true,
    k: true,
    l: false,
    m: true,
    n: true,
    o: true,
  },
});
```

![img](<./object/max 2 props around prop diff.svg>)

# max X diff per object

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
  },
  expected: {
    a: false,
    b: false,
    c: false,
  },
  maxDiffPerObject: 2,
});
```

![img](<./object/max X diff per object.svg>)

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

