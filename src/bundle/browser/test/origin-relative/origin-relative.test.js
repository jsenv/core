import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/origin-relative`

bundleBrowser({
  projectFolder,
  into: "dist/browser",
  globalName: "originRelative",
  entryPointsDescription: {
    main: "origin-relative.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
