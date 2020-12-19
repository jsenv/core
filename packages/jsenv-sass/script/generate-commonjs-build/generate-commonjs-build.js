import { buildProject, getBabelPluginMapForNode } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.js"

buildProject({
  ...jsenvConfig,
  format: "commonjs",
  babelPluginMap: getBabelPluginMapForNode(),
  buildDirectoryRelativeUrl: "packages/jsenv-sass/dist/commonjs",
  entryPointMap: {
    "./packages/jsenv-sass/main.js": "./main.cjs",
  },
  buildDirectoryClean: true,
})
