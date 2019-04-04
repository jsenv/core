import { generateImportMapForProjectNodeModules, bundleBrowser } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../projectFolder.js")

const testFolder = `${projectFolder}/test/bundle-browser/scoped-node-module`

;(async () => {
  const importMap = await generateImportMapForProjectNodeModules({ projectFolder })

  await bundleBrowser({
    projectFolder: testFolder,
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
