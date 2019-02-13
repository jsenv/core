export const decreaseArrayByComposingValues = ({ array, length = 4, composer }) => {
  let i = 0
  const chunkSizes = getChunkSizes(array, length).reverse()
  const decreasedArray = []
  let remainingArray = array

  while (i < chunkSizes.length) {
    const arrayOfValueToMerge = remainingArray.slice(0, chunkSizes[i])
    remainingArray = remainingArray.slice(chunkSizes[i])
    const mergedValue = composer(...arrayOfValueToMerge)
    decreasedArray.push(mergedValue)
    i++
  }

  return decreasedArray
}

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
