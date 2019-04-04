import { bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../projectFolder.js")

const testFolder = `${projectFolder}/test/bundle-browser/import-meta-url`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  entryPointMap: {
    main: "import-meta-url.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  globalName: "yo",
  minify: false,
  verbose: true,
})
