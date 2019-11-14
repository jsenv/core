import { composePlatformCompatMap } from "./composePlatformCompatMap.js"
import { groupHaveSameRequirements } from "./groupHaveSameRequirements.js"

export const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, [])
}

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = []

  previousGroupArray.forEach((group) => {
    reducedGroupArray.push(copyGroup(group))
  })

  groupArray.forEach((group) => {
    const groupWithSameRequirements = reducedGroupArray.find((existingGroupCandidate) =>
      groupHaveSameRequirements(group, existingGroupCandidate),
    )
    if (groupWithSameRequirements) {
      groupWithSameRequirements.platformCompatMap = composePlatformCompatMap(
        groupWithSameRequirements.platformCompatMap,
        group.platformCompatMap,
      )
    } else {
      reducedGroupArray.push(copyGroup(group))
    }
  })

  return reducedGroupArray
}

const copyGroup = ({
  babelPluginRequiredNameArray,
  jsenvPluginRequiredNameArray,
  platformCompatMap,
}) => {
  return {
    babelPluginRequiredNameArray: babelPluginRequiredNameArray.slice(),
    jsenvPluginRequiredNameArray: jsenvPluginRequiredNameArray.slice(),
    platformCompatMap: { ...platformCompatMap },
  }
}
