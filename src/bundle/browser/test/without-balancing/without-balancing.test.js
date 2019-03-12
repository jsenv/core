import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/without-balancing`

bundleBrowser({
  projectFolder,
  into: "dist/browser",
  globalName: "withoutBalancing",
  entryPointsDescription: {
    main: "without-balancing.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  verbose: true,
})
