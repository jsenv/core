# platform launcher

A platform launcher is a function capable to launch a platform to execute a file.<br />
A platform launcher is meant to be passed to other jsenv tools.<br />
It allows you to tell jsenv on which platform and how you want to execute your files.<br />

When you want to pass custom option to a platform launcher, there is a pattern to follow.<br />
The following js code shows how you can launch a chromium with UI while, by default it would launch a headless chromium:

```js
const { launchChromium } = require(`@jsenv/core`)

const launchChromiumWithGraphicalInterface = (options) =>
  launchChromium({ ...options, headless: false })
```

This page will present the existing platform launcher:
[chromium-launcher](./#chromium-launcher) and [node-launcher](./#node-launcher)

## chromium-launcher

chromium launcher is exported by `@jsenv/core` under a function called `launchChromium`.<br />
In the future chromium launcher will likely have its own npm package and github repository.<br />

### launchChromium options

#### headless

Default value:

```js
true
```

When true, launched chromium browser will be headless.
When false, launched chromium browser will have a graphic interface.

## node-launcher

node launcher is exported by `@jsenv/core` under a function called `launchNode`.<br />
In the future node launcher will likely have its own npm package and github repository.<br />

### launchNode options

#### debugPort

Default value:

```js
0
```

If the current node process is not in debug mode this option has no effect.
Otherwise the launched node process debug port will be randomly assigned to an available port.

#### debugMode

Default value:

```js
"inherit"
```

Node support to be debugged by passing option like `--inspect-brk`.<br />
In that case the JavaScript execution is controlled from the outside to let you debug it.
This option controls the debug mode of the launched node process.
`inherit` means it will inherit the current node process debug option.
`inspect`,`inspect-brk`,`debug`,`debug-brk` means the launched node process debug mode will be forced to this one.
``, an empty string, means the launched node process will not be in debug mode

#### debugModeInheritBreak

Default value:

```js
false
```

When debugMode is `inherit` this option controls if the launched node process will inherit the `-brk`.
Assuming `file.js` launches a node process using launchNode:

- When debugModeInheritBreak is false, doing `node file.js --inspect-brk` launches a node process with `--inspect`.
- When debugModeInheritBreak is true, doing `node file.js --inspect-brk` launches a node process with `--inspect-brk`.

#### traceWarnings

Default value:

```js
true
```

The launched node process will receive `--trace-warnings` optionn.
