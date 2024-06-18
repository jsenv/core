# add empty line

```js
assert({
  actual: `\n`,
  expect: ``,
});
```

![img](<./string_multline/add empty line.svg>)

# remove empty line

```js
assert({
  actual: ``,
  expect: `\n`,
});
```

![img](<./string_multline/remove empty line.svg>)

