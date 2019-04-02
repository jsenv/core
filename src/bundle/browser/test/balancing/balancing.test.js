import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const testFolder = `${projectFolder}/src/bundle/browser/test/balancing`

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
