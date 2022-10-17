## Properties order constraint

The strongest contraints is that actual and expected must have the same properties order. In general code does not rely on properties order but sometimes it's crucial. The code below shows how _Object.keys_ behaves when properties order is different.

```js
Object.keys({
  foo: true,
  bar: true,
})[0] // "foo"

Object.keys({
  bar: true,
  foo: true,
})[0] // "bar"
```
