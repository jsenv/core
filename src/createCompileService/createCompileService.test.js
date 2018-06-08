import { test } from "@dmail/test"
import path from "path"
import { createCompileService } from "./createCompileService.js"

const projectRoot = path.resolve(__dirname, "../../..")

test(() => {
  const service = createCompileService({
    rootLocation: projectRoot,
    cacheFolderRelativeLocation: "build",
    compile: () => {
      return {
        output: `export default "compiled version"`,
      }
    },
  })

  return service({
    method: "GET",
    headers: new Map(),
    url: {
      pathname: "/build/src/__test__/file.js",
    },
  }).then((properties) => {
    debugger
  })
})
