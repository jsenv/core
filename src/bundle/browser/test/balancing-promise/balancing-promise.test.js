import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const testFolder = `${projectFolder}/src/bundle/browser/test/balancing-promise`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  globalName: "balancing",
  globalNameIsPromise: true,
  entryPointsDescription: {
    main: "balancing-promise.js",
  },
  compileGroupCount: 2,
  verbose: true,
  minify: false,
})
