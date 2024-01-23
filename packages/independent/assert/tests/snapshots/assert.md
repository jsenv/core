# false_becomes_true

```js
assert({
  actual: true,
  expected: false,
});
```

![img](./assert/false_becomes_true.svg)

# object_becomes_false

```js
assert({
  actual: false,
  expected: { foo: true },
});
```

![img](./assert/object_becomes_false.svg)

# nested_object_becomes_false

```js
assert({
  actual: false,
  expected: { a: true, b: { toto: true }, c: true },
});
```

![img](./assert/nested_object_becomes_false.svg)

# diff_solo_property_value

```js
assert({
  actual: { foo: true },
  expected: { foo: false },
});
```

![img](./assert/diff_solo_property_value.svg)

# diff_second_and_last_property_value

```js
assert({
  actual: { foo: true, bar: false },
  expected: { foo: true, bar: true },
});
```

![img](./assert/diff_second_and_last_property_value.svg)

# diff_second_property_value

```js
assert({
  actual: { a: true, b: true, c: true },
  expected: { a: true, b: false, c: true },
});
```

![img](./assert/diff_second_property_value.svg)

# diff_property_value_nested

```js
assert({
  actual: { user: { name: "dam" } },
  expected: { user: { name: "osc" } },
});
```

![img](./assert/diff_property_value_nested.svg)

