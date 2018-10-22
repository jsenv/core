import fs from "fs"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"

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
  return Promise.all([
    fileWriteFromString(filename, code),
    map ? fileWriteFromString(`${filename}.map`, JSON.stringify(map, null, "  ")) : null,
  ]).then(() => ({
    code,
    map,
  }))
}
