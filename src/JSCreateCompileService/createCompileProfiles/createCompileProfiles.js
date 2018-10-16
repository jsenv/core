import { writeFileFromString, getPluginsFromNames } from "@dmail/project-structure-compile-babel"
import { compileProfiles } from "./compileProfiles/compileProfiles.js"
import { createGetProfileForPlatform } from "./createGetProfileForPlatform.js"

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
    getGroupIdAndPluginsForPlatform: (...args) => {
      const profile = getProfileForPlatform(...args)
      const plugins = getPluginsFromNames(profile.pluginNames)
      return {
        id: profile.id,
        plugins,
      }
    },
  }
}
