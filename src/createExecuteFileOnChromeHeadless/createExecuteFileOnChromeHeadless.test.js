import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import path from "path"
import { createExecuteFileOnChromeHeadless } from "./createExecuteFileOnChromeHeadless.js"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnChromeHeadless({ serverURL: url })

    const execution = execute("./src/__test__/file.test.js")

    execution.ended.listen(close)
  },
)
