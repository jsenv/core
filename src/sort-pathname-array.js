export const sortPathnameArray = (pathnameArray) => pathnameArray.sort(comparePathname)

const comparePathname = (leftPathname, rightPathname) => {
  const leftPartArray = leftPathname.split("/")
  const rightPartArray = rightPathname.split("/")

  const leftLength = leftPartArray.length
  const rightLength = rightPartArray.length

  const maxLength = Math.max(leftLength, rightLength)
  let i = 0
  while (i < maxLength) {
    const leftPartExists = i in leftPartArray
    const rightPartExists = i in rightPartArray
    // longer comes first
    if (!leftPartExists) return +1
    if (!rightPartExists) return -1

    const leftPartIsLast = i === leftPartArray.length - 1
    const rightPartIsLast = i === rightPartArray.length - 1
    // folder comes first
    if (leftPartIsLast && !rightPartIsLast) return +1
    if (!leftPartIsLast && rightPartIsLast) return -1

    const leftPart = leftPartArray[i]
    const rightPart = rightPartArray[i]
    i++
    // local comparison comes first
    const comparison = leftPart.localeCompare(rightPart)
    if (comparison !== 0) return comparison
  }

  if (leftLength < rightLength) return +1
  if (leftLength > rightLength) return -1
  return 0
}
