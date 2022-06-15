import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/urls"

export const getCallerPosition = () => {
  const { prepareStackTrace } = Error
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace
    return stack
  }
  const { stack } = new Error()
  const callerCallsite = stack[2]
  const fileName = callerCallsite.getFileName()
  return {
    url:
      fileName && isFileSystemPath(fileName)
        ? fileSystemPathToUrl(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  }
}
