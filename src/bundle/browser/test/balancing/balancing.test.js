import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

bundleBrowser({
  projectFolder,
  into: "bundle/browser",
  globalName: "balancing",
  entryPointsDescription: {
    main: "src/bundle/browser/test/balancing/balancing.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 2,
  verbose: true,
})
