import { dirname } from "path"
import { promisify } from "util"
import { mkdir, readFile, writeFile, stat } from "fs"

export const createFileDirectories = (filePath) => {
  return new Promise((resolve, reject) => {
    mkdir(dirname(filePath), { recursive: true }, (error) => {
      if (error) {
        if (error.code === "EEXIST") {
          resolve()
          return
        }
        reject(error)
        return
      }
      resolve()
    })
  })
}

const statPromisified = promisify(stat)
export const readFileStat = async (filePath) => {
  const statsObject = await statPromisified(filePath)
  return statsObject
}

const readFilePromisified = promisify(readFile)
export const readFileContent = async (filePath) => {
  const buffer = await readFilePromisified(filePath)
  return buffer.toString()
}

const writeFilePromisified = promisify(writeFile)
export const writeFileContent = async (filePath, content) => {
  await createFileDirectories(filePath)
  return writeFilePromisified(filePath, content)
}
