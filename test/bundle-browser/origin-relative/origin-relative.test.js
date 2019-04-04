import { bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../projectFolder.js")

const testFolder = `${projectFolder}/test/bundle-browser/origin-relative`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalName: "originRelative",
  entryPointMap: {
    main: "origin-relative.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
