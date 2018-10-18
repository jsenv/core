import fs from "fs"
import { writeFileFromString } from "@dmail/project-structure-compile-babel"
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

const BEST_GROUP_ID = "best"
const WORST_GROUP_ID = "worst"
export const DEFAULT_GROUP_ID = "otherwise"

export const getGroupData = ({
  root,
  into,

  stats,
  compatMap,
  size,
  platformNames,
  moduleOutput,
  pluginNames,
}) => {
  const configLocation = `${root}/${into}/group.config.json`

  return readFile(configLocation).then(
    (content) => JSON.parse(content),
    (error) => {
      if (error && error.code === "ENOENT") {
        const { profiles, fallback } = compileProfiles({
          stats,
          compatMap,
          size,
          platformNames,
          moduleOutput,
          pluginNames,
        })

        const groupData = {}

        groupData[BEST_GROUP_ID] = profiles[0]
        profiles.slice(1, -1).forEach((intermediateProfile, index) => {
          groupData[`intermediate-${index + 1}`] = intermediateProfile
        })
        groupData[WORST_GROUP_ID] = profiles[profiles.length - 1]
        groupData[DEFAULT_GROUP_ID] = fallback

        writeFileFromString(configLocation, JSON.stringify(groupData))

        return groupData
      }
      return Promise.reject(error)
    },
  )
}
