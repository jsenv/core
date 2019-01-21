import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { executeFile } from "../../executeFile.js"
import { launchChromium } from "../launchChromium.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const file = `src/launchChromium/test/fixtures/file-with-root-dependency.js`
const compileInto = "build"

executeFile(file, {
  localRoot,
  compileInto,
  pluginMap,
  launchPlatform: (options) => launchChromium({ headless: false, ...options }),
  platformTypeForLog: "chromium browser",
  verbose: true,
  stopOnceExecuted: true,
})
