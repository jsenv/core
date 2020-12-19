import { buildProject, getBabelPluginMapForNode } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.js"

buildProject({
  ...jsenvConfig,
  format: "commonjs",
  babelPluginMap: getBabelPluginMapForNode(),
  buildDirectoryRelativeUrl: "packages/jsenv-vue/dist/commonjs",
  entryPointMap: {
    "./packages/jsenv-vue/main.js": "./main.cjs",
  },
  buildDirectoryClean: true,
})
