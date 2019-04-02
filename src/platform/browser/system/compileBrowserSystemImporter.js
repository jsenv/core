import { bundleBrowser } from "@jsenv/core"
import { projectFolder } from "../../../../projectFolder.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const compileBrowserSystemImporter = async () => {
  await bundleBrowser({
    projectFolder,
    into: "dist",
    babelConfigMap,
    entryPointMap: {
      main: "src/platform/browser/system/createSystemImporter.js",
    },
    globalName: "__browserImporter__",
  })
}
