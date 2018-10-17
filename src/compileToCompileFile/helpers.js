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

export const isFolder = (filename) => {
  return new Promise((resolve, reject) => {
    fs.lstat(filename, (error, stat) => {
      if (error) {
        reject(error)
      } else {
        resolve(stat.isDirectory())
      }
    })
  })
}

export const readFolder = (location) => {
  return new Promise((resolve, reject) => {
    fs.readdir(location, (error, filenames) => {
      if (error) {
        reject(error)
      } else {
        resolve(filenames)
      }
    })
  })
}

export const removeFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.unlink(location, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export const removeFolderDeep = (location) => {
  return new Promise((resolve, reject) => {
    rimraf(location, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
