import { stat } from "fs"

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
