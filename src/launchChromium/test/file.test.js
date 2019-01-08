import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { launchChromium } from "../launchChromium.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const file = `src/launchChromium/test/fixtures/file.js`
const compileInto = "build"

executeFileOnPlatform(file, (options) => launchChromium({ headless: false, ...options }), {
  localRoot,
  compileInto,
  pluginMap,
  platformTypeForLog: "chromium browser",

  verbose: true,
  stopOnceExecuted: true,
})
