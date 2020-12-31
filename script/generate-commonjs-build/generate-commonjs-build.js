import { buildProject, getBabelPluginMapForNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

buildProject({
  ...jsenvConfig,
  format: "commonjs",
  babelPluginMap: getBabelPluginMapForNode(),
  buildDirectoryClean: true,
})
