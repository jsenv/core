import { launchChromium } from "../../launchChromium/index.js"
import { execute } from "../execute.js"

const { projectFolder } = import.meta.require("../../../projectFolder.js")
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
