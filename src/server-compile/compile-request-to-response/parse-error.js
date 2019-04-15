export const createParseError = ({ message, ...data }) => {
  const parseError = new Error(message)
  parseError.code = "PARSE_ERROR"
  parseError.data = data

  return parseError
}
