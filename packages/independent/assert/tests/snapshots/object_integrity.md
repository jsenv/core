# frozen vs not frozen

```js
assert({
  actual: Object.freeze({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/frozen vs not frozen.svg>)

# not frozen vs frozen

```js
assert({
  actual: { a: true },
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/not frozen vs frozen.svg>)

# sealed vs not sealed

```js
assert({
  actual: Object.seal({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/sealed vs not sealed.svg>)

# not sealed vs sealed

```js
assert({
  actual: { a: true },
  expect: Object.seal({ a: true }),
});
```

![img](<./object_integrity/not sealed vs sealed.svg>)

# frozen vs sealed

```js
assert({
  actual: Object.freeze({ a: true }),
  expect: Object.seal({ a: true }),
});
```

![img](<./object_integrity/frozen vs sealed.svg>)

# sealed vs frozen

```js
assert({
  actual: Object.seal({ a: true }),
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/sealed vs frozen.svg>)

# extensible vs non extensible

```js
assert({
  actual: { a: true },
  expect: Object.preventExtensions({ a: true }),
});
```

![img](<./object_integrity/extensible vs non extensible.svg>)

# non extensible vs extensible

```js
assert({
  actual: Object.preventExtensions({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/non extensible vs extensible.svg>)

# sealed vs non extensible

```js
assert({
  actual: Object.seal({ a: true }),
  expect: Object.preventExtensions({ a: true }),
});
```

![img](<./object_integrity/sealed vs non extensible.svg>)

# non extensible vs frozen

```js
assert({
  actual: Object.preventExtensions({ a: true }),
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/non extensible vs frozen.svg>)

# frozen array vs frozen function

```js
assert({
  actual: Object.freeze(["a"]),
  expect: Object.freeze(() => {}),
});
```

![img](<./object_integrity/frozen array vs frozen function.svg>)

# both sealed, diff is elsewhere

```js
assert({
  actual: {
    a: Object.freeze({ a: true }),
    b: true,
  },
  expect: {
    a: Object.freeze({ a: true }),
    b: false,
  },
});
```

![img](<./object_integrity/both sealed, diff is elsewhere.svg>)

