// This file is used just for test and internal tests
// so super-linear-backtracking is ok
// and I don't know how to update the regexes to prevent this
/* eslint-disable regexp/no-super-linear-backtracking */

export const parseFunction = (fn) => {
  const string = fn.toString();
  for (const candidate of CANDIDATES) {
    const returnValue = candidate(string, fn);
    if (returnValue) {
      return returnValue;
    }
  }
  return {
    type: "unknwon",
    name: "",
    argsSource: "()",
    body: removeRootIndentation(string),
  };
};

const CANDIDATES = [
  (fnString, fn) => {
    const ARROW_FUNCTION_BODY_REGEX = /^(\([\s\S]*?\))\s*=>\s*\{([\s\S]*)\}$/;
    const match = fnString.match(ARROW_FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: "arrow",
        name: fn.name,
        argsSource: normalizeArgsSource(match[1]),
        body: removeRootIndentation(match[2]),
      };
    }
    return null;
  },
  (fnString, fn) => {
    const ARROW_FUNCTION_SHORTHAND_BODY_REGEX =
      /^(\([\s\S]*?\))\s*=>\s*([\s\S]*)$/;
    const match = fnString.match(ARROW_FUNCTION_SHORTHAND_BODY_REGEX);
    if (match) {
      return {
        type: "arrow",
        name: fn.name,
        argsSource: normalizeArgsSource(match[1]),
        body: removeRootIndentation(match[2]),
      };
    }
    return null;
  },
  (fnString) => {
    const FUNCTION_BODY_REGEX =
      /^function\s*(\S*)\s*(\([\s\S]*?\))\s*\{([\s\S]*)\}$/;
    const match = fnString.match(FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: "classic",
        name: match[1],
        argsSource: normalizeArgsSource(match[2]),
        body: removeRootIndentation(match[3]),
      };
    }
    return null;
  },
  (fnString) => {
    const GETTER_SETTER_FUNCTION_BODY_REGEX =
      /^[gs]et\s*(\S*)\s*(\([\s\S]*?\))\s*\{([\s\S]*)\}$/;
    const match = fnString.match(GETTER_SETTER_FUNCTION_BODY_REGEX);
    if (match) {
      return {
        type: fnString.startsWith("get") ? "getter" : "setter",
        name: match[1],
        argsSource: normalizeArgsSource(match[2]),
        body: removeRootIndentation(match[3]),
      };
    }
    return null;
  },
];
// function with default params not supported and fallback to "()"
const normalizeArgsSource = (argsSource) => {
  if (argsSource.indexOf("(", 1)) {
    return "()";
  }
  return argsSource;
};

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
