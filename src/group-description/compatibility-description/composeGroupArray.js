import { composeCompatibility } from "./composeCompatibility.js"

export const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, [])
}

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = []

  previousGroupArray.forEach((group) => {
    reducedGroupArray.push({
      incompatibleNameArray: group.incompatibleNameArray.slice(),
      compatibility: { ...group.compatibility },
    })
  })

  groupArray.forEach((group) => {
    const groupWithSameIncompatibleFeature = reducedGroupArray.find((existingGroupCandidate) =>
      groupHaveSameIncompatibleFeatures(group, existingGroupCandidate),
    )
    if (groupWithSameIncompatibleFeature) {
      groupWithSameIncompatibleFeature.compatibility = composeCompatibility(
        groupWithSameIncompatibleFeature.compatibility,
        group.compatibility,
      )
    } else {
      reducedGroupArray.push({
        incompatibleNameArray: group.incompatibleNameArray.slice(),
        compatibility: { ...group.compatibility },
      })
    }
  })

  return reducedGroupArray
}

const groupHaveSameIncompatibleFeatures = (groupA, groupB) => {
  return groupA.incompatibleNameArray.join("") === groupB.incompatibleNameArray.join("")
}
