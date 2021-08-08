import { getImportMapFromProjectFiles, writeImportMapFile } from "@jsenv/importmap-node-module"

import { projectDirectoryUrl } from "../../jsenv.config.js"

await writeImportMapFile(
  [
    getImportMapFromProjectFiles({
      projectDirectoryUrl,
      runtime: "node",
      dev: true,
    }),
  ],
  {
    projectDirectoryUrl,
    jsConfigFile: true,
  },
)
