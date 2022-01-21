export const createParseError = ({ message, cause, ...data }) => {
  const parseError = new Error(message, { cause })
  parseError.code = "PARSE_ERROR"
  parseError.data = {
    message,
    ...data,
  }
  return parseError
}
