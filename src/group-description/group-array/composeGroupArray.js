import { composeCompatibility } from "../compatibility/composeCompatibility.js"

export const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, [])
}

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = []

  previousGroupArray.forEach((group) => {
    reducedGroupArray.push({
      babelPluginNameArray: group.babelPluginNameArray.slice(),
      compatibility: { ...group.compatibility },
    })
  })

  groupArray.forEach((group) => {
    const groupWithSameBabelPlugin = reducedGroupArray.find((existingGroupCandidate) =>
      groupHaveSameBabelPlugin(group, existingGroupCandidate),
    )
    if (groupWithSameBabelPlugin) {
      groupWithSameBabelPlugin.compatibility = composeCompatibility(
        groupWithSameBabelPlugin.compatibility,
        group.compatibility,
      )
    } else {
      reducedGroupArray.push({
        babelPluginNameArray: group.babelPluginNameArray.slice(),
        compatibility: { ...group.compatibility },
      })
    }
  })

  return reducedGroupArray
}

const groupHaveSameBabelPlugin = (groupA, groupB) => {
  return groupA.babelPluginNameArray.join("") === groupB.babelPluginNameArray.join("")
}
