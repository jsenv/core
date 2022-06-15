import { readdir } from "node:fs"
import { urlToFileSystemPath } from "@jsenv/urls"
import { assertAndNormalizeDirectoryUrl } from "./assertAndNormalizeDirectoryUrl.js"

export const readDirectory = async (url, { emfileMaxWait = 1000 } = {}) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url)
  const directoryPath = urlToFileSystemPath(directoryUrl)
  const startMs = Date.now()
  let attemptCount = 0

  const attempt = () => {
    return readdirNaive(directoryPath, {
      handleTooManyFilesOpenedError: async (error) => {
        attemptCount++
        const nowMs = Date.now()
        const timeSpentWaiting = nowMs - startMs
        if (timeSpentWaiting > emfileMaxWait) {
          throw error
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(attempt())
          }, attemptCount)
        })
      },
    })
  }

  return attempt()
}

const readdirNaive = (
  directoryPath,
  { handleTooManyFilesOpenedError = null } = {},
) => {
  return new Promise((resolve, reject) => {
    readdir(directoryPath, (error, names) => {
      if (error) {
        // https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#errors_common_system_errors
        if (
          handleTooManyFilesOpenedError &&
          (error.code === "EMFILE" || error.code === "ENFILE")
        ) {
          resolve(handleTooManyFilesOpenedError(error))
        } else {
          reject(error)
        }
      } else {
        resolve(names)
      }
    })
  })
}
