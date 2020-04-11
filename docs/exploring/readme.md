# Table of contents

- [Exploring presentation](#Exploring-presentation)
- [Exploring recorded video](#Exploring-recorded-video)
- [Exploring concrete example](#Exploring-concrete-example)
  - [1 - Setup basic project](#1---Setup-basic-project)
  - [2 - Explore basic project](#2---Explore-basic-project)
- [Exploring integration](#Exploring-integration)
- [startExploring example](#startExploring-example)
- [startExploring parameters](#startExploring-parameters)
  - [explorableConfig](#ExplorableConfig)
  - [htmlFileRelativeUrl](#htmlFileRelativeUrl)
  - [livereloading](#livereloading)
  - [watchConfig](#watchConfig)
  - [Server parameters](#Server-parameters)
  - [Shared parameters](#Shared-parameters)
- [startExploring return value](#startExploring-return-value)

# Exploring presentation

Frontend projects often comes with a local server running on your machine.

These type of servers focuses on development. During development files change often and developper want a fast feedback to see effects of thoose changes.

You can use jsenv to start a server serving an html page containing a list of links to your project files. Each link goes to an url where your JavaScript file will be executed. Thanks to this, any file in your project can become an entry point. You can use it to debug a file in isolation, create a storybook and so on.

Jsenv call this `exploring`.

# Exploring recorded video

The following video was recorded to show exploring feature in action on a basic project. The developper debugs `hello.js` file inside chrome.

![recording of me exploring a project using chrome](./exploring-with-chrome-recording.gif)
<br />
— gif generated from [./exploring-with-chrome-recording.mp4](./exploring-with-chrome-recording.mp4)

To reproduce the environment in this gif you can follow the next part.

# Exploring concrete example

This part helps you to setup a project on your machine to play with jsenv exploring.<br />
You can also reuse the project file structure to understand how to integrate jsenv to explore your own project files.

## 1 - Setup basic project

```console
git clone https://github.com/jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/exploring/basic-project
```

```console
npm install
```

## 2 - Explore basic project

Check your Node.js version

```console
node -v
```

- If node version > 12

  ```console
  node ./start-exploring.js
  ```

- If node version < 13
  ```console
  node ./start-exploring.cjs
  ```

A first server will start. This one is used by the whole jsenv project.<br />
A second server will start. That's the one we're interested in right now. The url `http://127.0.0.1:3456` is logged in your terminal.<br />

Once server is started you can navigate to `http://127.0.0.1:3456` and you will see an html page listing the files you can explore.

![exploring chome screenshot](./exploring-chrome-screenshot.png)

- If you go to `http://127.0.0.1:3456/src/hello.js` page displays `Hello world`.
  It shows that if your file execution renders something, you can see the effect in your browser.
- If you go to `http://127.0.0.1:3456/src/text.js` nothing special will happen because `/src/text.js` is just a module with an export default.<br />
  It shows that even if your file do not render anything, you still can use this functionnality to debug your file.

Now you have seen a basic example it's time to integrate it in your own project.

# Exploring integration

1. Go to your project root directory

   ```console
   cd /your-project
   ```

2. Install `@jsenv/core` to your dependencies.

   ```console
   npm install --save-dev @jsenv/core
   ```

3. Create a file to start the exploring server

   If your node version is above 13 and your `package.json` contains `"type": "module"`, copy [jsenv-core/docs/exploring/basic-project/start-exploring.js](./basic-project/start-exploring.js) into your project.

   Otherwise copy [jsenv-core/docs/exploring/basic-project/start-exploring.cjs](./basic-project/start-exploring.cjs).

4. Execute start exploring file

   At this point exploring server will start in your project. Check `startExploring` documentation below.

# startExploring example

`startExploring` is an async function starting a development server that transforms project files configured as explorable into an executable html page.

```js
import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: "file:///Users/you/project/",
  explorableConfig: {
    "./src/**/*.js": true,
    "./src/whatever/**/*.js": false,
  },
})
```

— source code at [src/startExploring.js](../../src/startExploring.js).

# startExploring parameters

Each named parameter got a dedicated section to shortly explain what it does and if it's required or optional.

When you change a parameter don't forget to restart the server.

## explorableConfig

`explorableConfig` parameter is an object used to configure what files are explorable in your project. This is an optional parameter with a default value configured to match jsenv file structure. The exact value can be found in [src/jsenvExplorableConfig.js](../../src/jsenvExplorableConfig.js).

This parameter must be an object where keys are relative or absolute urls. These urls are allowed to contain `*` and `**` that will be used for pattern matching as documented in https://github.com/jsenv/jsenv-url-meta#pattern-matching-behaviour

## htmlFileRelativeUrl

`htmlFileRelativeUrl` parameter is a relative url string leading to an html file used as template to execute JavaScript files. This is an optional parameter with a default leading to [src/internal/jsenv-html-file.html](../../src/internal/jsenv-html-file.html).

If you to use a custom html file be sure it contains the following script tag:

```html
<script src="/.jsenv/browser-script.js"></script>
```

This is how the server can arbitrary execute some javaScript inside your custom html file.

## livereloading

`livereloading` parameter is a boolean controlling if the browser will auto reload when a file is saved. This is an optional parameter with a default value of `false`.

Note that any request to a file inside your project is also considered as a dependency that can triggers a reload. It means if your html file or js file loads image or css these files will also be considered as dependency and trigger livereloading when saved.

## watchConfig

`watchConfig` parameter is an object configuring which files are watched to trigger livereloading. This is an optional parameter with a default value configured to watch everything except git and node_modules directories. `watchConfig` reuse [explorableConfig](#explorableConfig) shape meaning keys are urls with pattern matching.

Example of a custom `watchConfig`:

```js
{
  "./*/**": false,
  "./*": true,
  "./src/**/*": true,
}
```

## Server parameters

Exploring uses two server:

- A server used by jsenv to compile file dynamically called `compile server`.
- A server used to explore your project files called `exploring server`.

The defaults values let you use exploring right away but you might want to configure the exploring server port or use your own https certificate for instance.

The following parameter controls the exploring server:

- [protocol](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#protocol)
- [ip](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#ip)
- [port](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#port)
- [forcePort](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#forcePort)
- [logLevel](https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#logLevel)

The following parameter controls the compile server:

- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerPort](../shared-parameters.md#compileServerPort)

In order to communicate exploring server and compile server must use the same protocol (http or https). For that reason compile server reuses `protocol`, `ip`, `privateKey`, and `certificate` of the exploring server.

# Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#jsenvDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)

# startExploring return value

Using the return value is an advanced use case, in theory you should not need this.

`startExploring` return signature is `{ exploringServer, compileServer }`.

`exploringServer` and `compileServer` are server created by `@jsenv/server`. You can read the `@jsenv/server` documentation on the return value to see the shape of these objects.
https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#startServer-return-value.

Code below shows how you might use return value.

```js
import { startExploring } from "@jsenv/core"

const { exploringServer, compileServer } = await startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
})

exploringServer.stop()
compileServer.stop()
```
