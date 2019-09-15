import { composePlatformCompatMap } from "./composePlatformCompatMap.js"

export const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, [])
}

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = []

  previousGroupArray.forEach((group) => {
    reducedGroupArray.push({
      incompatibleNameArray: group.incompatibleNameArray.slice(),
      platformCompatMap: { ...group.platformCompatMap },
    })
  })

  groupArray.forEach((group) => {
    const groupWithSameIncompatibleFeature = reducedGroupArray.find((existingGroupCandidate) =>
      groupHaveSameIncompatibleFeatures(group, existingGroupCandidate),
    )
    if (groupWithSameIncompatibleFeature) {
      groupWithSameIncompatibleFeature.platformCompatMap = composePlatformCompatMap(
        groupWithSameIncompatibleFeature.platformCompatMap,
        group.platformCompatMap,
      )
    } else {
      reducedGroupArray.push({
        incompatibleNameArray: group.incompatibleNameArray.slice(),
        platformCompatMap: { ...group.platformCompatMap },
      })
    }
  })

  return reducedGroupArray
}

const groupHaveSameIncompatibleFeatures = (groupA, groupB) => {
  return groupA.incompatibleNameArray.join("") === groupB.incompatibleNameArray.join("")
}
