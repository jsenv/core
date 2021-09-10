import { composeRuntimeCompatMap } from "./composeRuntimeCompatMap.js"
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
    const groupWithSameRequirements = reducedGroupArray.find(
      (existingGroupCandidate) =>
        groupHaveSameRequirements(group, existingGroupCandidate),
    )
    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap = composeRuntimeCompatMap(
        groupWithSameRequirements.runtimeCompatMap,
        group.runtimeCompatMap,
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
  runtimeCompatMap,
}) => {
  return {
    babelPluginRequiredNameArray: babelPluginRequiredNameArray.slice(),
    jsenvPluginRequiredNameArray: jsenvPluginRequiredNameArray.slice(),
    runtimeCompatMap: { ...runtimeCompatMap },
  }
}
