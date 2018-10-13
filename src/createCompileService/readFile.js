import fs from "fs"

export const readFile = ({ location, errorHandler }) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        if (errorHandler && errorHandler(error)) {
          resolve({ error })
        } else {
          reject(error)
        }
      } else {
        resolve({ content: String(buffer) })
      }
    })
  })
}
