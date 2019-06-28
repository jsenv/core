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

If you have a `.babelrc` file, jsenv will not read it. jsenv needs to know the list of babel plugin you want to use in an explicit way.

##### Custom babelPluginMap example

jsenv is meant to run regular JavaScript. `babelPluginMap` can be extended to make it compatible with `jsx` for instance.

```js
const { jsenvBabelPluginMap } = require("@jsenv/babel-plugin-map")
const transformReactJSX = require("@babel/plugin-transform-react-jsx")

const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-react-jsx": [transformReactJSX, { pragma: "dom" }],
}
```

If you don't pass this option, the default value will be:

```js
require("@jsenv/babel-plugin-map").jsenvBabelPluginMap
```

Default value comes from https://github.com/jsenv/jsenv-babel-plugin-map.

# importMapRelativePath

> relative path leading to your project importMap file.

`importMap.json` file is used to remap your imports. The presence of this file is optionnal.<br />

You should read documentation of importMap to understand how jsenv uses this file. It is important because `importMap.json` is mandatory as soon as your project relies on node module resolution to find a file.<br />
— see [importMap documentation](../import-map/import-map.md)

If you don't pass this option, the default value will be:

```js
"/importMap.json"
```

# compileIntoRelativePath

> Folder used to cache the compiled files.

Every time a file is compiled, the compiled version of the file is written into that folder. Alongside with the compiled file we store some metadata on the source used to generate the compiled version. We can use these informations later to know if the cache is still valid.

If you don't pass this option, the default value will be:

```js
"/.dist"
```
