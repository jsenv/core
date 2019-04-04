import { bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/balancing`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalName: "balancing",
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  entryPointMap: {
    main: "balancing.js",
  },
  compileGroupCount: 2,
  verbose: true,
  minify: false,
})
