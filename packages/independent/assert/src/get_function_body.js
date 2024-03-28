export const getFunctionBody = (fn) => {
  const string = fn.toString();
  for (const candidate of CANDIDATES) {
    const match = string.match(candidate);
    if (match) {
      return removeRootIndentation(match[1]);
    }
  }
  return removeRootIndentation(string);
};

const GETTER_SETTER_FUNCTION_BODY_REGEX =
  /^[gs]et\s*[\S]*\s*\([\s\S]*?\)\s*\{([\s\S]*)\}$/;
const ARROW_FUNCTION_BODY_REGEX = /^\([\s\S]*?\)\s*=>\s*\{([\s\S]*)\}$/;
const ARROW_FUNCTION_SHORTHAND_BODY_REGEX =
  /^\([\s\S]*?\)\s*=>\s*\(([\s\S]*)\)$/;
const FUNCTION_BODY_REGEX = /^function\s*[\S]*\s*\([\s\S]*?\)\s*\{([\s\S]*)\}$/;
const CANDIDATES = [
  ARROW_FUNCTION_BODY_REGEX,
  ARROW_FUNCTION_SHORTHAND_BODY_REGEX,
  FUNCTION_BODY_REGEX,
  GETTER_SETTER_FUNCTION_BODY_REGEX,
];

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
