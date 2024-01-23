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

# false_becomes_true_at_solo_property_value

```js
assert({
  actual: { foo: true },
  expected: { foo: false },
});
```

![img](./assert/false_becomes_true_at_solo_property_value.svg)

# true_becomes_false_at_second_and_last_property_value

```js
assert({
  actual: { foo: true, bar: false },
  expected: { foo: true, bar: true },
});
```

![img](./assert/true_becomes_false_at_second_and_last_property_value.svg)

# false_becomes_true_at_second_property_value

```js
assert({
  actual: { a: true, b: true, c: true },
  expected: { a: true, b: false, c: true },
});
```

![img](./assert/false_becomes_true_at_second_property_value.svg)

# osc_becomes_dam_at_property_value_nested

```js
assert({
  actual: { user: { name: "dam" } },
  expected: { user: { name: "osc" } },
});
```

![img](./assert/osc_becomes_dam_at_property_value_nested.svg)

