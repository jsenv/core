// https://stackoverflow.com/a/1184263
// using the list of bad characters from:
// https://github.com/parshap/node-sanitize-filename/blob/master/index.js
// so that the directory name can be decoded
// so that we can find back the http origin
// we should also ignore the query string params part
// it does not matter, it can be removed from the url and added back
// when performing the http request

const escapeChar = "%"
const reservedChars = ["/", "?", "<", ">", "\\", ":", "*", "|", '"']

export const encodeOriginToFilename = (origin) => {
  let directoryName = ""
  let i = 0
  while (i < origin.length) {
    const char = origin[i]
    i++
    if (reservedChars.includes(char)) {
      const charAsHex = charToHexString(char)
      directoryName += `${escapeChar}${charAsHex}`
    } else {
      directoryName += char
    }
  }
  return directoryName
}

export const decodeOriginFromFilename = (filename) => {
  let origin = ""
  let i = 0
  while (i < filename.length) {
    const char = filename[i]
    i++
    if (char === escapeChar) {
      const encodedChar = `${filename[i]}${filename[i + 1]}`
      i += 2
      const decodedChar = charFromHexString(encodedChar)
      origin += decodedChar
    } else {
      origin += char
    }
  }
  return origin
}

const charToHexString = (char) => {
  const charCode = char.charCodeAt(0)
  const hexString = charCode.toString(16)
  if (charCode < 16) {
    return `0${hexString}`
  }
  return hexString
}

const charFromHexString = (hexString) => {
  const charCode = parseInt(hexString, 16)
  const char = String.fromCharCode(charCode)
  return char
}
