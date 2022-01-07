# Using react

```console
npm i react
npm i react-dom
```

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

You must also add an [importmap](https://github.com/WICG/import-maps#import-maps) file in your html to remap react imports. It`s recommended to use [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map) for this task.

The generated importmap will look as below.

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

```console
npm i preact
```

You must also add an [importmap](https://github.com/WICG/import-maps#import-maps) file in your html to remap preact imports. It`s recommended to use [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map) for this task.

The generated importmap will look as below.

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
