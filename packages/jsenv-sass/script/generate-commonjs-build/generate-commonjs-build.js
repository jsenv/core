import { buildProject, getBabelPluginMapForNode } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.js"

buildProject({
  ...jsenvConfig,
  format: "commonjs",
  entryPointMap: {
    "./packages/jsenv-sass/main.js": "./packages/jsenv-sass/dist/commonjs/main.cjs",
  },
  babelPluginMap: getBabelPluginMapForNode(),
  buildDirectoryClean: true,
})
