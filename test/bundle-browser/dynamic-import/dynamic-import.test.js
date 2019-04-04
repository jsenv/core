import { bundleBrowser } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/dynamic-import`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  entryPointMap: {
    main: "dynamic-import.js",
  },
  babelConfigMap: {},
  compileGroupCount: 1,
  globalName: "dynamicImport",
  verbose: false,
})
