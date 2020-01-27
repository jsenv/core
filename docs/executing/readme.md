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
- [Execute api](#Execute-api)

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

## Execute api

If you want to know more about `execute`, there is a more detailed documentation on it.<br />
— see [`execute` documentation](./api.md)
