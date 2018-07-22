import { createAction, sequence } from "@dmail/action"
import fs from "fs"
import { normalizeSeparation } from "./helpers.js"

const getFileLStat = (path) => {
  const action = createAction()

  fs.lstat(path, (error, lstat) => {
    if (error) {
      action.fail({ status: 500, reason: error.code })
    } else {
      action.pass(lstat)
    }
  })

  return action
}

const createFolder = ({ location }) => {
  const action = createAction()

  fs.mkdir(location, (error) => {
    if (error) {
      // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
      if (error.code === "EEXIST") {
        return getFileLStat(location).then((stat) => {
          if (stat.isDirectory()) {
            action.pass()
          } else {
            action.fail({ status: 500, reason: "expect a directory" })
          }
        })
      }
      action.fail({ status: 500, reason: error.code })
    } else {
      action.pass()
    }
  })

  return action
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

  return sequence(folders, (folder, index) => {
    const folderLocation = folders.slice(0, index + 1).join("/")
    return createFolder({
      location: `${pathStartsWithSlash ? "/" : ""}${folderLocation}`,
    })
  })
}

export const writeFile = ({ location, string }) => {
  return createFolderUntil({ location }).then(() => {
    const action = createAction()

    fs.writeFile(location, string, (error) => {
      if (error) {
        action.fail({ status: 500, reason: error.code })
      } else {
        action.pass()
      }
    })

    return action
  })
}
