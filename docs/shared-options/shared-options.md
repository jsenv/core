# projectPath

> path leading to a folder that will be considered as the root of your project.

This option is always **required**.<br />
All relative path will be relative to this projectPath option.

A typical project path value would be

```js
"/Users/dmail/project"
```

Very often you would use `__dirname` to provide the project path value.<br />
— see [\_\_dirname documentation on node.js](https://nodejs.org/docs/latest/api/modules.html#modules_dirname)

Note: on windows you would pass `C:\Users\dmail\project`, jsenv is compatible with that.<br/>

# babelPluginMap

> object describing all babel plugin required by your project.

jsenv is meant to run standard JavaScript by default.<br />
For that reason, if you don't pass this option, the value will be:

```js
require("@jsenv/babel-plugin-map").jsenvBabelPluginMap
```

— see [jsenvBabelPluginMap source on github](https://github.com/jsenv/jsenv-babel-plugin-map/blob/a324a0b32e7d31730bab85db869d34e8bbf09933/index.js)

It means standard babel plugin are enabled by default.<br />

If you want to make jsenv compatible with non standard syntaxes you can use your own `babelPluginMap`. For instance, the following code makes jsenv compatible with `jsx`.

```js
const { jsenvBabelPluginMap } = require("@jsenv/babel-plugin-map")
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-react-jsx": [transformReactJSX, { pragma: "dom" }],
}
```

Please note that if you have a `.babelrc` file, jsenv will not read it. jsenv needs to know the list of babel plugin you want to use in an explicit way.

# convertMap

> object describing how to convert some files to modules format.

jsenv works with code written using module format.<br />
For the record module format means you're using `import` and `export`.<br />
If you don't pass this option, the value will be

<!-- prettier-ignore -->
```js
{}
```

Meaning all you project uses module format and nothing needs to be converted.<br />

But if your code or some of your dependencies use an other format you need to convert it to module to make it work with jsenv.<br />
For instance, the following code makes jsenv compatible with `react`.

```js
const { convertCommonJsWithRollup } = require("@jsenv/core")

const convertMap = {
  "/node_modules/react/index.js": convertCommonJsWithRollup,
}
```

# importMapRelativePath

> relative path leading to your project importMap file.

`importMap.json` file is used to remap your imports. The presence of this file is optionnal.<br />

You should read documentation of importMap to understand how jsenv uses this file. It is important because `importMap.json` is mandatory as soon as your project relies on node module resolution to find a file.<br />
— see [importMap documentation](../import-map/import-map.md)

If you don't pass this option, the default value will be:

```js
"/importMap.json"
```

# importDefaultExtension

> Extension suffixed to any import without extension

jsenv will not try different extension and choose the right one. This option only adds an extension on extensionless import.<br />

When `true` extensionless import inherits file extension.<br />
If you don't pass `importDefaultExtension`, its value will be:

```js
true
```

Expecting a tool to guess extension introduces subtle complexity in a lot of cases. You will be forced to rely on magic extension when one of your dependency contains one or more extensionless import.<br />
This is why the default value is `true` for now.

# compileIntoRelativePath

> Folder used to cache the compiled files.

Every time a file is compiled, the compiled version of the file is written into that folder. Alongside with the compiled file we store some metadata on the source used to generate the compiled version. We can use these informations later to know if the cache is still valid.

If you don't pass this option, the default value will be:

```js
"/.dist"
```
