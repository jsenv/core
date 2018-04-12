import { createCompileService } from "./createCompileService.js"
import { test } from "@dmail/test"
import path from "path"

const projectRoot = path.resolve(__dirname, "../../..")
const testFolderLocation = `${projectRoot}/src/__test__`

test(() => {
  const service = createCompileService({
    rootLocation: testFolderLocation,
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
      pathname: "/file.js",
    },
  }).then((properties) => {
    debugger
  })
})
