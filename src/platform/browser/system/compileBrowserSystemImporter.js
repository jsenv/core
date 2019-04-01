import { bundleBrowser } from "@jsenv/core"
import { babelPluginDescription } from "@jsenv/babel-plugin-description"
import { projectFolder } from "../../../../projectFolder.js"

export const compileBrowserSystemImporter = async () => {
  await bundleBrowser({
    projectFolder,
    into: "dist",
    babelPluginDescription,
    entryPointsDescription: {
      main: "src/platform/browser/system/createSystemImporter.js",
    },
    globalName: "__browserImporter__",
  })
}
