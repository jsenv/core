# Error vs TypeError

```js
assert({
  actual: new Error(),
  expect: new TypeError(),
});
```

![img](<./prototype/error_vs_typeerror.svg>)

# object with different prototypes

```js
assert({
  actual: Object.create({
    a: true,
  }),
  expect: Object.create({
    a: { b: true },
  }),
});
```

![img](<./prototype/object_with_different_prototypes.svg>)

# Object.create(null) and {}

```js
assert({
  actual: Object.create(null),
  expect: {},
});
```

![img](<./prototype/object_create(null)_and_{}.svg>)

# Object.create(null) and []

```js
assert({
  actual: Object.create(null),
  expect: [],
});
```

![img](<./prototype/object_create(null)_and_[].svg>)

# object vs custom proto

```js
const User = {
  [Symbol.toStringTag]: "User",
};
const dam = Object.create(User);
dam.name = "dam";
const bob = { name: "bob" };

assert({
  actual: dam,
  expect: bob,
});
```

![img](<./prototype/object_vs_custom_proto.svg>)

# object vs instance

```js
class User {}
const dam = new User();
dam.name = "dam";
const bob = { name: "bob" };

assert({
  actual: {
    a: dam,
  },
  expect: {
    a: bob,
  },
});
```

![img](<./prototype/object_vs_instance.svg>)

