export const getFunctionBody = (fn) => {
  const string = fn.toString();

  const arrowFunctionBodyMatch = string.match(ARROW_FUNCTION_BODY_REGEX);
  if (arrowFunctionBodyMatch) {
    const body = arrowFunctionBodyMatch[1];
    return removeRootIndentation(body);
  }
  const arrowFunctionShorthandBodyMatch = string.match(
    ARROW_FUNCTION_SHORTHAND_BODY_REGEX,
  );
  if (arrowFunctionShorthandBodyMatch) {
    const body = arrowFunctionShorthandBodyMatch[1];
    return removeRootIndentation(body);
  }
  const functionBodyMatch = string.match(FUNCTION_BODY_REGEX);
  if (functionBodyMatch) {
    const body = functionBodyMatch[1];
    return removeRootIndentation(body);
  }
  return removeRootIndentation(string);
};

const ARROW_FUNCTION_BODY_REGEX = /^\([\s\S]*\)\s*=>\s*\{([\s\S]*)\}$/;
const ARROW_FUNCTION_SHORTHAND_BODY_REGEX =
  /^\([\s\S]*\)\s*=>\s*\(([\s\S]*)\)$/;
const FUNCTION_BODY_REGEX = /^function\s*\([\s\S]*\)\s*\{([\s\S]*)\}$/;

const removeRootIndentation = (text) => {
  const lines = text.split(/\r?\n/);
  let result = ``;
  let i = 0;

  let charsToRemove = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isRootLine = (isFirstLine && line.length) || i === 1;
    i++;
    if (isFirstLine && line === "") {
      // remove first line when empty
      continue;
    }
    let lineShortened = "";
    let j = 0;
    let searchIndentChar = true;
    while (j < line.length) {
      const char = line[j];
      j++;
      if (searchIndentChar && (char === " " || char === "\t")) {
        if (isRootLine) {
          charsToRemove++;
          continue;
        }
        if (j <= charsToRemove) {
          continue;
        }
      }
      searchIndentChar = false;
      lineShortened += char;
    }
    if (isLastLine && lineShortened === "") {
      // remove last line when empty
      continue;
    }
    result += isRootLine ? `${lineShortened}` : `\n${lineShortened}`;
  }
  return result;
};

// console.log(
//   getFunctionBody((a = () => {}) => {
//     return a;
//   }),
// );
// console.log(
//   getFunctionBody(() => {
//     return "yo";
//   }),
// );
// console.log(getFunctionBody(() => ({})));
// console.log(
//   getFunctionBody(function (a, b) {
//     return a + b;
//   }),
// );
