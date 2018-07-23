import fs from "fs"
import { convertFileSystemErrorToResponseProperties } from "../createFileService/index.js"

export const readFile = ({ location, errorHandler }) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        if (errorHandler && errorHandler(error)) {
          resolve({ error })
        } else {
          reject(convertFileSystemErrorToResponseProperties(error))
        }
      } else {
        resolve({ content: String(buffer) })
      }
    })
  })
}
