# Using react

> If you want to use preact instead check [Using preact](#Using-preact)

```js
import React from "react"
import ReactDOM from "react-dom"

ReactDOM.render(
  React.createElement("span", {}, "Hello world"),
  document.querySelector("#root"),
)
```

The code above is using react, it cannot be runned directly by the browser. To make it possible follow the steps below.

1 - Install "react" and "react-dom"

```console
npm i react
npm i react-dom
```

2 - Remap react imports using an importmap

The following import mappings must be added to your HTML file.

```html
<script type="importmap">
  {
    "imports": {
      "react": "./node_modules/react/index.js",
      "react-dom": "./node_modules/react-dom/index.js"
    }
  }
</script>
```

Read more about importmap and how to generate it programmatically in [Using a NPM package](./npm_package.md).

3 - Convert react from CommonJS to JS modules

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

// "react" and "react-dom" are written in commonJs, they
// must be converted to javascript modules
// see https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customCompilers
export const customCompilers = {
  "./node_modules/react/index.js": commonJsToJavaScriptModule,
  "./node_modules/react-dom/index.js": (options) => {
    return commonJsToJavaScriptModule({ ...options, external: ["react"] })
  },
}
```

# Using JSX

If you want to use JSX, you need [@babel/plugin-transform-react-jsx](https://babeljs.io/docs/en/next/babel-plugin-transform-react-jsx.html) in your babel config file.

```console
npm i --save-dev @babel/plugin-transform-react-jsx
```

_babel.config.cjs for JSX_:

```js
module.exports = {
  presets: ["@jsenv/babel-preset"],
  plugins: [
    [
      "@babel/plugin-transform-react-jsx",
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
}
```

## Using preact

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      import { h, render } from "preact"

      render(h("span", {}, "Hello world"), document.querySelector("#root"))
    </script>
  </body>
</html>
```

The code above is using preact, it cannot be runned directly by the browser. To make it possible follow the steps below.

1 - Install preact

```console
npm i preact
```

2 - Remap preact imports using an importmap

Preact needs many mappings to work because the source code contains import omitting file extension. So here it's recommended to generate import mappings programmatically.

```console
npm i --save-dev @jsenv/importmap-node-module
```

Create a file _importmap.mjs_:

```js
import { writeImportMapFiles } from "@jsenv/importmap-node-module"

await writeImportMapFiles({
  projectDirectoryUrl: new URL("./", import.meta.url),
  importMapFiles: {
    "./project.importmap": {
      runtime: "browser",
      mappingsForNodeResolution: true,
      manualImportMap: {
        scopes: {
          // can be removed if you don't use redux: remap "react" to "preact" for "react-redux"
          "./node_modules/react-redux/": {
            "react": "./node_modules/preact/compat/src/index.js",
            "react-dom": "./node_modules/preact/compat/src/index.js",
          },
        },
      },
      entryPointsToCheck: ["./main.html"],
      extensionlessAutomapping: true,
      magicExtensions: [".js"],
      packageUserConditions: ["development"],
      removeUnusedMappings: true,
    },
  },
  // can be removed if you don't use redux: fix the "react-redux" and "redux" exports field
  packagesManualOverrides: {
    "react-redux": {
      exports: {
        import: "./es/index.js",
      },
    },
    "redux": {
      exports: {
        import: "es/redux.js",
      },
    },
  },
})
```

Gneerate "project.importmap"

```console
node ./importmap.mjs
```

Finally add "project.importmap" to the HTML file.

```diff
+ <script type="importmap" src="./project.importmap"></script>
```

3 - Configure "pragma" for preact (if you use JSX)

In _babel.config.cjs_:

```diff
module.exports = {
  presets: ["@jsenv/babel-preset"],
  plugins: [
    [
      "@babel/transform-react-jsx",
      {
-       pragma: "React.createElement",
+       pragma: "h"
```
