# Error vs TypeError

```js
assert({
  actual: new Error(),
  expect: new TypeError(),
});
```

![img](<./prototype/Error vs TypeError.svg>)

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

![img](<./prototype/object with different prototypes.svg>)

# Object.create(null) and {}

```js
assert({
  actual: Object.create(null),
  expect: {},
});
```

![img](<./prototype/Object.create(null) and {}.svg>)

# Object.create(null) and []

```js
assert({
  actual: Object.create(null),
  expect: [],
});
```

![img](<./prototype/Object.create(null) and [].svg>)

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

![img](<./prototype/object vs custom proto.svg>)

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

![img](<./prototype/object vs instance.svg>)

