import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { execute, launchNode } from "../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchNode,
  filenameRelative: "file.js",
})
