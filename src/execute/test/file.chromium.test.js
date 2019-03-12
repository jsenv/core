import { launchChromium } from "../../launchChromium/index.js"
import { projectFolder } from "../../../projectFolder.js"
import { execute } from "../execute.js"

execute({
  projectFolder,
  compileInto: "build",
  babelPluginDescription: {},
  launch: launchChromium,
  stopOnceExecuted: true,
  mirrorConsole: true,
  filenameRelative: "src/execute/test/file.js",
})
