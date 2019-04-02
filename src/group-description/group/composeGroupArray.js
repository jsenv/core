import { composePlatformCompatibility } from "../platform-compatibility/composePlatformCompatibility.js"

export const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, [])
}

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = []

  previousGroupArray.forEach((group) => {
    reducedGroupArray.push({
      incompatibleNameArray: group.incompatibleNameArray.slice(),
      platformCompatibility: { ...group.platformCompatibility },
    })
  })

  groupArray.forEach((group) => {
    const groupWithSameIncompatibleFeature = reducedGroupArray.find((existingGroupCandidate) =>
      groupHaveSameIncompatibleFeatures(group, existingGroupCandidate),
    )
    if (groupWithSameIncompatibleFeature) {
      groupWithSameIncompatibleFeature.platformCompatibility = composePlatformCompatibility(
        groupWithSameIncompatibleFeature.platformCompatibility,
        group.platformCompatibility,
      )
    } else {
      reducedGroupArray.push({
        incompatibleNameArray: group.incompatibleNameArray.slice(),
        platformCompatibility: { ...group.platformCompatibility },
      })
    }
  })

  return reducedGroupArray
}

const groupHaveSameIncompatibleFeatures = (groupA, groupB) => {
  return groupA.incompatibleNameArray.join("") === groupB.incompatibleNameArray.join("")
}
