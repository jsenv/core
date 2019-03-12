import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/debugger`

bundleBrowser({
  projectFolder,
  into: "dist/browser",
  globalPromiseName: "debug",
  entryPointsDescription: {
    main: "debugger.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
