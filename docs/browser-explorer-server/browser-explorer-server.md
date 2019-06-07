# browser-explorer-server

It's a server dynamically serving self executing file for every file of your project.
It is fast because it caches transpiled files on filesystem.

## How to use

Let's take a basic project as example

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

### Add browser explorer server to basic project

From that basic project file structure above here is how to use browser explorer server.

```shell
npm i @jsenv/core --save-dev
```

Create a file at `root/start-browser-explorer-server.js` with this inside.

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

Now execute `root/start-browser-explorer-server.js` with node.

```shell
node ./start-browser-explorer-server.js
```

It will start a server at http://127.0.0.1:3456 and will log that information to the console.
Once server is started you can navigate to http://127.0.0.1:3456 and you will get an html page listing the files you can navigate.

![explorer server chome screenshot](./explorer-server-chrome-screenshot.png)

If you navigate to http://127.0.0.1:3456/src/hello.js your console will contain a log saying `Hello world`.
If you navigate to http://127.0.0.1:3456/src/text.js nothing special will happen because `/src/text.js` is just a module with an export default.

## Options

startBrowserExplorerServer is framework agnostic and meant to run basic javascript.
There is options to controls how it work internally:

### projectPath

This is the only required option. It must lead to a folder that will be considered as the root of your project. All relative path will be relative to this projectPath option.

```js
startBrowserExplorerServer({
  projectPath: "/Users/dmail/project",
})
```

Note: it will work on windows where projectPath would be `C:\\Users\\dmail\\project`.

### browsableDescription

Default value:

```js
{
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true
}
```

The server will only serve file described as browsable.
`/**/` means 0 or more folder.
`*` means 1 or more character.
More info on path matching available at https://github.com/dmail/project-structure.

### protocol

Default value: `"http"`.
The protocol used by the server, you can also pass `"https"`.

### ip

Default value: `"127.0.0.1"`.
The ip server will listen to.

### port

Default value: `0`.
The port server will listen to. 0 means a random available port will be used.

### forcePort

Default value: `false`.
Server will try to kill any process poentially using the port it wnats to listen.

### compileIntoRelativePath

Default value: `/.dist`.
Server is going to write compiled files into that folder. This folder allow the server
to write compiled files on your filesystem to cache them.

## Advanced options

### importMapRelativePath

Default value: `/importMap.json`.
`importMap.json` files are used to remap your import. The presence of this file is optionnal.

TODO: provide more documentation on `importMap.json` file.

### babelPluginMap

Default value: `jsenvBabelPluginMap`.
The default value comes from https://github.com/jsenv/jsenv-babel-plugin-map.
babelPluginMap is an object describing all babel plugin required by your project.
You can extend the default babelPluginMap like this:

```js
const { jsenvBabelPluginMap } = require("@jsenv/babel-plugin-map")
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

startBrowserExplorerServer({
  projectPath: "/Users/dmail/project",
  babelPluginMap: {
    ...jsenvBabelPluginMap,
    "transform-react-jsx": [transformReactJSX, { pragma: "dom" }],
  },
})
```

### browserClientRelativePath

Default value: `/node_modules/@jsenv/core/src/browser-client`.
Files inside this folder will be served by browser explorer server.
The `index.html` file is used to execute js inside the browser.
`index.html` must contains a

```html
<script src="/.jsenv/browser-script.js"></script>
```

This is because server will serve a dynamic self executing js at `/.jsenv/browser-script.js`.

```html
<script src="/.jsenv/browser-script.js"></script>
```
