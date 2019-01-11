export const arrayWithoutValue = (array, valueToRemove) =>
  arrayWithout(array, (value) => value === valueToRemove)

export const arrayWithoutDuplicate = (array, compare = (a, b) => a === b) =>
  arrayWithout(array, (value, index, outputArray) =>
    outputArray.some((existingValue) => compare(existingValue, value)),
  )

export const arrayWithout = (array, predicate) => {
  const outputArray = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    const index = i
    i++
    if (predicate(value, index, outputArray)) continue
    outputArray.push(value)
  }
  return outputArray
}
