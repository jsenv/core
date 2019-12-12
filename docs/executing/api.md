# Table of contents

- [execute example](#execute-example)
- [parameters](#parameters)
  - [launch](#launch)
  - [fileRelativeUrl](#fileRelativeUrl)
  - [mirrorConsole](#mirrorConsole)
  - [stopPlatformAfterExecute](#stopPlatformAfterExecute)
- [shared parameters](#shared-parameters)
- [execute return value](#execute-return-value)
  - [status](#status)
  - [error](#error)
  - [namespace](#namespace)
  - [consoleCalls](#consoleCalls)
  - [startMs + endMs](#startMs-+-endMs)
  - [platformName](#platformName)
  - [platformVersion](#platformVersion)

# execute example

> `execute` is a function executing a file on a platform and returning the result of that execution.

Implemented in [src/execute.js](../../src/execute.js), you can use it as shown below.

```js
const { execute, launchNode } = require("@jsenv/core")

execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  launch: launchNode,
})
```

The code aboves spawn a node process and executes index.js file in it.

# Parameters

`execute` uses named parameters documented here.

Each parameter got a dedicated section to shortly explain what it does and if it's required or optional.

## launch

> `launch` is a function capable to launch a platform to execute a file in it.

This parameter is **required**, the available launch functions are `launchNode`, `launchChromium`, `launchChromiumTab`.

You're not likely going to write your own `launch` function, jsenv provides them.
If you want to know more about launch internals or write your own check [platform launcher](../platform-launcher/platform-launcher.md)

## fileRelativeUrl

> `fileRelativeUrl` is a relative url string leading to the file you want to execute.

This parameter is **required**, an example value could be:

```js
"./index.js"
```

### mirrorConsole

> `mirrorConsole` is a boolean controlling if the platform logs will appear in your terminal.

This parameter is optional with a default value of

```js
true
```

### stopPlatformAfterExecute

> `stopPlatformAfterExecute` is a boolean controlling if the platform will be stopped once the file execution is done.

This parameter is optional with a default value of

```js
true
```

This option kills the browser or node process when the file execution is done. This option is used by unit tests for instance that does not want to keep things alive.

# Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)

# execute return value

`execute` returns signature is

```js
{
  status,
  error,
  namespace,
  consoleCalls,
  startMs,
  endMs,
  platformName,
  platformVersion,
}
```

## status

> `status` is a string describing how the file execution went

```js
const { execute } = require("@jsenv/core")

const { status } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

The possible `status` are `"completed"`, `"errored"`, `"timedout"`, `"disconnected"`.
The meaning of these status was already docummented in an other page.<br />
— see [How test is executed](../testing/readme.md#How-test-is-executed), especially the different code examples.

## error

> `error` is the value throw during the file execution

```js
const { execute } = require("@jsenv/core")

const { error } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

If no error was thrown error will be undefined.

## namespace

> `namespace` is an object containing exports of the executed file.

```js
const { execute } = require("@jsenv/core")

const { namespace } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectNamespace: true, // without this namespace is undefined
})
```

## consoleCalls

> `consoleCalls` is an array describing all calls made to platform console during the file execution.

```js
const { execute } = require("@jsenv/core")

const { consoleCalls } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  captureConsole: true, // without this consoleCalls is undefined
})
```

An example of `consoleCalls` could be

<!-- prettier-ignore -->
```js
[
  { type: "error", text: "An error occured" },
  { type: "log", text: "Hello world" },
]
```

## startMs + endMs

> `startMs` is a number representing the milliseconds at which execution started.
> `endMs` is a number representing the milliseconds at which execution was done.

```js
const { execute } = require("@jsenv/core")

const { startMs, endMs } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  measureDuration: true, // without this startMs, endMs are undefined
})
```

startMs + endMs are meant to measure the duration of the execution.
You can also convert them to date by doing

```js
new Date(startMs)
```

## platformName

> `platformName` is a string describing the platform used to execute the file.

```js
const { execute } = require("@jsenv/core")

const { platformName } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectPlatformName: true, // without this platformName is undefined
})
```

For now the possible platformName values are `"chromium"` or `"node"`.

## platformVersion

> `platformVersion` is a string describing the platform version used to execute the file.

```js
const { platformVersion } = await executeTestPlan({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectPlatformVersion: true, // without this platformVersion is undefined
})
```

Use this to know the node version or browser version used to execute the file.
