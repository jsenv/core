export const arrayWithout = (array, item) => {
  const arrayWithoutItem = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    if (value === item) {
      continue
    }
    arrayWithoutItem.push(value)
  }
  return arrayWithoutItem
}

export const arrayWithoutIndex = (array, index) => {
  const arrayWithoutIndex = []
  let i = 0
  while (i < array.length) {
    const currentIndex = i
    i++
    if (currentIndex === index) {
      continue
    }
    arrayWithoutIndex.push(array[currentIndex])
  }
  return arrayWithoutIndex
}

export const arrayWithoutDuplicate = (array, compare = (a, b) => a === b) => {
  const arrayWithoutDuplicate = []

  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    const existingIndex = arrayWithoutDuplicate.findIndex((existing) => compare(existing, value))
    if (existingIndex === -1) {
      arrayWithoutDuplicate.push(value)
    }
  }

  return arrayWithoutDuplicate
}
