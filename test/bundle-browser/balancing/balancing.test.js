import { bundleBrowser } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/balancing`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  babelConfigMap: {
    "transform-async-to-promises": [transformAsyncToPromises],
  },
  entryPointMap: {
    main: "balancing.js",
  },
  compileGroupCount: 2,
  verbose: true,
  minify: false,
})
