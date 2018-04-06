import { createAction, all } from "@dmail/action"
import fs from "fs"

const getFileMtime = (location) => {
  const action = createAction()

  fs.stat(location, (error, stat) => {
    if (error) {
      throw error
    } else {
      action.pass(stat.mtime)
    }
  })

  return action
}

const getFileMtimeOrNull = (location) => {
  const action = createAction()

  fs.stat(location, (error, stat) => {
    if (error) {
      if (error.code === "ENOENT") {
        action.pass(null)
      } else {
        throw error
      }
    } else {
      action.pass(stat.mtime)
    }
  })

  return action
}

export const mtimeValidator = ({ staticLocation, dynamicLocation }) => {
  return all([getFileMtime(staticLocation), getFileMtimeOrNull(dynamicLocation)]).then(
    ([staticMtime, dynamicMtime]) => {
      const detail = {
        staticLocation,
        dynamicLocation,
        staticMtime,
        dynamicMtime,
      }

      if (dynamicMtime === null) {
        return {
          valid: false,
          reason: "dynamic-file-not-found",
          detail,
        }
      }
      if (dynamicMtime <= staticMtime) {
        return {
          valid: true,
          reason: "dynamic-file-mtime-up-to-date",
          detail,
        }
      }
      return {
        valid: false,
        reason: "dynamic-file-mtime-outdated",
        detail,
      }
    },
  )
}
