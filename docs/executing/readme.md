# Execute

A programmatic way to execute a file in a browser or Node.js and obtain meta information regarding the result of that execution.

Normally you don't need this because:

- If your file is written for a browser, [exploring server](../exploring/readme.md) is better in every aspect.
- If your file is written for Node.js, you can execute the file directly with the `node` command.

That being said, execute can still be useful, for instance to execute typescript files with Node.js without having to compile them beforehand.

# Table of contents

- [Execute presentation](#Execute-presentation)
- [Execute concrete example](#Execute-concrete-example)
- [execute example](#execute-example)
- [execute parameters](#execute-parameters)
- [execute return value](#execute-return-value)

# Execute concrete example

This part helps you to setup a project on your machine to create scripts capable to execute html files inside chromium and js files inside node.js. You can also reuse the project file structure to understand how to integrate jsenv to execute your files.

<details>
  <summary>1 - Setup basic project</summary>

```console
git clone https://github.com/jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/executing/basic-project
```

```console
npm install
```

</details>

<details>
  <summary>2 - Executing file on chromium</summary>

```console
node ./execute-chromium.js index.js
```

`browser` will be logged in your terminal.

![chromium execution terminal screenshot](./chromium-terminal-screenshot.png)

</details>

<details>
  <summary>3 - Executing file on Node.js</summary>

```console
node ./execute-node.js index.js
```

`node` will be logged in your terminal.

![node execution terminal screenshot](./node-terminal-screenshot.png)

</details>

<details>
  <summary>4 - Debug chrome from vscode</summary>

If you are using vscode you can also debug the file execution within your editor.

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
import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: __dirname,
  port: 3456,
})
```

Then you must execute that file to run the server.
Once server is started you can use the jsenv-chrome debug configuration to debug your files.

> There is an issue to improve chrome debugging at https://github.com/jsenv/jsenv-core/issues/54

</details>

<details>
  <summary>5 - Debug node from vscode</summary>

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

</details>

# execute example

`execute` is an async function launching a runtime, executing a file in it and returning the result of that execution.

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

`execute` uses named parameters documented below.

<details>
  <summary>launch</summary>

`launch` parameter is a function capable to launch a runtime environment to execute a file in it. This parameter is **required**, the available launch functions are documented in [launcher](../launcher.md) documentation.

</details>

<details>
  <summary>fileRelativeUrl</summary>

`fileRelativeUrl` parameter is a relative url string leading to the file you want to execute. This parameter is **required**.

</details>

<details>
  <summary>mirrorConsole</summary>

`mirrorConsole` parameter is a boolean controlling if the runtime environment logs will appear in your terminal. This parameter is optional with a default value of `true`.

</details>

<details>
  <summary>stopAfterExecute</summary>

`stopAfterExecute` parameter is a boolean controlling if the runtime environment will be stopped once the file execution is done. This parameter is optional and disabled by default.

Stopping a runtime means killing the browser or node process when the file execution is done. Jsenv does nothing by default so that you decide when to stop it. When executing a test file jsenv stops runtime once execution result is known to avoid keeping things alive once the test is done.

For execution inside a browser it means you can see the output in the browser instance launched assuming it was launched in non-headless mode.

For node execution launched process is kept alive as long as the code uses api that keeps it alive such as setTimeout, setInterval or an http server listening.

</details>

<details>
  <summary>Shared parameters</summary>

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)

</details>

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
  runtimeName,
  runtimeVersion,
}
```

<details>
  <summary>status</summary>

`status` is a string describing how the file execution went. The possible `status` are `"completed"`, `"errored"`, `"timedout"`, `"disconnected"`. The meaning of these status was already docummented in [How test is executed](../testing/readme.md#How-test-is-executed).

```js
import { execute } from "@jsenv/core"

const { status } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>error</summary>

`error` is the value throw during the file execution. It is returned only if an error was thrown during file execution.

```js
import { execute } from "@jsenv/core"

const { error } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>namespace</summary>

`namespace` is an object containing exports of the executed file.

```js
import { execute } from "@jsenv/core"

const { namespace } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>consoleCalls</summary>

`consoleCalls` is an array describing all calls made to runtime console during the file execution. It is returned only when `captureConsole` is enabled.

```js
import { execute } from "@jsenv/core"

const { consoleCalls } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
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

</details>

<details>
  <summary>startMs and endMs</summary>

`startMs` parameter is a number representing the milliseconds at which execution started.<br />
`endMs` parameter is a number representing the milliseconds at which execution was done.<br />
These value are returned only when `measureDuration` is enabled.

startMs + endMs are meant to measure the duration of the execution. They can be converted to date by doing `new Date(startMs)`.

```js
import { execute } from "@jsenv/core"

const { startMs, endMs } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  measureDuration: true, // without this startMs, endMs are undefined
})
```

</details>

<details>
  <summary>runTimename</summary>

`runtimeName` is a string describing the runtime used to execute the file. It is returned only when `collectRuntimeName` is enabled. For now the possible runtimeName values are `"chromium"`, `"node"`, `"firefox"`, `"webkit"`.

```js
import { execute } from "@jsenv/core"

const { runtimeName } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  collectRuntimeName: true, // without this runtimeName is undefined
})
```

</details>

<details>
  <summary>runtimeVersion</summary>

`runtimeVersion` is a string describing the runtime version used to execute the file. Use this to know the node version or browser version used to execute the file. It is returned only when `collectRuntimeVersion` is enabled.

```js
const { runtimeVersion } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  collectRuntimeVersion: true, // without this runtimeVersion is undefined
})
```

</details>
