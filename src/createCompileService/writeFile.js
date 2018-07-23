import fs from "fs"
import sequence from "promise-sequential"
import { normalizeSeparation } from "./helpers.js"

const getFileLStat = (path) => {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (error, lstat) => {
      if (error) {
        reject({ status: 500, reason: error.code })
      } else {
        resolve(lstat)
      }
    })
  })
}

const createFolder = ({ location }) => {
  return new Promise((resolve, reject) => {
    fs.mkdir(location, (error) => {
      if (error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === "EEXIST") {
          return getFileLStat(location).then((stat) => {
            if (stat.isDirectory()) {
              resolve()
            } else {
              reject({ status: 500, reason: "expect a directory" })
            }
          })
        }
        reject({ status: 500, reason: error.code })
      } else {
        resolve()
      }
    })
  })
}

const createFolderUntil = ({ location }) => {
  let path = normalizeSeparation(location)
  // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""
  const pathStartsWithSlash = path[0] === "/"
  if (pathStartsWithSlash) {
    path = path.slice(1)
  }
  const folders = path.split("/")

  folders.pop()

  return sequence(folders, (_, index) => {
    const folderLocation = folders.slice(0, index + 1).join("/")
    return createFolder({
      location: `${pathStartsWithSlash ? "/" : ""}${folderLocation}`,
    })
  })
}

export const writeFile = ({ location, string }) => {
  return createFolderUntil({ location }).then(() => {
    return new Promise((resolve, reject) => {
      fs.writeFile(location, string, (error) => {
        if (error) {
          reject({ status: 500, reason: error.code })
        } else {
          resolve()
        }
      })
    })
  })
}
