import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/balancing`

bundleBrowser({
  projectFolder,
  into: "dist/browser",
  globalPromiseName: "balancing",
  entryPointsDescription: {
    main: "balancing.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 2,
  verbose: true,
})
