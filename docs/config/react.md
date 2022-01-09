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

Read more in [Importing code written in CommonJS](./commonjs.md)

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

# Using preact

```js
import { h, render } from "preact"

render(h("span", {}, "Hello world"), document.querySelector("#root"))
```

The code above is using preact, it cannot be runned directly by the browser. To make it possible follow the steps below.

1 - Install preact

```console
npm i preact
```

2 - Remap preact imports using an importmap

Add the following import mappings to your HTML file.

```html
<script type="importmap">
  {
    "imports": {
      "preact": "../node_modules/preact/dist/preact.module.js"
    },
    "scopes": {
      "../node_modules/preact/": {
        "../node_modules/preact/compat/src/PureComponent": "../node_modules/preact/compat/src/PureComponent.js",
        "../node_modules/preact/compat/src/suspense-list": "../node_modules/preact/compat/src/suspense-list.js",
        "../node_modules/preact/compat/src/forwardRef": "../node_modules/preact/compat/src/forwardRef.js",
        "../node_modules/preact/compat/src/Children": "../node_modules/preact/compat/src/Children.js",
        "../node_modules/preact/compat/src/suspense": "../node_modules/preact/compat/src/suspense.js",
        "../node_modules/preact/compat/src/portals": "../node_modules/preact/compat/src/portals.js",
        "../node_modules/preact/compat/src/render": "../node_modules/preact/compat/src/render.js",
        "../node_modules/preact/compat/src/memo": "../node_modules/preact/compat/src/memo.js",
        "../node_modules/preact/compat/src/util": "../node_modules/preact/compat/src/util.js",
        "preact/devtools": "../node_modules/preact/devtools/dist/devtools.module.js"
      }
    }
  }
</script>
```

Read more about importmap and how to generate it programmatically in [Using a NPM package](./npm_package.md).

3 - Configure "pragma" for preact

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

# Using preact + react-redux

If you use a package depending on react (like react-redux) you must add the following to your importmap

```diff
{
  "imports": {
    "react": "./node_modules/react/index.js",
    "react-dom": "./node_modules/react-dom/index.js"
- }
+ },
+ "scopes": {
+    "./node_modules/react-redux/": {
+      react: "./node_modules/preact/compat/src/index.js",
+      "react-dom": "./node_modules/preact/compat/src/index.js",
+    }
+  }
}
```
