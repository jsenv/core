import { bundleBrowser } from "../../../index.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/without-balancing`

bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  globalName: "withoutBalancing",
  babelConfigMap,
  entryPointMap: {
    main: "without-balancing.js",
  },
  verbose: true,
  minify: false,
})
