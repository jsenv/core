# named Symbol() vs anonymous symbol

```js
assert({
  actual: Symbol("a"),
  expect: Symbol(),
});
```

![img](<./symbol/named Symbol() vs anonymous symbol.svg>)

# anonymous symbol vs named Symbol()

```js
assert({
  actual: Symbol(""),
  expect: Symbol("b"),
});
```

![img](<./symbol/anonymous symbol vs named Symbol().svg>)

