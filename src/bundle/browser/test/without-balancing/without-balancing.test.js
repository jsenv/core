import { bundleBrowser } from "../../bundleBrowser.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")
const { projectFolder } = import.meta.require("../../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/bundle/browser/test/without-balancing`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalName: "withoutBalancing",
  babelConfigMap,
  entryPointMap: {
    main: "without-balancing.js",
  },
  verbose: true,
})
