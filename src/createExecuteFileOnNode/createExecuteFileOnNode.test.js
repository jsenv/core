import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import { createExecuteFileOnNode } from "./createExecuteFileOnNode.js"
import path from "path"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnNode({ serverURL: url })

    const execution = execute("./src/__test__/file.js")
    execution.ended.listen((value) => {
      close()
      console.log("execution done with", value)
    })
    execution.crashed.listen((reason) => {
      close()
      console.error("execution crashed with", reason)
    })
  },
)
