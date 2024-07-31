import { fileSystemPathToUrl, isFileSystemPath } from "@jsenv/urls";

export const getCallerLocation = (callIndex = 1) => {
  const { prepareStackTrace } = Error;
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace;
    return stack;
  };
  const { stack } = new Error();
  Error.prepareStackTrace = prepareStackTrace;
  const callerCallsite = stack[callIndex];
  const fileName = callerCallsite.getFileName();
  const testCallSite = {
    url:
      fileName && isFileSystemPath(fileName)
        ? fileSystemPathToUrl(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  };
  return testCallSite;
};
