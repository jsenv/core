import { execute, launchChromium } from "../../index.js"

const { projectFolder } = import.meta.require("../../jsenv.config.js")

const testFolder = `${projectFolder}/test/execute`

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchChromium,
  stopOnceExecuted: true,
  mirrorConsole: true,
  filenameRelative: "file.js",
})
