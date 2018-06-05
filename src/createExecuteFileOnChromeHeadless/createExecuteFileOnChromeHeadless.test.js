import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import path from "path"
import { createExecuteFileOnChromeHeadless } from "./createExecuteFileOnChromeHeadless.js"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnChromeHeadless({ serverURL: url, autoClose: true })
    // "./src/__test__/file.test.js"
    const execution = execute("./src/__test__/file.js")

    execution.ended.listen((value) => {
      close()
      console.log("execution done with", value)
    })
    execution.crashed.listen((error) => {
      close()
      console.error("execution error", error)
    })
  },
)
