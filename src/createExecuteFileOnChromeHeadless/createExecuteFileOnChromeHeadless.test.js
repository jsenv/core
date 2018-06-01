import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import path from "path"
import { createExecuteFileOnChromeHeadless } from "./createExecuteFileOnChromeHeadless.js"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    // "./src/__test__/file.test.js"
    const fileToExecute = "./src/__test__/test.js"

    console.log("dev server at", String(url), "try opening", url + fileToExecute)
    const { execute } = createExecuteFileOnChromeHeadless({ serverURL: url })

    const execution = execute(fileToExecute)

    execution.ended.listen((value) => {
      close()
      console.log("execution done with", value)
    })
    execution.crashed.listen((error) => {
      console.error("execution error", error)
    })
  },
)
