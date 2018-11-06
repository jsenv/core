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
