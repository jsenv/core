# /a/ vs /b/

```js
assert({
  actual: /a/,
  expect: /b/,
});
```

![img](<./regexp//a/ vs /b/.svg>)

# i flag vs no flag

```js
assert({
  actual: /a/i,
  expect: /a/,
});
```

![img](<./regexp/i flag vs no flag.svg>)

# gi flag vs ig flag

```js
assert({
  actual: {
    a: /a/gi,
    b: true,
  },
  expect: {
    // prettier-ignore
    a: /a/ig,
    b: false,
  },
});
```

![img](<./regexp/gi flag vs ig flag.svg>)

