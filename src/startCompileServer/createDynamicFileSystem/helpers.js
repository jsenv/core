import fs from "fs"
import rimraf from "rimraf"
import path from "path"
import crypto from "crypto"
import { createAction, sequence } from "@dmail/action"

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

const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const resolvePath = (from, ...paths) => {
  return normalizeSeparation(path.resolve(from, ...paths))
}

export const readFileAsString = ({ location, errorHandler }) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      if (errorHandler && errorHandler(error)) {
        action.pass({ error })
      } else {
        throw error
      }
    } else {
      action.pass({ content: String(buffer) })
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

const getFileLStat = (path) => {
  const action = createAction()

  fs.lstat(path, (error, lstat) => {
    if (error) {
      throw error
    } else {
      action.pass(lstat)
    }
  })

  return action
}

export const createFolder = (path) => {
  const action = createAction()

  fs.mkdir(path, (error) => {
    if (error) {
      // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
      if (error.code === "EEXIST") {
        return getFileLStat(path).then((stat) => {
          if (stat.isDirectory()) {
            return action.pass()
          }
          throw error
        })
      }
      throw error
    } else {
      action.pass()
    }
  })

  return action
}

const createFolderUntil = (path) => {
  path = normalizeSeparation(path)
  // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""
  const pathStartsWithSlash = path[0] === "/"
  if (pathStartsWithSlash) {
    path = path.slice(1)
  }
  const folders = path.split("/")

  folders.pop()

  return sequence(folders, (folder, index) => {
    const folderLocation = folders.slice(0, index + 1).join("/")
    return createFolder(`${pathStartsWithSlash ? "/" : ""}${folderLocation}`)
  })
}

const writeFile = (path, content) => {
  const action = createAction()

  fs.writeFile(path, content, (error) => {
    if (error) {
      throw error
    } else {
      action.pass()
    }
  })

  return action
}

export const writeFileFromString = ({ location, string }) => {
  return createFolderUntil(location).then(() => writeFile(location, string))
}
