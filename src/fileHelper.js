import fs from "fs"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import path from "path"

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
    const sourceMapName = `${path.basename(filename)}.map`
    code = `${code}
${"//#"} sourceMappingURL=${sourceMapName}`

    return Promise.all([
      fileWriteFromString(filename, code),
      fileWriteFromString(sourceMapName, JSON.stringify(map, null, "  ")),
    ]).then(() => ({
      code,
      map,
    }))
  }

  return fileWriteFromString(filename, code).then(() => ({ code, map }))
}
