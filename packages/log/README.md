# Log [![npm package](https://img.shields.io/npm/v/@jsenv/log.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/log)

This packages is used by jsenv to create beautiful logs in the console. It is available as a standalone package to be used in other contexts.

This package helps to:

- add symbols via unicode
- make dynamic logs
- add color to logs

# Task log example

![img](./docs/demo_task.gif)

Code used to produce these logs:

```js
import { createTaskLog } from "@jsenv/log"

const task = createTaskLog("Doing something")
setTimeout(() => {
  task.done()
}, 1_000)
```

# Unicode example

![img](./docs/demo_unicode.png)

Code used to produce these logs:

```js
import { UNICODE } from "@jsenv/log"

console.log(`${UNICODE.COMMAND} cd dir/`)
console.log(`${UNICODE.DEBUG} debug`)
console.log(`${UNICODE.INFO} info`)
console.log(`${UNICODE.WARNING} warning`)
console.log(`${UNICODE.FAILURE} failure`)
console.log(`${UNICODE.OK} ok`)
```

# Installation

```console
npm install @jsenv/log
```
