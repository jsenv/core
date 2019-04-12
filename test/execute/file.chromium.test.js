import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { execute, launchChromium } from "../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchChromium,
  stopOnceExecuted: true,
  mirrorConsole: true,
  filenameRelative: "file.js",
})
