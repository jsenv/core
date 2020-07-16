import {
  getImportMapFromNodeModules,
  generateImportMapForProject,
} from "@jsenv/node-module-import-map"
import { projectDirectoryUrl } from "../../jsenv.config.js"

generateImportMapForProject(
  [
    getImportMapFromNodeModules({
      projectDirectoryUrl,
    }),
  ],
  {
    projectDirectoryUrl,
    importMapFileRelativeUrl: "./importMap.json",
    jsConfigFile: true,
  },
)
