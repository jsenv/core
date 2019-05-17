import { regexpEscape } from "../stringHelper.js"

export const transformBabelParseErrorMessage = (babelParseErrorMessage, filename, replacement) => {
  // the babelParseErrorMessage looks somehow like that:
  /*
  `${filename}: Unexpected token(${lineNumber}:${columnNumber}})

    ${lineNumber - 1} | ${sourceForThatLine}
  > ${lineNumber} | ${sourceForThatLine}
    | ^`
  */
  // and the idea is to replace ${filename} by something else

  const filenameRegexp = new RegExp(regexpEscape(filename), "gi")
  const parseErrorMessage = babelParseErrorMessage.replace(filenameRegexp, replacement)
  return parseErrorMessage
}
