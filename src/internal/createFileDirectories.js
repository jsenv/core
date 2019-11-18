import { mkdir, lstat } from "fs"

export const createFileDirectories = (file) => {
  const fileNormalized = normalizeSeparation(file)
  // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""
  const fileStartsWithSlash = fileNormalized[0] === "/"
  const pathname = fileStartsWithSlash ? fileNormalized.slice(1) : fileNormalized
  const folders = pathname.split("/")
  folders.pop()

  return promiseSequence(
    folders.map((_, index) => {
      return () => {
        const folder = folders.slice(0, index + 1).join("/")
        return createDirectory(`${fileStartsWithSlash ? "/" : ""}${folder}`)
      }
    }),
  )
}

const normalizeSeparation = (file) => file.replace(/\\/g, "/")

const createDirectory = (folder) =>
  new Promise((resolve, reject) => {
    mkdir(folder, async (error) => {
      if (error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === "EEXIST") {
          const stat = await fileLastStat(folder)
          if (stat.isDirectory()) {
            resolve()
          } else {
            reject({ status: 500, reason: "expect a directory" })
          }
        } else {
          reject({ status: 500, reason: error.code })
        }
      } else {
        resolve()
      }
    })
  })

const fileLastStat = (path) =>
  new Promise((resolve, reject) => {
    lstat(path, (error, lstat) => {
      if (error) {
        reject({ status: 500, reason: error.code })
      } else {
        resolve(lstat)
      }
    })
  })

const promiseSequence = async (callbackArray) => {
  const values = []
  const visit = async (index) => {
    if (index === callbackArray.length) return
    const callback = callbackArray[index]
    const value = await callback()
    values.push(value)
    await visit(index + 1)
  }
  await visit(0)
  return values
}
