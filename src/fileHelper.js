import fs from "fs"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import path from "path"

export { fileWriteFromString }

export const readFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(String(buffer))
      }
    })
  })
}

export const copyFile = (from, to) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(from, to, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export const symlink = (from, to) => {
  return new Promise((resolve, reject) => {
    fs.symlink(from, to, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export const compileResultToFileSysten = ({ code, map }, filename) => {
  if (map) {
    const sourceMapBasename = `${path.basename(filename)}.map`
    code = `${code}
${"//#"} sourceMappingURL=${sourceMapBasename}`
    const sourceMapFilename = `${path.dirname(filename)}/${sourceMapBasename}`

    return Promise.all([
      fileWriteFromString(filename, code),
      fileWriteFromString(sourceMapFilename, JSON.stringify(map, null, "  ")),
    ]).then(() => ({
      code,
      map,
    }))
  }

  return fileWriteFromString(filename, code).then(() => ({ code, map }))
}

export const stat = (location) => {
  return new Promise((resolve, reject) => {
    fs.stat(location, (error, stat) => {
      if (error) {
        reject(error)
      } else {
        resolve(stat)
      }
    })
  })
}

export const listDirectoryContent = (location) => {
  return new Promise((resolve, reject) => {
    fs.readdir(location, (error, ressourceNames) => {
      if (error) {
        reject(error)
      } else {
        resolve(ressourceNames)
      }
    })
  })
}

export const fileToReadableStream = (file) => {
  return fs.createReadStream(file)
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
