export const createParseError = ({
  cause,
  filename,
  line,
  column,
  message,
  messageHTML,
}) => {
  const parseError = new Error(message, { cause })
  const code = "PARSE_ERROR"
  parseError.code = code
  parseError.filename = filename
  parseError.line = line
  parseError.column = column
  parseError.asResponse = () => {
    // on the correspondig file
    const json = JSON.stringify({
      code,
      filename,
      line,
      column,
      message,
      messageHTML,
    })
    return {
      status: 500,
      statusText: "parse error",
      headers: {
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(json),
        "content-type": "application/json",
      },
      body: json,
    }
  }
  return parseError
}
