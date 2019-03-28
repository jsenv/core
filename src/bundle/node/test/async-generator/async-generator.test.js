import transformAsyncToGenerator from "@babel/plugin-transform-async-to-generator"
import transformRegenerator from "@babel/plugin-transform-regenerator"
import transformRuntime from "@babel/plugin-transform-runtime"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

const testFolder = `${projectFolder}/src/bundle/node/test/async-generator`

// it does not work because we have no strategy to serve regeneratorRuntime
bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointsDescription: {
    main: "async.js",
  },
  babelPluginDescription: {
    "transform-async-to-generator": [transformAsyncToGenerator],
    "transform-regenerator": [transformRegenerator],
    "transform-runtime": [transformRuntime],
  },
  minify: false,
  verbose: true,
})
