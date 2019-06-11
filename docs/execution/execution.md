# execution

It is a function that will launch a browser or a node.js process to execute a file inside it.
It dynamically transforms file source to make it executable on the platform.

## How to use

Let's setup a basic project and see how we could execute file inside it afterwards.

### Basic project setup

```
root/
  src/
    file.js
    platform-name.js
  package.json
```

`file.js`

```js
import { platformName } from "./platform-name.js"

console.log(platformName)
```

`platform-name.js`

```js
const getPlatformName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}

export const platformName = getPlatformName()
```

### How to execute inside chromium

```shell
npm i @jsenv/core --save-dev
```

Create a file at `root/execute-chromium.js` with this inside.

```js
const { launchChromium, execute } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativePath: `/${process.execArgv[2]}`,
})
```

```shell
node ./execute-chromium.js src/file.js
```

It will log `browser` in your terminal.

### How to execute inside node.js

```shell
npm i @jsenv/core --save-dev
```

Create a file at `root/execute-node.js` with this inside.

```js
const { launchNode, execute } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchNode,
  fileRelativePath: `/${process.execArgv[2]}`,
})
```

```shell
node ./execute-node.js src/file.js
```

It will log `node` in your terminal.

## Shared options

The documentation of some options used by `execute` is shared.<br />
— see [shared options](../shared-options/shared-options.md)

## Specific options

Options below are specific to `execute`

### launch

Required.<br />
A function capable to launch a platform to execute a file inside it.<br />
— see [platform launcher](../platform-launcher/platform-launcher.md)

### fileRelativePath

Required.<br />
A string leading to the file you want to execute. It is relative to projectPath.

### mirrorConsole

Default value:

```js
true
```

When true, platform logs are also written in the terminal.

### stopOnceExecuted

Default value:

```js
false
```

When true, the platform will be stopped once the file execution is done.<br />
Without this option you would have to manually close a browser launched to execute a file.<br />
By passing true, the browser will be stopped once file execution is done.
