# frozen vs not frozen

```js
assert({
  actual: Object.freeze({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/frozen_vs_not_frozen.svg>)

# not frozen vs frozen

```js
assert({
  actual: { a: true },
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/not_frozen_vs_frozen.svg>)

# sealed vs not sealed

```js
assert({
  actual: Object.seal({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/sealed_vs_not_sealed.svg>)

# not sealed vs sealed

```js
assert({
  actual: { a: true },
  expect: Object.seal({ a: true }),
});
```

![img](<./object_integrity/not_sealed_vs_sealed.svg>)

# frozen vs sealed

```js
assert({
  actual: Object.freeze({ a: true }),
  expect: Object.seal({ a: true }),
});
```

![img](<./object_integrity/frozen_vs_sealed.svg>)

# sealed vs frozen

```js
assert({
  actual: Object.seal({ a: true }),
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/sealed_vs_frozen.svg>)

# extensible vs non extensible

```js
assert({
  actual: { a: true },
  expect: Object.preventExtensions({ a: true }),
});
```

![img](<./object_integrity/extensible_vs_non_extensible.svg>)

# non extensible vs extensible

```js
assert({
  actual: Object.preventExtensions({ a: true }),
  expect: { a: true },
});
```

![img](<./object_integrity/non_extensible_vs_extensible.svg>)

# sealed vs non extensible

```js
assert({
  actual: Object.seal({ a: true }),
  expect: Object.preventExtensions({ a: true }),
});
```

![img](<./object_integrity/sealed_vs_non_extensible.svg>)

# non extensible vs frozen

```js
assert({
  actual: Object.preventExtensions({ a: true }),
  expect: Object.freeze({ a: true }),
});
```

![img](<./object_integrity/non_extensible_vs_frozen.svg>)

# frozen array vs frozen function

```js
assert({
  actual: Object.freeze(["a"]),
  expect: Object.freeze(() => {}),
});
```

![img](<./object_integrity/frozen_array_vs_frozen_function.svg>)

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

![img](<./object_integrity/both_sealed__diff_is_elsewhere.svg>)

