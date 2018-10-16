import { writeFileFromString, getPluginsFromNames } from "@dmail/project-structure-compile-babel"
import { compileProfiles } from "./compileProfiles/compileProfiles.js"
import { createGetProfileForPlatform, findProfileMatching } from "./createGetProfileForPlatform.js"

const stringifyResult = ({ profiles, fallback }) => {
  return JSON.stringify([...profiles, fallback], null, "  ")
}

export const createCompileProfiles = ({ root, into = "group.config.json" }) => {
  const result = compileProfiles({
    moduleOutput: "systemjs",
    identify: true,
  })
  writeFileFromString(`${root}/${into}`, stringifyResult(result))

  const getProfileForPlatform = createGetProfileForPlatform(result)

  return {
    getGroupIdForPlatform: (...args) => getProfileForPlatform(...args).id,
    getPluginsFromGroupId: (groupId) => {
      const profile = findProfileMatching(result, (profile) => profile.id === groupId)
      return getPluginsFromNames(profile.pluginNames)
    },
  }
}
