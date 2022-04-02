export const escapeCharIsNotAlreadyEscaped = (string, charToEscape) => {
  let i = 0
  let result = ""
  while (i < string.length) {
    const char = string[i]
    i++
    if (char === charToEscape) {
      // if the number of escape char preceding this char is odd, don't touch it
      // otherwise escape it
      let backslashBeforeCount = 0
      let index = i
      while (index--) {
        const previousChar = string[index]
        if (previousChar === "\\") {
          backslashBeforeCount++
        }
        break
      }
      const isEven = backslashBeforeCount % 2 === 0
      if (isEven) {
        result += `\\${char}`
        continue
      }
    }
    result += char
  }
  return result
}
