# execution

It is a function that will launch a browser or a node.js process to execute a file inside it.
It dynamically transforms file source to make it executable on the platform.

This feature is provided by `@jsenv/core` which exports a function called `execute`.<br />

This documentation explains how to use `execute` inside a project.

## How to use

Using a basic project setup we'll see how to use `execute` to create script capable to execute file inside chromium or node.js.

### Basic project setup

```
root/
  src/
    file.js
    platform-name.js
  package.json
```

`root/file.js`

```js
import { getPlatformName } from "./platform-name.js"

console.log(getPlatformName())
```

`root/platform-name.js`

```js
export const getPlatformName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}
```

`root/package.json`

```json
{
  "name": "whatever"
}
```

### How to execute a file of that basic project inside chromium

1. Generate `root/importMap.json` for your project.

```shell
npm install --save-dev @jsenv/node-module-import-map
node -e 'require("@jsenv/node-module-import-map").generateImportMapForProjectNodeModules({ projectPath: process.cwd() })'
```

2. install `@jsenv/core`

```shell
npm install --save-dev @jsenv/core
```

3. Create a script capable to execute a file on chromium.<br />

`root/execute-chromium.js`

```js
const { launchChromium, execute } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativePath: `/${process.argv[2]}`,
})
```

4. Run `root/execute-chromium.js` we just created

```shell
node ./execute-chromium.js src/file.js
```

`browser` will be logged in your terminal.

### How to execute a file of that basic project inside node.js

1. Generate `root/importMap.json` for your project.

```shell
npm i --save-dev @jsenv/node-module-import-map
node -e 'require("@jsenv/node-module-import-map").generateImportMapForProjectNodeModules({ projectPath: process.cwd() })'
```

2. install `@jsenv/core`

```shell
npm i --save-dev @jsenv/core
```

3. Create a script capable to execute a file on node.<br />

`root/execute-node.js`

```js
const { launchNode, execute } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchNode,
  fileRelativePath: `/${process.argv[2]}`,
})
```

4. Run `root/execute-node.js` we just created

```shell
node ./execute-node.js src/file.js
```

`node` will be logged in your terminal.

#### vscode - debug node configuration

What if you could debug inside node.js the file currently opened in vscode?<br />

1. Add a launch configuration in `root/.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-node",
      "type": "node",
      "request": "launch",
      "protocol": "inspector",
      "program": "${workspaceFolder}/execute-node.js",
      "args": ["${relativeFile}"],
      "autoAttachChildProcesses": true,
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "/*": "${workspaceFolder}/*"
      },
      "smartStep": true,
      "skipFiles": ["node_modules/**", "<node_internals>/**/*.js"]
    }
  ]
}
```

2. Edit `root/execute-node.js`

This step is required otherwise vscode sometimes does not stop on `debugger` keywords.<br />
To fix that we must force `debugModeInheritBreak` to true.<br />

`root/execute-node.js` must be

```js
const { launchNode, execute } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: (options) => launchNode({ ...options, debugModeInheritBreak: true }),
  fileRelativePath: `/${process.argv[2]}`,
})
```

3. Start a debugging session using `jsenv node`

I made a video of the debugging session inside vscode. The gif below was generated from that video.

![vscode debug node gif](./vscode-debug-node.gif)

## Execute options

The documentation of some options used by `execute` is shared.<br />
— see [shared options](../shared-options/shared-options.md)

Options below are specific to `execute`.

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
