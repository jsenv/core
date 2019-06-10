# browser-explorer-server

This is a server dynamically serving self executing file for every file of your project.<br />
It is fast because transpiled files are cached on your filesystem.<br />

This feature is provided by `@jsenv/core` which exports a function called `startBrowserExplorerServer`.<br />

Next part shows how to use browser explorer server inside a project.

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

### Install browser explorer server inside that basic project

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

### Use browser explorer server inside that basic project

Now execute `root/start-browser-explorer-server.js` with node.

```shell
node ./start-browser-explorer-server.js
```

It will start a server at http://127.0.0.1:3456 and will log that information to the console.<br />
Once server is started you can navigate to http://127.0.0.1:3456 and you will get an html page listing the files you can navigate.

![explorer server chome screenshot](./explorer-server-chrome-screenshot.png)

If you navigate to http://127.0.0.1:3456/src/hello.js your console will contain a log saying `Hello world`.<br />
If you navigate to http://127.0.0.1:3456/src/text.js nothing special will happen because `/src/text.js` is just a module with an export default.

## Simple options

### projectPath

This is the only required option. It must lead to a folder that will be considered as the root of your project. All relative path will be relative to this projectPath option.

```js
startBrowserExplorerServer({
  projectPath: "/Users/dmail/project",
})
```

Note: it will work on windows where projectPath would be `C:\Users\dmail\project`.

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

Server will try to kill any process poentially using the port it wnats to listen.

### compileIntoRelativePath

Default value:

```js
"/.dist"
```

Server is going to write compiled files into that folder. This folder allow the server
to write compiled files on your filesystem to cache them.

## Advanced options

jsenv is meant to run regular JavaScript. But thanks to advanced options you can make browser explorer server compatible with `jsx` for instance.

### babelPluginMap

Default value:

```js
const { jsenvBabelPluginMap } = require("@jsenv/babel-plugin-map")
```

The default value comes from https://github.com/jsenv/jsenv-babel-plugin-map.<br />
`babelPluginMap` is an object describing all babel plugin required by your project.<br />
You can extend default `babelPluginMap` like this:

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

### importMapRelativePath

Default value:

```js
"/importMap.json"
```

`importMap.json` files are used to remap your import. The presence of this file is optionnal.

TODO: provide more documentation on `importMap.json` file.

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
