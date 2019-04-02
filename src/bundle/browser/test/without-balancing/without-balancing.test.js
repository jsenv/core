import { babelPluginDescription } from "/node_modules/@jsenv/babel-plugin-description/index.js"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const testFolder = `${projectFolder}/src/bundle/browser/test/without-balancing`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalName: "withoutBalancing",
  babelConfigMap: babelPluginDescription,
  entryPointMap: {
    main: "without-balancing.js",
  },
  verbose: true,
})
