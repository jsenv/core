import fs from "fs"
import { createAction } from "@dmail/action"
import { convertFileSystemErrorToResponseProperties } from "../createFileService/index.js"

export const readFile = ({ location, errorHandler }) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      if (errorHandler && errorHandler(error)) {
        action.pass({ error })
      } else {
        action.fail(convertFileSystemErrorToResponseProperties(error))
      }
    } else {
      action.pass({ content: String(buffer) })
    }
  })

  return action
}
