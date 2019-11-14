# `startExploringServer`

Document how `startExploringServer` functions behaves.<br />

## `startExploringServer` options

### explorableMap

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  explorableMap: {
    "/src/**/*.js": true,
    "/src/whatever/**/*.js": false,
  },
})
```

It is an object used to describe if a file is explorable or not.<br/>
Example above means:

- a file ending with `.js`, anywhere inside `/src/` is explorable
- a file ending with `.js`, anywhere inside `/src/whatever/` is not explorable

`explorableMap` uses path matching provided by `@jsenv/url-meta`.<br />
— see [@jsenv/url-meta on github](https://github.com/jsenv/jsenv-url-meta)

Index page list files described as explorable.<br />
Server will not handle request mades to non explorable files.<br />

If you don't pass this option, the default value will be:

```js
{
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true
}
```

### protocol

```js
const { readFileSync } = require("fs")
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  protocol: "https",
  signature: {
    privateKey: readFileSync(`${__dirname}/ssl/private.pem`),
    certificate: readFileSync(`${__dirname}/ssl/cert.pem`),
  },
})
```

If you don't pass this option, the default value will be:

```js
"http"
```

If you pass `"https"` and omit `signature`, a default certificate will be used.<br />
— see [default https certificate](https://github.com/dmail/server/blob/4d40f790adebaa14b7482a9fb228e0c1f63e94b7/src/server/signature.js#L24)

### ip

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  ip: "192.168.0.1",
})
```

If you don't pass this option, the default value will be:

```js
"127.0.0.1"
```

### port

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  port: 8080,
})
```

If you don't pass this option, the default value will be:

```js
0
```

The number `0` means a random available port will be used.

### forcePort

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  port: 8080,
  forcePort: true,
})
```

When true, if there is process already listening the port you want to use, we will try to kill that process.

If you don't pass this option, the default value will be:

```js
false
```

### livereloading

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  livereloading: true,
})
```

When true, browser reloads itself when a file changes or is saved.<br />
When executing a file, only the file itself or an imported file will trigger the reloading.

If you don't pass this option, the default value will be:

```js
false
```

### watchDescription

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  livereloading: true,
  watchDescription: {
    "/*/**": false,
    "/*": true,
    "/src/**/*": true,
  },
})
```

Object used to describe what project ressources should be watched.<br />

If you don't pass this option, the default value will be:

```js
{
  "/**/*": true,
  "/.git/": false,
  "/node_modules/": false,
}
```

This default value is designed to work with any project because it means:

- watch everything
- except stuff inside top level .git folder
- except stuff inside top level node_modules folder

You can add more exception like this:

```js
const {
  startExploringServer,
  EXPLORING_SERVER_WATCH_EXCLUDE_DESCRIPTION,
} = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  livereloading: true,
  watchDescription: {
    "/**/*": true,
    ...EXPLORING_SERVER_WATCH_EXCLUDE_DESCRIPTION,
    "/.cache/": false,
  },
})
```

Or even better, describe what should be watched with a positive approach, as in the example:

```js
{
  "/*/**": false,
  "/*": true,
  "/src/**/*": true,
}
```

Which means:

- watch nothing
- except top level files
- except files inside top level src folder

### HTMLTemplateRelativePath

```js
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: "/Users/you/project",
  HTMLTemplateRelativePath: "/custom-template.html",
})
```

The html file will be used as a template to execute your JavaScript files.
Be sure your html file file contains the following script tag:

```html
<script src="/.jsenv/browser-script.js"></script>
```

Because this is how server can arbitrary execute some javaScript inside your custom html file

If you don't pass this option, the default value will be a predefined folder available inside jsenv itself:

```js
"/node_modules/@jsenv/exploring-server/src/template.html"
```

### projectPath

— see [generic documentation for projectPath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#projectpath)

### babelPluginMap

— see [generic documentation for babelPluginMap](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#babelpluginmap)

### convertMap

— see [generic documentation for convertMap](../shared-options/shared-options.md#convertmap)

### importMapRelativePath

— see [generic documentation for importMapRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importmaprelativepath)

### importDefaultExtension

— see [generic documentation for importDefaultExtension](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importdefaultextension)

### compileIntoRelativePath

— see [generic documentation for compileIntoRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#compileintorelativepath)
