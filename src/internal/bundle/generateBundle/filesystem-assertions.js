import { stat, statSync } from "fs"

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

export const assertFileSync = (path) => {
  let stats

  try {
    stats = statSync(path)
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new Error(`file not found on filesystem.
path: ${path}`)
    }
    throw e
  }

  const entry = statsToEntry(stats)
  if (entry !== "file") {
    throw new Error(`file expected but found something else on filesystem.
path: ${path}
found: ${entry}`)
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
          type: statsToEntry(stats),
          stats,
        })
      }
    })
  })

const statsToEntry = (stats) => {
  if (stats.isFile()) {
    return "file"
  }
  if (stats.isDirectory()) {
    return "folder"
  }
  return "other"
}
