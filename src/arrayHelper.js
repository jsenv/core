export const arrayWithout = (array, item) => {
  const arrayWithoutItem = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    if (value === item) {
      continue
    }
    arrayWithoutItem[i] = value
  }
  return arrayWithoutItem
}
