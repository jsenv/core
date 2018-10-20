import { composeGroups } from "./composeGroups.js"

const getChunkSizes = (array, size) => {
  let i = 0
  const chunkSize = Math.ceil(array.length / size)
  const chunkSizes = []
  while (i < array.length) {
    if (i + chunkSize > array.length) {
      const chunkSize = array.length - i
      i += chunkSize
      chunkSizes.push(chunkSize)
    } else {
      i += chunkSize
      chunkSizes.push(chunkSize)
    }
  }
  return chunkSizes
}

export const splitGroups = (groups, groupToScore, count = 4) => {
  let i = 0
  const chunkSizes = getChunkSizes(groups, count).reverse()
  const finalGroups = []
  const sortedGroups = groups.sort((a, b) => groupToScore(b) - groupToScore(a))
  let remainingGroups = sortedGroups

  while (i < chunkSizes.length) {
    const groupsToMerge = remainingGroups.slice(0, chunkSizes[i])
    remainingGroups = remainingGroups.slice(chunkSizes[i])
    const mergedGroup = composeGroups(...groupsToMerge)
    if (Object.keys(mergedGroup.compatMap).length) {
      finalGroups.push(mergedGroup)
    }
    i++
  }

  return finalGroups
}
