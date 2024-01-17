# humanize [![npm package](https://img.shields.io/npm/v/@jsenv/humanize.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/humanize)

`@jsenv/humanize` helps to generate messages meant to be read by humans

It is written in ES6 and compatible with browsers and Node.js.

# API

## humanize(jsValue)

Turns a JavaScript value into a string meant to be read by a human.

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
{
  "boolean": true,
  "number": 10,
  "string": "hello world"
}
```

### Comparison with JSON.stringify

Table comparing `JSON.stringify` and `humanize()` to demonstrates how inspect focuses on readability and accuracy.

| value     | JSON.stringify | humanize    |
| --------- | -------------- | ----------- |
| 123456789 | "123456789"    | 123_456_789 |
| Infinity  | "null"         | Infinity    |
| -0        | "0"            | -0          |
| '"'       | '"\\""'        | '"'         |

## humanizeDuration(ms, options)

```js
import { humanizeDuration } from "@jsenv/humanize";

humanizeDuration(61_421); // "1 minute and 1 second"
```
