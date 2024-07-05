# error message added

```js
assert({
  actual: new Error("foo"),
  expect: new Error(),
});
```

![img](<./error/error_message_added.svg>)

# error message removed

```js
assert({
  actual: new Error(),
  expect: new Error("bar"),
});
```

![img](<./error/error_message_removed.svg>)

# error message modified

```js
assert({
  actual: new Error("foo"),
  expect: new Error("bar"),
});
```

![img](<./error/error_message_modified.svg>)

# error message vs object with message

```js
assert({
  actual: new Error("foo"),
  expect: { message: "foo" },
});
```

![img](<./error/error_message_vs_object_with_message.svg>)

# error stack vs object with stack

```js
assert({
  actual: new Error("message"),
  expect: { stack: "stack" },
});
```

![img](<./error/error_stack_vs_object_with_stack.svg>)

# error message multiline

```js
assert({
  actual: new Error(`Hello
world`),
  expect: new Error(`Hello
france`),
});
```

![img](<./error/error_message_multiline.svg>)

# error prop added

```js
assert({
  actual: Object.assign(new Error("message"), { a: true }),
  expect: new Error("message"),
});
```

![img](<./error/error_prop_added.svg>)

# error prop removed

```js
assert({
  actual: new Error("message"),
  expect: Object.assign(new Error("message"), { a: true }),
});
```

![img](<./error/error_prop_removed.svg>)

# error prop modified

```js
assert({
  actual: Object.assign(new Error("message"), { a: true }),
  expect: Object.assign(new Error("message"), { a: false }),
});
```

![img](<./error/error_prop_modified.svg>)

# error vs typeError

```js
assert({
  actual: new Error(),
  expect: new TypeError(),
});
```

![img](<./error/error_vs_typeerror.svg>)

# error vs CustomError

```js
class ValidationError extends Error {}
assert({
  actual: new Error(),
  expect: new ValidationError(),
});
```

![img](<./error/error_vs_customerror.svg>)

# actual message multiline, expect single

```js
assert({
  actual: new Error(`snapshot comparison failed for "my_snapshots/"
--- reason ---
"file.txt" directory entry is missing
--- missing entry ---
file:///Users/damien.maillard/dev/perso/jsenv-core/packages/related/test/tests/test_plan_execution/snapshot_comparison/node_client/my_snapshots/file.txt`),
  expect: new Error(`snapshot comparison failed for "my_snapshots/"`),
});
```

![img](<./error/actual_message_multiline__expect_single.svg>)

