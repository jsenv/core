import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/fixtures/syntax-error.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

executeFile(file, {
  localRoot,
  compileInto,
  pluginMap,
  launchPlatform: (options) => launchChromium({ headless: false, ...options }),
  platformTypeForLog: "chromium browser",
  verbose: true,
  stopOnceExecuted: true,
})
