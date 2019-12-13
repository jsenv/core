# Table of contents

- [startExploring example](#startExploring-example)
- [Parameters](#parameters)
  - [explorableConfig](#ExplorableConfig)
  - [htmlFileRelativeUrl](#htmlFileRelativeUrl)
  - [livereloading](#livereloading)
  - [watchConfig](#watchConfig)
  - [Server parameters](#Server-parameters)
- [Shared parameters](#Shared-parameters)
- [Return value](#return-value)

# startExploring example

> `startExploring` is a function starting a development server that transforms project files configured as explorable into an executable html page.

Implemented in [src/startExploring.js](../../src/startExploring.js), you can use it as shown below.

```js
const { startExploring } = require("@jsenv/core")

startExploring({
  projectDirectoryUrl: "file:///Users/you/project/",
  explorableConfig: {
    "./src/**/*.js": true,
    "./src/whatever/**/*.js": false,
  },
})
```

# Parameters

`startExploring` uses named parameters documented here.

Each parameter got a dedicated section to shortly explain what it does and if it's required or optional.

## explorableConfig

> `explorableConfig` is an object used to configure what files are explorable in your project.

This is an optional parameter with a default value of:

```js
require("@jsenv/core").jsenvExplorableConfig
```

You can find the exact value in [src/jsenvExplorableConfig.js](../../src/jsenvExplorableConfig.js).

`explorableConfig` must be an object where keys are relative or absolute urls. These urls are allowed to contain `*` and `**` that will be used for pattern matching as documented in https://github.com/jsenv/jsenv-url-meta#pattern-matching-behaviour

## htmlFileRelativeUrl

> `htmlFileRelativeUrl` is a relative url string leading to an html file used as template to execute JavaScript files.

This is an optional parameter with a default leading to [src/internal/jsenv-html-file.html](../../src/internal/jsenv-html-file.html).

If you to use a custom html file be sure it contains the following script tag:

```html
<script src="/.jsenv/browser-script.js"></script>
```

This is how the server can arbitrary execute some javaScript inside your custom html file.

## livereloading

> `livereloading` is a boolean controlling if the browser will auto reload when a file is saved.

This is an optional parameter with a default value of:

```js
false
```

Note that any request to a file inside your project is also considered as a dependency that can triggers a reload. It means if your html file or js file loads image or css these files will also be considered as dependency and trigger livereloading when saved.

## watchConfig

> `watchConfig` is an object configuring which files are watched to trigger livereloading.

This is an optional parameter with a default value of:

<!-- prettier-ignore -->
```js
{
  "./**/*": true,
  "./**/.git/": false,
  "./**/node_modules/": false,
}
```

The default value means any file except thoose inside directory named node_modules or git.
`watchConfig` reuse [explorableConfig](#explorableConfig) shape meaning keys are urls with pattern matching.

Example of a custom `watchConfig`:

```js
{
  "./*/**": false,
  "./*": true,
  "./src/**/*": true,
}
```

## Server parameters

Exploring uses two server. The first server is internal to jsenv and compile file dynamically.
The second one is the server you will use to explore your project files.
The defaults values let you use exploring right away but you might want to fix the server port or use your own https certificate for instance.

The following parameter controls the exploring server:

- [protocol](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#protocol)
- [ip](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#ip)
- [port](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#port)
- [forcePort](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#forcePort)
- [logLevel](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#logLevel)

The following parameter controls the jsenv server:

- [compileServerPort](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#port)
- [compileServerLogLevel](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#logLevel)

# Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#jsenvDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)

# Return value

Using the return value is an advanced use case, in theory you should not need this.

`startExploring` return signature is `{ exploringServer, compileServer }`.

`exploringServer` and `compileServer` are server created by `@jsenv/server`. You can read the `@jsenv/server` documentation on the return value to see the shape of these objects.
https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#startServer-return-value.

Code below shows how you might use `exploringServer` return value.

```js
const { exploringServer, compileServer } = await startExploring({
  projectDirectoryUrl: __dirname,
})

exploringServer.stop()
compileServer.stop()
```
