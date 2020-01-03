import { dirname } from "path"
import { promisify } from "util"
import { mkdir, readFile, writeFile, stat, unlink } from "fs"
import { urlToFileSystemPath } from "./urlUtils.js"

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

export const removeFile = (path) =>
  new Promise((resolve, reject) => {
    unlink(path, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })

export const assertDirectoryExists = async (fileUrl) => {
  const directoryPath = urlToFileSystemPath(fileUrl)
  const filesystemEntry = await pathToFilesystemEntry(directoryPath)

  if (!filesystemEntry) {
    throw new Error(`directory not found at ${directoryPath}`)
  }

  const { type } = filesystemEntry
  if (type !== "folder") {
    throw new Error(`directory expected at ${directoryPath} but found ${type}`)
  }
}

export const assertFileExists = async (fileUrl) => {
  const filePath = urlToFileSystemPath(fileUrl)
  const filesystemEntry = await pathToFilesystemEntry(filePath)

  if (!filesystemEntry) {
    throw new Error(`file not found at ${filePath}`)
  }

  const { type } = filesystemEntry
  if (type !== "file") {
    throw new Error(`file expected at ${filePath} but found ${type}`)
  }
}

export const fileExists = (fileUrl) => {
  return new Promise((resolve, reject) => {
    stat(urlToFileSystemPath(fileUrl), (error) => {
      if (error) {
        if (error.code === "ENOENT") resolve(false)
        else reject(error)
      } else {
        resolve(true)
      }
    })
  })
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
