import { bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../projectFolder.js")

const testFolder = `${projectFolder}/test/bundle-browser/debugger`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalPromiseName: "debug",
  entryPointMap: {
    main: "debugger.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
