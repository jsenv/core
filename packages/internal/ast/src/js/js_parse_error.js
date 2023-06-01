export const createJsParseError = ({
  message,
  reasonCode,
  url,
  line,
  column,
}) => {
  const parseError = new Error(message);
  parseError.reasonCode = reasonCode;
  parseError.code = "PARSE_ERROR";
  parseError.url = url;
  parseError.line = line;
  parseError.column = column;
  return parseError;
};
