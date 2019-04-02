import { bundleBrowser } from "@jsenv/core"
import { projectFolder } from "../../../../projectFolder.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const compileBrowserPlatform = async () => {
  await bundleBrowser({
    projectFolder,
    into: "dist",
    babelConfigMap,
    entryPointMap: {
      main: "src/platform/browser/browserPlatform.js",
    },
    globalName: "__platform__",
  })
}
