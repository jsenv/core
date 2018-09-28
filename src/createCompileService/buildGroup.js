import {
  createGetGroupForPlatform,
  writeFileFromString,
} from "@dmail/project-structure-compile-babel"

const stringifyGroups = (groups) => {
  const groupMap = {}

  groups.forEach((group) => {
    groupMap[group.id] = {
      pluginNames: group.pluginNames,
      compatMap: group.compatMap,
    }
  })

  return JSON.stringify(groupMap, null, "  ")
}

export const buildGroup = ({ root }) => {
  const { getGroupForPlatform, getAllGroup } = createGetGroupForPlatform({
    moduleOutput: "systemjs",
  })

  const groups = getAllGroup()
  const sortedGroups = groups.sort((a, b) => a.pluginNames.length - b.pluginNames.length)

  sortedGroups[0].id = "worst"
  sortedGroups.slice(1, -1).forEach((intermediateGroup, index) => {
    intermediateGroup.id = `intermediate-${index + 1}`
  })
  sortedGroups[sortedGroups.length - 2].id = "best"
  sortedGroups[sortedGroups.length - 1].id = "ideal"

  writeFileFromString(`${root}/group.config.json`, stringifyGroups(groups))

  return {
    getGroupIdForPlatform: ({ platformName, platformVersion }) => {
      return getGroupForPlatform({ platformName, platformVersion }).id
    },
    getPluginsFromGroupId: (groupId) => {
      return groups.find((group) => {
        return group.id === groupId
      }).plugins
    },
  }
}
