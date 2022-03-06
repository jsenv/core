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
