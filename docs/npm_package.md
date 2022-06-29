# Using a NPM package

Let's say you want to execute the following HTML using a package called "amazing-package".

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      import { doSomethingAmazing } from "amazing-package"

      doSomethingAmazing()
    </script>
  </body>
</html>
```

You need to do the following:

1. Check package exports
2. Adapt to the module format

## 1. Check package exports

The way to use a NPM package depends on how it's written. Especially the file you will import from this package.

Check the files exported by the package, how they are written and deduce the module format.

| Code found in the file      | Module format |
| --------------------------- | ------------- |
| `import`, `export`          | ESModule      |
| `require`, `module.exports` | CommonJS      |
| `window.name = value`       | Global        |

If several format are available, choose the one you want to use.

## 2. Adapt to the module format

According to module format deduced at step 1, do one of the following:

- ESModule

  For most cases you're good to go.

- CommonJS

  A browser cannot execute code written in CommonJS, it was invented by and for Node.js. You need to convert code to import/export.

  In _jsenv.config.mjs_:

  ```js
  import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs"

  export const plugins = [
    jsenvPluginCommonJs({
      include: {
        "/**/node_modules/amazing-package/": true,
      },
    }),
  ]
  ```

  ```console
  npm install --save-dev @jsenv/plugin-commonjs
  ```

- Global

  Import and simply read what was written on `window`. See the example below applied to jQuery.

  ```js
  import "jquery"

  const jquery = window.$
  ```
