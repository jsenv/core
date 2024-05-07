# "0" and 70/01/01

```js
assert({
  actual: "0",
  expect: "70/01/01",
});
```

![img](<./date/"0" and 70/01/01.svg>)

# year month day minutes diff on iso UTC

```js
assert({
  actual: "1970-01-01 00:00:00.000Z",
  expect: "1995-12-04 00:12:00.000Z",
});
```

![img](<./date/year month day minutes diff on iso UTC.svg>)

# millisecond only diff on iso UTC

```js
assert({
  actual: "1970-01-01 00:00:00.000Z",
  expect: "1970-01-01 00:00:00.020Z",
});
```

![img](<./date/millisecond only diff on iso UTC.svg>)

