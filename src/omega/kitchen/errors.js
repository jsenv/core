export const createPluginHookError = ({ plugin, message, cause }) => {
  let errorMessage
  if (cause && cause.code === "EPERM") {
    errorMessage = `not allowed to read entry on filesystem at ${cause.path}`
  } else if (cause && cause.code === "EISDIR") {
    errorMessage = `found a directory at ${cause.path}`
  } else if (cause && cause.code === "ENOENT") {
    errorMessage = `no entry on filesystem at ${cause.path}`
  } else if (cause) {
    errorMessage = cause.message
  } else {
    errorMessage = cause
  }
  const pluginError = new Error(
    `${message}
// TODO: put the url trace
// we need something like context.urlTrace = {url, line, column, content}
--- error message ---
${errorMessage}
--- error stack ---
${cause.stack}
--- plugin name ---
${plugin.name}`,
  )
  return pluginError
}

export const createNotFoundError = ({ message }) => {
  const error = new Error(message)
  error.code = "NOT_FOUND"
  return error
}

export const createNotAllowedError = ({ message }) => {
  const error = new Error(message)
  error.code = "NOT_ALLOWED"
  return error
}

export const createParseError = ({ message }) => {
  const error = new Error(message)
  error.code = "PARSE_ERROR"
  return error
}
