# error message added

```js
assert({
  actual: new Error("foo"),
  expect: new Error(),
});
```

![img](<./error/error message added.svg>)

# error message removed

```js
assert({
  actual: new Error(),
  expect: new Error("bar"),
});
```

![img](<./error/error message removed.svg>)

# error message modified

```js
assert({
  actual: new Error("foo"),
  expect: new Error("bar"),
});
```

![img](<./error/error message modified.svg>)

# error message vs object with message

```js
assert({
  actual: new Error("foo"),
  expect: { message: "foo" },
});
```

![img](<./error/error message vs object with message.svg>)

# error stack vs object with stack

```js
assert({
  actual: new Error("message"),
  expect: { stack: "stack" },
});
```

![img](<./error/error stack vs object with stack.svg>)

# error message multiline

```js
assert({
  actual: new Error(`Hello
world`),
  expect: new Error(`Hello
france`),
});
```

![img](<./error/error message multiline.svg>)

# error prop added

```js
assert({
  actual: Object.assign(new Error("message"), { a: true }),
  expect: new Error("message"),
});
```

![img](<./error/error prop added.svg>)

# error prop removed

```js
assert({
  actual: new Error("message"),
  expect: Object.assign(new Error("message"), { a: true }),
});
```

![img](<./error/error prop removed.svg>)

# error prop modified

```js
assert({
  actual: Object.assign(new Error("message"), { a: true }),
  expect: Object.assign(new Error("message"), { a: false }),
});
```

![img](<./error/error prop modified.svg>)

# error vs typeError

```js
assert({
  actual: new Error(),
  expect: new TypeError(),
});
```

![img](<./error/error vs typeError.svg>)

# error vs CustomError

```js
class ValidationError extends Error {}
assert({
  actual: new Error(),
  expect: new ValidationError(),
});
```

![img](<./error/error vs CustomError.svg>)

