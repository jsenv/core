# 1.3.0

- Introduce `js_module.customChunks`

  - By default will generate a file named `vendors.js` for all files inside node_modules
  - Can be configured as follows

  ```js
  jsenvPluginBundling({
    js_module: {
      customChunks: {
        // "vendors.js" regroup code of files from "node_modules/" and "vendors/"
        vendors: {
          "./**/node_modules/": true,
          "./vendors/": true,
        },
      },
    },
  })
  ```

# 1.2.0

- Call `manualChunks` that would be passed in `js_module.rollupOutput`

  ```js
  jsenvPluginBundling({
    js_module: {
      rollupOutput: {
        manualChunks: () => {},
      },
    },
  })
  ```
