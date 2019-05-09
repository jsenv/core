/**
 * jsenv do not use transform-async-to-generator
 * and should prefer transform-async-to-promises anyway.
 *
 * However it would be cool that it supports yield keyword and generator in general.
 * For now it's not the case because we do not inject babelRuntimeGenerator to the bundle
 * or the client during development because there is no polyfill strategy
 * for now.
 */

// import { assert } from "@dmail/assert"
// import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
// import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
// import { bundleNode } from "../../../index.js"
// import { importNodeBundle } from "../import-node-bundle.js"

// const transformAsyncToGenerator = import.meta.require("@babel/plugin-transform-async-to-generator")
// const transformRegenerator = import.meta.require("@babel/plugin-transform-regenerator")

// const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
// const projectFolder = `${ROOT_FOLDER}`
// const bundleInto = `${testFolderRelative}/dist/node`

// // it does not work because we have no strategy to serve regeneratorRuntime
// await bundleNode({
//   projectFolder,
//   into: bundleInto,
//   entryPointMap: {
//     main: `${testFolderRelative}/async.js`,
//   },
//   babelConfigMap: {
//     "transform-async-to-generator": [transformAsyncToGenerator],
//     "transform-regenerator": [transformRegenerator],
//   },
//   logBundleFilePaths: false,
// })

// const { namespace: actual } = await importNodeBundle({
//   bundleFolder: `${projectFolder}/${bundleInto}`,
//   file: `main.js`,
// })
