# content-type multi added

```js
assert({
  actual: new Headers({
    "content-type": "text/xml, text/css",
  }),
  expect: new Headers({
    "content-type": "text/xml",
  }),
});
```

![img](<./headers/content-type multi added.svg>)

