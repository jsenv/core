import { dirname } from "path"
import { promisify } from "util"
import { mkdir, readFile, writeFile, stat } from "fs"

const rimraf = import.meta.require("rimraf")

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

export const removeDirectory = (path) =>
  new Promise((resolve, reject) =>
    rimraf(path, (error) => {
      if (error) reject(error)
      else resolve()
    }),
  )

export const assertFolder = async (path) => {
  const filesystemEntry = await pathToFilesystemEntry(path)

  if (!filesystemEntry) {
    throw new Error(`folder not found on filesystem.
  path: ${path}`)
  }

  const { type } = filesystemEntry
  if (type !== "folder") {
    throw new Error(`folder expected but found something else on filesystem.
  path: ${path}
  found: ${type}`)
  }
}

export const assertFile = async (path) => {
  const filesystemEntry = await pathToFilesystemEntry(path)

  if (!filesystemEntry) {
    throw new Error(`file not found on filesystem.
  path: ${path}`)
  }

  const { type } = filesystemEntry
  if (type !== "file") {
    throw new Error(`file expected but found something else on filesystem.
  path: ${path}
  found: ${type}`)
  }
}

const pathToFilesystemEntry = (path) =>
  new Promise((resolve, reject) => {
    stat(path, (error, stats) => {
      if (error) {
        if (error.code === "ENOENT") resolve(null)
        else reject(error)
      } else {
        resolve({
          // eslint-disable-next-line no-nested-ternary
          type: stats.isFile() ? "file" : stats.isDirectory() ? "folder" : "other",
          stats,
        })
      }
    })
  })
