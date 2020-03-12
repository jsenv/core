# Table of contents

- [projectDirectoryUrl](#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](#jsenvDirectoryRelativeUrl)
- [babelPluginMap](#babelPluginMap)
- [convertMap](#convertMap)
- [importMapFileRelativeUrl](#importMapFileRelativeUrl)
- [importDefaultExtension](#importDefaultExtension)
- [compileServerLogLevel](#compileServerLogLevel)
- [compileServerProtocol](#compileServerProtocol)
- [compileServerPrivateKey](#compileServerPrivateKey)
- [compileServerCertificate](#compileServerCertificate)
- [compileServerIp](#compileServerIp)
- [compileServerPort](#compileServerPort)
- [chromiumExecutablePath](#chromiumExecutablePath)
- [firefoxExecutablePath](#firefoxExecutablePath)
- [webkitExecutablePath](#webkitExecutablePath)

# projectDirectoryUrl

`projectDirectoryUrl` parameter is a string leading to your project directory. This parameter is **required**, an example value could be `"file:///Users/you/project"`. All parameter containing `relativeUrl` in their name are resolved against `projectDirectoryUrl`. It is recommended to pass an url string leading to a directory. But a windows file path, linux/mac file path or URL object works.

```js
"/Users/you/project" // linux/mac file path
"C:\\Users\\you\\project" // windows file path
new URL("file:///Users/you/project") // URL object
```

You can put a trailing slash in `projectDirectoryUrl` value if you want.
You can use `__dirname` to provide the value inside commonjs file.

```js
const { resolve } = require("path")

const projectDirectoryUrl = resolve("../", __dirname)
```

— see [\_\_dirname documentation on node.js](https://nodejs.org/docs/latest/api/modules.html#modules_dirname)

You can use `import.meta.url` to provide the value inside a module file (node 13+).

```js
const projectDirectoryUrl = new URL("./", import.meta.url)
```

# jsenvDirectoryRelativeUrl

`jsenvDirectoryRelativeUrl` parameter is a string leading to a directory used by jsenv to write compiled version of your files. This parameter is optional with a default value of `"./.jsenv/"`. Every time a file is compiled, the compiled version of the file is written into that directory. Alongside with the compiled file, some metadata on the source used to generate the compiled version is written. These metadata are used later to know if the compiled version is still valid.

# babelPluginMap

`babelPluginMap` parameter is an object describing all babel plugin used by your project. This parameter is optionnal with a default value enabling standard babel plugins. See [src/jsenvBabelPluginMap.js](../src/jsenvBabelPluginMap.js). If you want to make jsenv compatible with non standard syntaxes you can use your own `babelPluginMap`. For instance, the following code makes jsenv compatible with `jsx`.

```js
const { jsenvBabelPluginMap } = require("@jsenv/core")
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-react-jsx": [transformReactJSX, { pragma: "dom" }],
}
```

Please note that if you have a `.babelrc` file, jsenv will not read it. jsenv needs to know the list of babel plugin you want to use in an explicit way.

# convertMap

`convertMap` parameter is an object describing how to convert files to modules format.This parameter is optionnal with a default value of `{}`. The default value means all your project files uses modules format and nothing needs to be converted.

But if your code or some of your dependencies use an other format you need to convert it using this parameter. For instance, the following code makes jsenv compatible with `react`.

```js
import { convertCommonJsWithRollup } from "@jsenv/core"

const convertMap = {
  "./node_modules/react/index.js": convertCommonJsWithRollup,
}
```

# importMapFileRelativeUrl

`importMapFileRelativeUrl` parameter is a string representing a relative url to a file containing import map. This parameter is optional with a default value of `"./importMap.json"`. The file presence becomes mandatory if you use `import.meta` in your codebase. You need this file as soon as you use an import that is not explicitely targeting a file like:

```js
import whatever from "foo"
```

You should read importMap specification to understand how it works.<br />
— see [importMap spec](https://github.com/WICG/import-maps)

See also [jsenv-node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map) github repository capable to generate automatically importMap file for your node modules.

# importDefaultExtension

`importDefaultExtension` parameter is a boolean or a string controlling if an extension is added to import without any. This parameter is optional and enabled by default.

When enabled extensionless import inherits file extension. When a string, extensionless import get suffixed by that string.

As you are forced to rely on magic extension when one of your dependency contains one or more extensionless import, `importDefaultExtension` is `true` by default. But expecting a tool to guess extension introduces complexity and makes you dependent on magic extensions configuration and implementation.

This parameter only adds an extension on extensionless import, it cannot try different extension and choose the right one.

# compileServerLogLevel

`compileServerLogLevel` parameter is a string controlling verbosity of the compile server. This parameter is optional with a default value of `"info"`. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#logLevel.

# compileServerProtocol

`compileServerProtocol` parameter is a string controlling the protocol used by jsenv compile server. This parameters is optional with a default value of `"https"`. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#port.

# compileServerPrivateKey

`compileServerPrivateKey` parameter is a string containing a privateKey that will be used for https encryption. This parameter is optional. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#privateKey.

# compileServerCertificate

`compileServerCertificate` parameter is a string containing a certificate that will be used for https encryption. This parameter is optional. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#certificate.

# compileServerIp

`compileServerIp` parameter is a string controlling the ip jsenv compile server will listen to. This parameter is optional with a default value of `"127.0.0.1"`. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#ip.

# compileServerPort

`compileServerPort` parameter is a number controlling the port jsenv compile server will listen to. This parameter is optional with a default value of `0` meaning a random available port will be used. For more information check https://github.com/jsenv/jsenv-server/blob/master/docs/start-server.md#port.

# chromiumExecutablePath

`chromiumExecutablePath` is a string leading to a chromium executable file. It is used internally by playwright to launch a chromium browser.

It's easier to let `playwright-chromium` decide this value for you by adding it to your dependencies as documented in [Browser launchers](./launcher.md#Browser-launchers).

# firefoxExecutablePath

`firefoxExecutablePath` is a string leading to a firefox executable file. It is used internally by playwright to launch a firefox browser.

It's easier to let `playwright-firefox` decide this value for you by adding it to your dependencies as documented in [Browser launchers](./launcher.md#Browser-launchers).

# webkitExecutablePath

`webkitExecutablePath` is a string leading to a webkit executable file. It is used internally by playwright to launch a webkit browser.

It's easier to let `playwright-webkit` decide this value for you by adding it to your dependencies as documented in [Browser launchers](./launcher.md#Browser-launchers).
