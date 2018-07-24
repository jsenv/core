import { test } from "@dmail/test"
import path from "path"
import { createCompileService } from "./createCompileService.js"

const projectRoot = path.resolve(__dirname, "../../..")

test(() => {
  const service = createCompileService({
    rootLocation: projectRoot,
    // compile does not exists anymore
    // it's now createCompiler, have to extract it from openCompileServer
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
      pathname: "/src/__test__/file.js",
    },
  })
})
