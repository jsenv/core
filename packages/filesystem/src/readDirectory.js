import { readdir } from "node:fs"
import { assertAndNormalizeDirectoryUrl } from "./assertAndNormalizeDirectoryUrl.js"

export const readDirectory = async (url, { emfileMaxWait = 1000 } = {}) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url)
  const directoryUrlObject = new URL(directoryUrl)
  const startMs = Date.now()
  let attemptCount = 0

  const attempt = async () => {
    try {
      const names = await new Promise((resolve, reject) => {
        readdir(directoryUrlObject, (error, names) => {
          if (error) {
            reject(error)
          } else {
            resolve(names)
          }
        })
      })
      return names.map(encodeURIComponent)
    } catch (e) {
      // https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#errors_common_system_errors
      if (e.code === "EMFILE" || e.code === "ENFILE") {
        attemptCount++
        const nowMs = Date.now()
        const timeSpentWaiting = nowMs - startMs
        if (timeSpentWaiting > emfileMaxWait) {
          throw e
        }
        await new Promise((resolve) => setTimeout(resolve), attemptCount)
        return await attempt()
      }
      throw e
    }
  }

  return attempt()
}
