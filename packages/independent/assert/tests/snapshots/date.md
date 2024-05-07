# year month day minutes diff on iso

```js
assert({
  actual: "1970-01-01 00:00:00.000Z",
  expect: "1995-12-04 00:12:00.000Z",
});
```

![img](<./date/year month day minutes diff on iso.svg>)

# millisecond only diff on iso

```js
assert({
  actual: "1970-01-01 00:00:00.000Z",
  expect: "1970-01-01 00:00:00.020Z",
});
```

![img](<./date/millisecond only diff on iso.svg>)

# same hour but diff timezone

```js
assert({
  actual: "1970-01-01 10:00:00+01:00",
  expect: "1970-01-01 10:00:00+00:00",
});
```

![img](<./date/same hour but diff timezone.svg>)

