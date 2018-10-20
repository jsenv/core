import fs from "fs"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { compileProfiles } from "./createCompileProfiles/index.js"

const readFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(String(buffer))
      }
    })
  })
}

const BEST_ID = "best"
const WORST_ID = "worst"
export const DEFAULT_ID = "otherwise"

export const getCompatGroupMap = ({
  configLocation,
  stats,
  compatMap,
  size,
  platformNames,
  pluginNames,
}) => {
  return readFile(configLocation).then(
    (content) => JSON.parse(content),
    (error) => {
      if (error && error.code === "ENOENT") {
        const { profiles, fallback } = compileProfiles({
          stats,
          compatMap,
          size,
          platformNames,
          pluginNames,
        })

        const compatGroupMap = {}

        compatGroupMap[BEST_ID] = profiles[0]
        profiles.slice(1, -1).forEach((intermediateProfile, index) => {
          compatGroupMap[`intermediate-${index + 1}`] = intermediateProfile
        })
        compatGroupMap[WORST_ID] = profiles[profiles.length - 1]
        compatGroupMap[DEFAULT_ID] = fallback

        fileWriteFromString(configLocation, JSON.stringify(compatGroupMap))

        return compatGroupMap
      }
      return Promise.reject(error)
    },
  )
}
