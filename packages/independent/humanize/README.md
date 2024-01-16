# inspect [![npm package](https://img.shields.io/npm/v/@jsenv/humanize.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/humanize)

`@jsenv/humanize` turns a JavaScript value into a string meant to be read by a human. It is written in ES6 and compatible with browsers and Node.js.

```js
import { humanize } from "@jsenv/humanize";

console.log(
  humanize({
    boolean: true,
    number: 10,
    string: "hello world",
  }),
);
```

```console
❯ node ./docs/demo.mjs
{
  "boolean": true,
  "number": 10,
  "string": "hello world"
}
```

# Comparison with JSON.stringify

Table comparing `JSON.stringify` and `@jsenv/humanize` to demonstrates how inspect focuses on readability and accuracy.

| value     | JSON.stringify | jsenv inspect |
| --------- | -------------- | ------------- |
| 123456789 | "123456789"    | 123_456_789   |
| Infinity  | "null"         | Infinity      |
| -0        | "0"            | -0            |
| '"'       | '"\\""'        | '"'           |
