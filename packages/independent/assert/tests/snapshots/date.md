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

