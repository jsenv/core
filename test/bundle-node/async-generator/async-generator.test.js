// this file was just a test for transform runtie and regenerator
// not working for now

import { bundleNode } from "../../../index.js"

const transformRuntime = import.meta.require("@babel/plugin-transform-runtime")
const transformAsyncToGenerator = import.meta.require("@babel/plugin-transform-async-to-generator")
const transformRegenerator = import.meta.require("@babel/plugin-transform-regenerator")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/async-generator`

// it does not work because we have no strategy to serve regeneratorRuntime
bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "async.js",
  },
  babelConfigMap: {
    "transform-async-to-generator": [transformAsyncToGenerator],
    "transform-regenerator": [transformRegenerator],
    "transform-runtime": [transformRuntime],
  },
  minify: false,
  verbose: true,
})
