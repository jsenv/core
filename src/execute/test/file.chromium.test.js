import { localRoot } from "../../localRoot.js"
import { launchChromium } from "../../launchChromium/index.js"
import { execute } from "../execute.js"

execute({
  file: "src/execute/test/file.js",
  localRoot,
  compileInto: "build",
  launch: launchChromium,
  stopOnceExecuted: true,
})
