import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

bundleBrowser({
  projectFolder,
  into: "bundle/browser",
  globalName: "single",
  entryPointsDescription: {
    main: "src/bundle/browser/test/single/single.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
})
