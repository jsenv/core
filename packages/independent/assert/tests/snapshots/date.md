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

# +2 hour on timezone

```js
assert({
  actual: "1970-01-01 10:00:00+03:00",
  expect: "1970-01-01 10:00:00+01:00",
});
```

![img](<./date/+2 hour on timezone.svg>)

# -2 hour on timezone

```js
assert({
  actual: "1970-01-01 10:00:00-03:00",
  expect: "1970-01-01 10:00:00-01:00",
});
```

![img](<./date/-2 hour on timezone.svg>)

# +1h30 on timezone

```js
assert({
  actual: "1970-01-01 10:00:00+01:30",
  expect: "1970-01-01 10:00:00+00:00",
});
```

![img](<./date/+1h30 on timezone.svg>)

# -1h30 on timezone

```js
assert({
  actual: "1970-01-01 10:00:00-01:30",
  expect: "1970-01-01 10:00:00+00:00",
});
```

![img](<./date/-1h30 on timezone.svg>)

# +0h30 on timezone

```js
assert({
  actual: "1970-01-01 10:00:00+00:30",
  expect: "1970-01-01 10:00:00+00:00",
});
```

![img](<./date/+0h30 on timezone.svg>)

# GMT vs iso

```js
assert({
  actual:
    "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
  expect: "1970-01-01 00:00:00Z",
});
```

![img](<./date/GMT vs iso.svg>)

# simplified date

```js
assert({
  actual: "1970-01-01 10:00:00",
  expect: "1970-01-01 10:00:00Z",
});
```

![img](<./date/simplified date.svg>)

# incorrect date string

```js
assert({
  actual: "0",
  expect: "70/01/01",
});
```

![img](<./date/incorrect date string.svg>)

