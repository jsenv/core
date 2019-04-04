import { bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/balancing-promise`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  globalName: "balancing",
  globalNameIsPromise: true,
  entryPointMap: {
    main: "balancing-promise.js",
  },
  compileGroupCount: 2,
  verbose: true,
  minify: false,
})
