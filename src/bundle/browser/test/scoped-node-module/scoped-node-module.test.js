import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../../projectFolder.js"
import { generateImportMapForProjectNodeModules } from "../../../../import-map/generateImportMapForProjectNodeModules.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/scoped-node-module`

;(async () => {
  const importMap = await generateImportMapForProjectNodeModules({ projectFolder })

  await bundleBrowser({
    projectFolder,
    importMap,
    into: "dist/browser",
    globalName: "scopedFoo",
    entryPointMap: {
      main: "scoped-node-module.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    verbose: true,
  })

  // here we could assert some stuff
})()
