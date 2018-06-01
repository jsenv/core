import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import { createExecuteFileOnNode } from "./createExecuteFileOnNode.js"
import path from "path"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnNode({ serverURL: url })

    const execution = execute("./src/__test__/test.js")
    execution.ended.listen(() => {
      close()
      console.log("done")
    })
    execution.crashed.listen((reason) => {
      close()
      console.log("crashed", reason)
    })
  },
)
