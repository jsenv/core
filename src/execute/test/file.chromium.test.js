import { launchChromium } from "../../launchChromium/index.js"
import { root } from "../../root.js"
import { execute } from "../execute.js"

execute({
  root,
  compileInto: "build",
  launch: launchChromium,
  stopOnceExecuted: true,
  file: "src/execute/test/file.js",
})
