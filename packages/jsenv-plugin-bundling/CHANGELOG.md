# 2.1.0

- Disable exports minification by rollup (it breaks inline content static analysis)
- Update rollup to 3.20.0

# 2.0.0

- Remove `js_module.customChunks`
- Remove `js_module.babelHelpersChunk`
- Remove `js_module.vendorsChunk`
- Vendor chunk is no longer auto generated, it must be done explicitely as follows

  ```js
  jsenvPluginBundling({
    js_module: {
      chunks: {
        vendors: { "./**/node_modules/": true },
      },
    },
  })
  ```

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
