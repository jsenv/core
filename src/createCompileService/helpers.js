import { createAction } from "@dmail/action"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import rimraf from "rimraf"

export const createETag = (string) => {
  if (string.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'
  }

  const hash = crypto.createHash("sha1")
  hash.update(string, "utf8")
  let result = hash.digest("base64")
  result = result.replace(/\=+$/, "")

  return `"${string.length.toString(16)}-${result}"`
}

export const isFileNotFoundError = (error) => error && error.code === "ENOENT"

export const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const resolvePath = (from, ...paths) => {
  return normalizeSeparation(path.join(from, ...paths))
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
