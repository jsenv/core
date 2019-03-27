import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const testFolder = `${projectFolder}/src/bundle/browser/test/import-meta-url`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  entryPointsDescription: {
    main: "import-meta-url.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  globalName: "yo",
  minify: false,
  verbose: true,
})
