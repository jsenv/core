import { createDetailedMessage } from "./detailed_message.js"

export const remapSourcePosition = async ({
  source,
  line,
  column,
  resolveFile,
  urlToSourcemapConsumer,
  readErrorStack,
  onFailure,
}) => {
  const position = { source, line, column }

  const url = sourceToUrl(source, { resolveFile })
  if (!url) return position

  const sourceMapConsumer = await urlToSourcemapConsumer(url)

  if (!sourceMapConsumer) return position

  try {
    const originalPosition = sourceMapConsumer.originalPositionFor(position)

    // Only return the original position if a matching line was found. If no
    // matching line is found then we return position instead, which will cause
    // the stack trace to print the path and line for the compiled file. It is
    // better to give a precise location in the compiled file than a vague
    // location in the original file.
    const originalSource = originalPosition.source

    if (originalSource === null) return position
    originalPosition.source = resolveFile(originalSource, url, {
      type: "file-original",
    })

    return originalPosition
  } catch (e) {
    onFailure(
      createDetailedMessage(`error while remapping position.`, {
        ["error stack"]: readErrorStack(e),
        ["source"]: source,
        ["line"]: line,
        ["column"]: column,
      }),
    )
    return position
  }
}

const sourceToUrl = (source, { resolveFile }) => {
  if (startsWithScheme(source)) {
    return source
  }

  // linux filesystem path
  if (source[0] === "/") {
    return resolveFile(source)
  }

  // be careful, due to babel or something like that we might receive paths like
  // C:/directory/file.js (without backslashes we would expect on windows)
  // In that case we consider C: is the signe we are on windows
  // And I avoid to rely on process.platform === "win32" because this file might be executed in chrome
  if (startsWithWindowsDriveLetter(source)) {
    return windowsFilePathToUrl(source)
  }

  // I don't think we will ever encounter relative file in the stack trace
  // but if it ever happens we are safe :)
  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    return resolveFile(source)
  }

  // we have received a "bare specifier" for the source
  // it happens for internal/process/task_queues.js for instance
  // if we do return resolveFile(source) it will be converted to
  // file:///C:/project-directory/internal/process/task_queues.js in node
  // and
  // http://domain.com/internal/process/task_queues.js
  // but the file will certainly be a 404
  // and if not it won't be the right file anyway
  // for now we assume "bare specifier" in the stack trace
  // are internal files that are pointless to try to remap
  return null
}

const startsWithScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
}

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0]
  if (!/[a-zA-Z]/.test(firstChar)) return false

  const secondChar = string[1]
  if (secondChar !== ":") return false

  return true
}

const windowsFilePathToUrl = (windowsFilePath) => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`
}

export const replaceBackSlashesWithSlashes = (string) =>
  string.replace(/\\/g, "/")
