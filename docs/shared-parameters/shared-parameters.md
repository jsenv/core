# Table of contents

- [projectDirectoryPath](#projectDirectoryPath)
- [babelPluginMap](#babelPluginMap)
- [convertMap](#convertMap)
- [importMapFileRelativePath](#importMapFileRelativePath)
- [importDefaultExtension](#importDefaultExtension)
- [compileCacheDirectoryRelativePath](#compileCacheDirectoryRelativePath)

## projectDirectoryPath

> `projectDirectoryPath` is a string leading to your project directory.

This parameter is **required**, an example value could be:

```js
"/Users/dmail/project"
```

windows path, like `C:\Users\you\folder` are valid.<br />
file url, like `file:///Users/you/folder`, are valid.<br />

You can use `__dirname` to provide the value.<br />
— see [\_\_dirname documentation on node.js](https://nodejs.org/docs/latest/api/modules.html#modules_dirname)

Note: All parameter ending with `relativePath` are resolved against `projectDirectoryPath`.

## babelPluginMap

> `babelPluginMap` is an object describing all babel plugin used by your project.

This parameter is optionnal with a default value of:

```js
require("@jsenv/core").jsenvBabelPluginMap
```

jsenv is meant to run standard JavaScript by default so the default `babelPluginMap` enable standard babel plugins.<br />
— see [@jsenv/babel-plugin-map on github](https://github.com/jsenv/jsenv-babel-plugin-map/blob/master/index.js#L31)

If you want to make jsenv compatible with non standard syntaxes you can use your own `babelPluginMap`. For instance, the following code makes jsenv compatible with `jsx`.

```js
const { jsenvBabelPluginMap } = require("@jsenv/core")
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-react-jsx": [transformReactJSX, { pragma: "dom" }],
}
```

Please note that if you have a `.babelrc` file, jsenv will not read it. jsenv needs to know the list of babel plugin you want to use in an explicit way.

## convertMap

> `convertMap` is an object describing how to convert files to modules format.

This parameter is optionnal with a default value of

<!-- prettier-ignore -->
```js
{}
```

The default value means all your project files uses modules format and nothing needs to be converted.

But if your code or some of your dependencies use an other format you need to convert it using this parameter.<br />
For instance, the following code makes jsenv compatible with `react`.

```js
const { convertCommonJsWithRollup } = require("@jsenv/core")

const convertMap = {
  "./node_modules/react/index.js": convertCommonJsWithRollup,
}
```

## importMapFileRelativePath

> `importMapRelativePath` is a string representing a relative path to a file containing import map.

This parameter is optional with a default value of

```js
"./importMap.json"
```

The file presence is optional. You need this file as soon as you use an import that is not explicitely targeting a file like:

```js
import whatever from "foo"
```

You should read importMap specification to understand how it works.<br />
— see [importMap documentation](../import-map/import-map.md)

See also [jsenv-node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map) github repository capable to generate automatically importMap file for your node modules.

## importDefaultExtension

> `importDefaultExtension` is a boolean or a string controlling if an extension is added to import without any.

This parameter is optional with a default value of

```js
true
```

When `true` extensionless import inherits file extension.<br />
When a string, extensionless import get suffixed by that string.

As you are forced to rely on magic extension when one of your dependency contains one or more extensionless import, `importDefaultExtension` is `true` by default.<br />
But expecting a tool to guess extension introduces complexity and makes you dependent on magic extensions configuration and implementation.

This option only adds an extension on extensionless import, it cannot try different extension and choose the right one.

## compileCacheDirectoryRelativePath

> `compileCacheDirectoryRelativePath` is a string leading to a directory used to cache compiled version of your files.

This parameter is optional with a default value of

```js
"./.dist"
```

Every time a file is compiled, the compiled version of the file is written into that directory. Alongside with the compiled file, some metadata on the source used to generate the compiled version is written. These metadata are used later to know if the cache is still valid.
