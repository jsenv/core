# browser-explorer-server

This feature is provided by `@jsenv/core` which exports a function called `startBrowserExplorerServer`.<br />

The function starts a server dynamically serving self executing file for every file of your project.<br />
It is fast because transpiled files are cached on your filesystem.<br />

This documentation explains how to use `startBrowserExplorerServer` inside a project.

## How to use

Using a basic project setup we'll see how to use browser explorer server to execute this project files inside a browser.

### Basic project setup

```
root/
  src/
    text.js
    hello.js
  package.json
```

`root/src/text.js`

```js
export default "Hello world"
```

`root/src/hello.js`

```js
import text from "./text.js"

console.log(text)
```

`root/package.json`

```json
{
  "name": "whatever"
}
```

### Using browser explorer server inside that basic project

1. Generate `root/importMap.json` for your project.

```shell
npm i --save-dev @jsenv/node-module-import-map
node -e 'require("@jsenv/node-module-import-map").generateImportMapForProjectNodeModules({ projectPath: process.cwd() })'
```

2. Install `@jsenv/core`

```shell
npm install --save-dev @jsenv/core
```

3. Create a script starting browser explorer server

`root/start-browser-explorer-server.js`

```js
const { startBrowserExplorerServer } = require("@jsenv/core")

startBrowserExplorerServer({
  projectPath: __dirname,
  browsableDescription: {
    "/src/*.js": true,
  },
  port: 3456,
})
```

4. Run `root/start-browser-explorer-server.js` we just created

```shell
node ./start-browser-explorer-server.js
```

A server will start listening at http://127.0.0.1:3456 and log that info in your terminal.<br />

5. Open `http://127.0.0.1:3456` using a browser

Once server is started you can navigate to `http://127.0.0.1:3456` and you will see an html page listing the files you can browse.

![explorer server chome screenshot](./explorer-server-chrome-screenshot.png)

6. Browse a file

- If you go to http://127.0.0.1:3456/src/hello.js your console will contain a log saying `Hello world`.
- If you go to http://127.0.0.1:3456/src/text.js nothing special will happen because `/src/text.js` is just a module with an export default.

## vscode - debug chrome configuration

What if you could debug inside chrome the file currently opened in vscode?<br />

1. Install `debugger for chrome` vscode extension

Link to extension: https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome

2. Add a launch configuration in `root/.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://127.0.0.1:3456/${relativeFile}",
      "runtimeArgs": ["--allow-file-access-from-files", "--disable-web-security"],
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

3. Start browser explorer server

```shell
node ./start-browser-explorer-server.js
```

4. Start a debugging session using `jsenv chrome`

I made a video of the debugging session inside vscode. The gif below was generated from that video.

![vscode debug chrome gif](./vscode-debug-chrome.gif)

## startBrowserExplorerServer options

The documentation of some options used by `startBrowserExplorerServer` is shared.<br />
— see [shared options](../shared-options/shared-options.md)

Options below are specific to `startBrowserExplorerServer`.

### browsableDescription

Default value:

```js
{
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true
}
```

The server will only serve file described as browsable.<br />
`/**/` means 0 or more folder.<br />
`*` means 1 or more character.<br />
More info on path matching available at https://github.com/dmail/project-structure.

### protocol

Default value:

```js
"http"
```

The protocol used by the server, you can also pass `"https"`.

### ip

Default value:

```js
"127.0.0.1"
```

The ip server will listen to.

### port

Default value:

```js
0
```

The port server will listen to. 0 means a random available port will be used.

### forcePort

Default value

```js
false
```

WHen true, server will try to kill any process poentially using the port it wants to listen.

### browserClientRelativePath

Default value:

```js
"/node_modules/@jsenv/core/src/browser-client"
```

Files inside this folder will be served by browser explorer server.<br />
This folder must contain an `index.html` file that will be used to execute js inside the browser.<br />
And `index.html` must contains a script tag like the one below.

```html
<script src="/.jsenv/browser-script.js"></script>
```

This is because server will serve a dynamic self executing js at `"/.jsenv/browser-script.js"`.
