# works

```js
assert({
  actual: {
    a: "expired 3 seconds ago",
    b: true,
  },
  expect: {
    a: assert.matches(/expired \d seconds ago/),
    b: false,
  },
});
```

![img](<./assert_matches/works.svg>)

# does not

```js
assert({
  actual: "expired n seconds ago",
  expect: assert.matches(/expired \d seconds ago/),
});
```

![img](<./assert_matches/does not.svg>)

