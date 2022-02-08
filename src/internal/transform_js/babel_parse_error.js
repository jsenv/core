export const createParseError = ({ message, cause, ...data }) => {
  const parseError = new Error(message, { cause })
  parseError.code = "PARSE_ERROR"
  parseError.data = {
    message,
    ...data,
  }
  parseError.asResponse = () => {
    // on the correspondig file
    const json = JSON.stringify(parseError.data)
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
