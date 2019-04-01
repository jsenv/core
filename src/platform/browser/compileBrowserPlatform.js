import { bundleBrowser } from "@jsenv/core"
import { babelPluginDescription } from "@jsenv/babel-plugin-description"
import { projectFolder } from "../../../../projectFolder.js"

export const compileBrowserPlatform = async () => {
  await bundleBrowser({
    projectFolder,
    into: "dist",
    babelPluginDescription,
    entryPointsDescription: {
      main: "src/platform/browser/browserPlatform.js",
    },
    globalName: "__platform__",
  })
}
