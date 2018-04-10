import fs from "fs"
import rimraf from "rimraf"
import { createAction } from "@dmail/action"

export const isFileNotFoundError = (error) => error && error.code === "ENOENT"

export const readFileAsString = ({ location, errorHandler }) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      if (errorHandler && errorHandler(error)) {
        action.fail(error)
      } else {
        throw error
      }
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

export const removeFolderDeep = (location) => {
  const action = createAction()

  rimraf(location, (error) => {
    if (error) {
      throw error
    } else {
      action.pass()
    }
  })

  return action
}
