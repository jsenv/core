import { compileGroupsCompose } from "./compileGroupsCompose.js"

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

export const compileGroupsRegroupIn = (compileGroups, count = 4) => {
  let i = 0
  const chunkSizes = getChunkSizes(compileGroups, count).reverse()
  const compileGroupsRegrouped = []
  let remainingCompileGroups = compileGroups

  while (i < chunkSizes.length) {
    const compileGroupsToMerge = remainingCompileGroups.slice(0, chunkSizes[i])
    remainingCompileGroups = remainingCompileGroups.slice(chunkSizes[i])
    const mergedGroup = compileGroupsCompose(...compileGroupsToMerge)
    compileGroupsRegrouped.push(mergedGroup)
    i++
  }

  return compileGroupsRegrouped
}
