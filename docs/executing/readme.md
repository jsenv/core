# Table of contents

- [Execute presentation](#Execute-presentation)
- [Execute concrete example](#Execute-concrete-example)
  - [1 - Setup basic project](#1---Setup-basic-project)
  - [2 - Executing file on chromium](#2---Executing-file-on-chromium)
  - [3 - Executing file on Node.js](#3---Executing-file-on-Node.js)
  - [4 - Debug file from vscode](#4---Debug-file-from-vscode)
    - [Debug chrome execution](#Debug-chrome-execution)
    - [Debug node execution](#Debug-node-execution)
      - [Node debugger inconsistency](#Node-debugger-inconsistency)
- [execute example](#execute-example)
- [execute parameters](#execute-parameters)
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

# Execute concrete example

This part helps you to setup a project on your machine to create scripts capable to execute any file inside chromium or node.js.<br />
You can also reuse the project file structure to understand how to integrate jsenv to execute your files.

## 1 - Setup basic project

```console
git clone https://github.com/jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/executing/basic-project
```

```console
npm install
```

## 2 - Executing file on chromium

```console
node ./execute-chromium.js index.js
```

`browser` will be logged in your terminal.

## 3 - Executing file on Node.js

```console
node ./execute-node.js index.js
```

`node` will be logged in your terminal.

## 4 - Debug file from vscode

If you are using vscode you can also debug the file execution within your editor.

### Debug chrome execution

You can debug file being executed in chrome within vscode.

![vscode debug chrome gif](../example-asset/vscode-debug-chrome.gif)

To achieve that you need a `.vscode/launch.json` file with the following content.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://127.0.0.1:3456/node_modules/@jsenv/core/src/internal/jsenv-html-file.html?file=${relativeFile}",
      "runtimeArgs": ["--allow-file-access-from-files", "--disable-web-security"],
      "sourceMaps": true,
      "webRoot": "${workspaceFolder}",
      "smartStep": true,
      "skipFiles": ["node_modules/@jsenv/core/**", "<node_internals>/**"]
    }
  ]
}
```

And a file starting the server capable to execute any file

```js
const { startExploring } = require("@jsenv/core")

startExploring({
  projectDirectoryUrl: __dirname,
  port: 3456,
})
```

Then you must execute that file to run the server.
Once server is started you can use the jsenv-chrome debug configuration to debug your files.

> There is an issue to improve chrome debugging at https://github.com/jsenv/jsenv-core/issues/54

### Debug node execution

You can debug file being executed in a node process withing vscode.

![vscode debug node gif](../example-asset/vscode-debug-node.gif)

To achieve that you need a `.vscode/launch.json` file with the following content.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-node",
      "type": "node",
      "request": "launch",
      "protocol": "inspector",
      "program": "${workspaceFolder}/script/run-node/run-node.js",
      "args": ["${relativeFile}"],
      "autoAttachChildProcesses": true,
      "sourceMaps": true,
      "smartStep": true,
      "skipFiles": ["node_modules/**", "<node_internals>/**"]
    }
  ]
}
```

If you already have one, just add the configuration without replacing the entire file.
You also have to create the `script/run-node/run-node.js` file.
Jsenv itself use it so you can find it at [script/run-node/run-node.js](../../script/run-node/run-node.js).

#### Node debugger inconsistency

Sometimes vscode fails to auto attach child process debugging session.<br />
When it happens you must manually attach it.<br />

To do that you can add an other configuration in your `launch.json`.

```json
{
  "name": "jsenv-node-attach-child",
  "type": "node",
  "request": "attach",
  "port": 40000,
  "smartStep": true,
  "sourceMaps": true,
  "skipFiles": ["node_modules/**", "<node_internals>/**/*.js"]
}
```

# execute example

`execute` is an async function executing a file on a platform and returning the result of that execution.

```js
import { execute, launchNode } from "@jsenv/core"

const result = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  launch: launchNode,
})
```

— source code at [src/execute.js](../../src/execute.js).

# execute parameters

`execute` uses named parameters documented here.

Each parameter got a dedicated section to shortly explain what it does and if it's required or optional.

## launch

`launch` parameter is a function capable to launch a platform to execute a file in it. This parameter is **required**, the available launch functions are `launchNode`, `launchChromium`, `launchChromiumTab`.

You're not likely going to write your own `launch` function, jsenv provides them.
If you want to know more about launch internals or write your own check [platform launcher](../platform-launcher/platform-launcher.md)

## fileRelativeUrl

`fileRelativeUrl` parameter is a relative url string leading to the file you want to execute. This parameter is **required**.

## mirrorConsole

`mirrorConsole` parameter is a boolean controlling if the platform logs will appear in your terminal. This parameter is optional with a default value of `true`.

## stopPlatformAfterExecute

`stopPlatformAfterExecute` parameter is a boolean controlling if the platform will be stopped once the file execution is done. This parameter is optional with a default value of `true`. This parameter kills the browser or node process when the file execution is done. This parameter is used by unit tests for instance that does not want to keep things alive.

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)

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

`status` is a string describing how the file execution went. The possible `status` are `"completed"`, `"errored"`, `"timedout"`, `"disconnected"`. The meaning of these status was already docummented in [How test is executed](../testing/readme.md#How-test-is-executed).

```js
import { execute } from "@jsenv/core"

const { status } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

## error

`error` is the value throw during the file execution. It is returned only if an error was thrown during file execution.

```js
import { execute } from "@jsenv/core"

const { error } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

## namespace

`namespace` is an object containing exports of the executed file. It is returned only when `collectNamespace` is enabled.

```js
import { execute } from "@jsenv/core"

const { namespace } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectNamespace: true, // without this namespace is undefined
})
```

## consoleCalls

`consoleCalls` is an array describing all calls made to platform console during the file execution. It is returned only when `captureConsole` is enabled.

```js
import { execute } from "@jsenv/core"

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

`startMs` parameter is a number representing the milliseconds at which execution started.<br />
`endMs` parameter is a number representing the milliseconds at which execution was done.<br />
These value are returned only when `measureDuration` is enabled.

startMs + endMs are meant to measure the duration of the execution. They can be converted to date by doing `new Date(startMs)`.

```js
import { execute } from "@jsenv/core"

const { startMs, endMs } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  measureDuration: true, // without this startMs, endMs are undefined
})
```

## platformName

`platformName` is a string describing the platform used to execute the file. It is returned only when `collectPlatformName` is enabled. For now the possible platformName values are `"chromium"` or `"node"`.

```js
const { execute } = require("@jsenv/core")

const { platformName } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectPlatformName: true, // without this platformName is undefined
})
```

## platformVersion

`platformVersion` is a string describing the platform version used to execute the file. Use this to know the node version or browser version used to execute the file. It is returned only when `collectPlatformVersion` is enabled.

```js
const { platformVersion } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
  collectPlatformVersion: true, // without this platformVersion is undefined
})
```
