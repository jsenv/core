import { utimes } from "fs"

export const changeFileModificationDate = (filePath, date) => {
  return new Promise((resolve, reject) => {
    utimes(filePath, date, date, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}