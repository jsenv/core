import { composeRuntimeCompatMap } from "./composeRuntimeCompatMap.js"

export const createCompileGroups = (runtimeCompileInfos) => {
  const groups = []

  Object.keys(runtimeCompileInfos).forEach((runtimeName) => {
    const {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      runtimeVersion,
    } = runtimeCompileInfos[runtimeName]

    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      runtimeCompatMap: {
        [runtimeName]: runtimeVersion,
      },
    }

    const groupWithSameRequirements = groups.find((groupCandidate) =>
      groupHaveSameRequirements(group, groupCandidate),
    )
    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap = composeRuntimeCompatMap(
        groupWithSameRequirements.runtimeCompatMap,
        group.runtimeCompatMap,
      )
    } else {
      groups.push(group)
    }
  })

  return groups
}

const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return (
    leftGroup.babelPluginRequiredNameArray.join("") ===
      rightGroup.babelPluginRequiredNameArray.join("") &&
    leftGroup.jsenvPluginRequiredNameArray.join("") ===
      rightGroup.jsenvPluginRequiredNameArray.join("")
  )
}
