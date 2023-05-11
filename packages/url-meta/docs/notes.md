```js
// Name of variables in the code below corresponds
// to the terminology used in the codebase and documentation
const pattern = "**/*";
const value = { visible: true };
const valueMap = {
  [pattern]: value,
};
```

## associations

_associations composition_

```js
const pattern = "**/*/";
const key = "visible";
const value = true;
const meta = { [key]: value };
const valueMap = {
  [pattern]: meta,
};
const associations = {
  [key]: valueMap,
};
```
