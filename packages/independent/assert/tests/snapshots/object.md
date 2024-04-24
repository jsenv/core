# property are different

```js
assert({
  actual: {
    a: true,
  },
  expect: {
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
  expect: {
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
  expect: {
    a: true,
  },
});
```

![img](<./object/property should not be there.svg>)

# false should be an object

```js
assert({
  actual: false,
  expect: { foo: true },
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
  expect: false,
});
```

![img](<./object/object should be false.svg>)

# false should be an object at property

```js
assert({
  actual: {
    foo: false,
  },
  expect: {
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
  expect: {
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
  expect: false,
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
  expect: {
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
    toto: "expect",
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
  expect: {
    foo: {
      a: true,
    },
  },
  maxDepth: 5,
});
```

![img](<./object/maxDepth on diff.svg>)

# collapsed with overview when no diff

```js
assert({
  actual: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: true,
  },
  expect: {
    a: { foo: true, bar: true, baz: { t: 1 } },
    b: false,
  },
});
```

![img](<./object/collapsed with overview when no diff.svg>)

# max 2 props above prop diff

```js
assert({
  actual: {
    a: true,
    b: true,
    c: true,
    d: true,
  },
  expect: {
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
  expect: {
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
  expect: {
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
  expect: {
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
  expect: {
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
  expect: {
    a: false,
    b: false,
    c: false,
  },
  maxDiffPerObject: 2,
});
```

![img](<./object/max X diff per object.svg>)

# property should be there and is big

```js
assert({
  actual: {
    a: true,
  },
  expect: {
    a: true,
    should_be_there: {
      a: true,
      b: true,
      item: { a: 1, b: 1, c: 1 },
      c: true,
      d: true,
      e: true,
      f: true,
      g: true,
    },
  },
  maxColumns: 100,
});
```

![img](<./object/property should be there and is big.svg>)

# many props should not be there

```js
assert({
  actual: {
    a: true,
    b: true,
    c: { an_object: true, and: true },
    d: true,
    e: true,
    f: true,
    g: true,
    h: true,
  },
  expect: {
    a: true,
    c: {},
  },
});
```

![img](<./object/many props should not be there.svg>)

# max prop in diff

```js
assert({
  actual: {
    foo: {
      a: true,
      b: true,
      c: true,
      d: true,
      e: true,
    },
  },
  expect: {
    foo: false,
  },
  maxValueInsideDiff: 2,
});
```

![img](<./object/max prop in diff.svg>)

# props order

```js
assert({
  actual: {
    b: true,
    a: false,
  },
  expect: {
    a: true,
    b: false,
  },
});
```

![img](<./object/props order.svg>)

# property key truncated

```js
assert({
  actual: {
    "a quite long property key that will be truncated": true,
  },
  expect: {
    "a quite long property key that will be truncated": false,
  },
  maxColumns: 40,
});
```

![img](<./object/property key truncated.svg>)

# property key multiline

```js
assert({
  actual: {
    "first\nsecond that is quite long": true,
  },
  expect: {
    "first\nsecond that is quite long": false,
  },
  maxColumns: 30,
});
```

![img](<./object/property key multiline.svg>)

# nested object becomes false

```js
assert({
  actual: false,
  expect: {
    a: true,
    b: { toto: true },
    c: true,
  },
});
```

![img](<./object/nested object becomes false.svg>)

# osc becomes dam at property value nested

```js
assert({
  actual: {
    user: { name: "dam" },
  },
  expect: {
    user: { name: "osc" },
  },
});
```

![img](<./object/osc becomes dam at property value nested.svg>)

