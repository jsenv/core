import { launchChromium } from "../../launchChromium/index.js"
import { projectFolder } from "../../../projectFolder.js"
import { execute } from "../execute.js"

const testFolder = `${projectFolder}/src/execute/test`

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchChromium,
  stopOnceExecuted: true,
  mirrorConsole: true,
  filenameRelative: "file.js",
})
