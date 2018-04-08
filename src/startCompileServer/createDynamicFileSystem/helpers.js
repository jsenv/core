import fs from "fs"
import { createAction } from "@dmail/action"

export const getFileContentOr = (location, orValue) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      if (error.code === "ENOENT") {
        action.pass(orValue)
      } else {
        throw error
      }
    } else {
      action.pass(String(buffer))
    }
  })

  return action
}

export const getFileContent = () => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      throw error
    } else {
      action.pass(String(buffer))
    }
  })

  return action
}

export const readFolder = (location) => {
  const action = createAction()

  fs.readdir(location, (error, filenames) => {
    if (error) {
      throw error
    } else {
      action.pass(filenames)
    }
  })

  return action
}

export const removeFile = (location) => {
  const action = createAction()

  fs.unlink(location, (error) => {
    if (error) {
      throw error
    } else {
      action.pass()
    }
  })

  return action
}
