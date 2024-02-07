# a custom prototype

```js
const User = {
  [Symbol.toStringTag]: "User",
};
const dam = Object.create(User);
dam.name = "dam";
const bob = { name: "bob" };

assert({
  actual: dam,
  expected: bob,
});
```

![img](<./prototype/a custom prototype.svg>)

