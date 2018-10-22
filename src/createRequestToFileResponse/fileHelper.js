import fs from "fs"

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
