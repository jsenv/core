export const escapeChars = (string, replacements) => {
  let result = ""
  let last = 0
  let i = 0
  const charsToEscape = Object.keys(replacements)
  while (i < string.length) {
    const char = string[i]
    if (charsToEscape.includes(char)) {
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
        if (last === i) {
          result += replacements[char]
        } else {
          result += `${string.slice(last, i)}${replacements[char]}`
        }
        last = i + 1
      }
    }
    i++
  }
  if (last !== string.length) {
    result += string.slice(last)
  }
  return result
}
