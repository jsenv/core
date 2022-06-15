import { watch, openSync, closeSync } from "node:fs"

const isWindows = process.platform === "win32"

export const createWatcher = (sourcePath, options) => {
  const watcher = watch(sourcePath, options)

  if (isWindows) {
    watcher.on("error", async (error) => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = openSync(sourcePath, "r")
          closeSync(fd)
        } catch (e) {
          if (e.code === "ENOENT") {
            return
          }
          console.error(`error while fixing windows eperm: ${e.stack}`)
          throw error
        }
      } else {
        throw error
      }
    })
  }

  return watcher
}
