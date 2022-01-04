# Configuring jsenv for react

When your code imports react, it needs to be configured as shown below.

_jsenv.config.mjs for react:_

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

You must also add an [importmap](https://github.com/WICG/import-maps#import-maps) file in your html to remap react imports.

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

The import mappings can be generated programmatically, you can use https://github.com/jsenv/importmap-node-module to do that.

# Configuring jsenv for JSX

If you want to use jsx, you need [@babel/plugin-transform-react-jsx](https://babeljs.io/docs/en/next/babel-plugin-transform-react-jsx.html) in your babel config file.

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
