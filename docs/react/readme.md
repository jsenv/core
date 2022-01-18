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

As documented in [2. Remap package with importmap](./npm_package.md#2-remap-package-with-importmap), remap "react" and "react-dom" using an importmap.

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

3 - Convert react from CommonJS to JS modules

As documented in [3. Adapt to the module format](./npm_package.md#3-adapt-to-module-format), convert "react" and "react-dom" to import/export.

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

# Using preact

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

As documented in [2. Remap package with importmap](./npm_package.md#2-remap-package-with-importmap), remap "preact" using an importmap.

```html
<script type="importmap">
  {
    "imports": {
      "preact": "./node_modules/preact/dist/preact.module.js",
      "preact/hooks": "./node_modules/preact/hooks/dist/hooks.module.js"
    }
  }
</script>
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
