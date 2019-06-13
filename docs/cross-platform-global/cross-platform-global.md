# cross platform global

When writing cross platform code you may still have to access the global object.<br />
By global object I mean `window` inside a browser or `global` inside node.js.<br />
But if you had to write `window` or `global` explicitely you would make your code unable to run on other platforms.

To avoid this jsenv provides a `global` module.

## The `global` module

It is a fake module, using it will convert your code to make it compatible with the platform specific global object.

### `global` default export

You can use default import on `global`. It will be global object itself.

```js
import globalObject from `global`

globalObject.answer = 42
```

Inside a browser `globalObject` will be `window`.<br />
Inside node.js `globalObject` will be `global`.

### `global` named export

You can use named import on `global`. It can be anything available on global object.

```js
import { Math } from "global"

console.log(`biggest bumber between 40 and 42 -> ${Math.max(40, 42)})
```

Inside a browser `Math` will be `window.Math`.<br />
Inside node.js `Math` will be `global.Math`.<br />

### But, it is useless no?

This feature may look useless because you could write `Math.max(40, 42)` directly.<br />
It works because anything available on global object is a global variable.<br />

But with a file containing on top of it

```js
import { Math } from "global"
```

- When a human reads that import, he immediatly knows the file will use `Math`.<br />
- When a tool, like `eslint` reads that import, it would be able to know if a variable is defined or not without effort. Because currently it has to maintain a list of global variables to deduce if a variable is defined or not.

### So what ?

It's up to you to decide if you like to read something like

```js
import { setTimeout } from "global"
```

But inside my code I'll definitely give it a try because I like expliciteness.
