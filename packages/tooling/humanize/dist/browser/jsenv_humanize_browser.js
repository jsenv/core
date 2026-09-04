import { parseDuration } from "@jsenv/validity";

const createDetailedMessage = (message, details = {}) => {
  let text = `${message}`;
  const namedSectionsText = renderNamedSections(details);
  if (namedSectionsText) {
    text += `
${namedSectionsText}`;
  }
  return text;
};

const renderNamedSections = (namedSections) => {
  let text = "";
  let keys = Object.keys(namedSections);
  for (const key of keys) {
    const isLastKey = key === keys[keys.length - 1];
    const value = namedSections[key];
    text += `--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
    if (!isLastKey) {
      text += "\n";
    }
  }
  return text;
};

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

const RED = "red";
const GREEN = "green";
const YELLOW = "yellow";
const BLUE = "blue";
const MAGENTA = "magenta";
const CYAN = "cyan";
const GREY = "grey";
const WHITE = "white";
const BLACK = "black";

const TEXT_COLOR_ANSI_CODES = {
  [RED]: "\x1b[31m",
  [GREEN]: "\x1b[32m",
  [YELLOW]: "\x1b[33m",
  [BLUE]: "\x1b[34m",
  [MAGENTA]: "\x1b[35m",
  [CYAN]: "\x1b[36m",
  [GREY]: "\x1b[90m",
  [WHITE]: "\x1b[37m",
  [BLACK]: "\x1b[30m",
};
const BACKGROUND_COLOR_ANSI_CODES = {
  [RED]: "\x1b[41m",
  [GREEN]: "\x1b[42m",
  [YELLOW]: "\x1b[43m",
  [BLUE]: "\x1b[44m",
  [MAGENTA]: "\x1b[45m",
  [CYAN]: "\x1b[46m",
  [GREY]: "\x1b[100m",
  [WHITE]: "\x1b[47m",
  [BLACK]: "\x1b[40m",
};

const createAnsi = ({ supported }) => {
  const ANSI = {
    supported,

    RED,
    GREEN,
    YELLOW,
    BLUE,
    MAGENTA,
    CYAN,
    GREY,
    WHITE,
    BLACK,
    color: (text, color) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!color) {
        return text;
      }
      if (typeof text === "string" && text.trim() === "") {
        // cannot set color of blank chars
        return text;
      }
      const ansiEscapeCodeForTextColor = TEXT_COLOR_ANSI_CODES[color];
      if (!ansiEscapeCodeForTextColor) {
        return text;
      }
      return `${ansiEscapeCodeForTextColor}${text}${RESET}`;
    },
    backgroundColor: (text, color) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!color) {
        return text;
      }
      if (typeof text === "string" && text.trim() === "") {
        // cannot set background color of blank chars
        return text;
      }
      const ansiEscapeCodeForBackgroundColor =
        BACKGROUND_COLOR_ANSI_CODES[color];
      if (!ansiEscapeCodeForBackgroundColor) {
        return text;
      }
      return `${ansiEscapeCodeForBackgroundColor}${text}${RESET}`;
    },

    BOLD: "\x1b[1m",
    UNDERLINE: "\x1b[4m",
    STRIKE: "\x1b[9m",
    effect: (text, effect) => {
      if (!ANSI.supported) {
        return text;
      }
      if (!effect) {
        return text;
      }
      // cannot add effect to empty string
      if (text === "") {
        return text;
      }
      const ansiEscapeCodeForEffect = effect;
      return `${ansiEscapeCodeForEffect}${text}${RESET}`;
    },
  };

  return ANSI;
};

const ANSI = createAnsi({ supported: true });

// see also https://github.com/sindresorhus/figures

const createUnicode = ({ supported, ANSI }) => {
  const UNICODE = {
    supported,
    get COMMAND_RAW() {
      return UNICODE.supported ? `❯` : `>`;
    },
    get OK_RAW() {
      return UNICODE.supported ? `✔` : `√`;
    },
    get FAILURE_RAW() {
      return UNICODE.supported ? `✖` : `×`;
    },
    get DEBUG_RAW() {
      return UNICODE.supported ? `◆` : `♦`;
    },
    get INFO_RAW() {
      return UNICODE.supported ? `ℹ` : `i`;
    },
    get WARNING_RAW() {
      return UNICODE.supported ? `⚠` : `‼`;
    },
    get CIRCLE_CROSS_RAW() {
      return UNICODE.supported ? `ⓧ` : `(×)`;
    },
    get CIRCLE_DOTTED_RAW() {
      return UNICODE.supported ? `◌` : `*`;
    },
    get COMMAND() {
      return ANSI.color(UNICODE.COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
    },
    get OK() {
      return ANSI.color(UNICODE.OK_RAW, ANSI.GREEN);
    },
    get FAILURE() {
      return ANSI.color(UNICODE.FAILURE_RAW, ANSI.RED);
    },
    get DEBUG() {
      return ANSI.color(UNICODE.DEBUG_RAW, ANSI.GREY);
    },
    get INFO() {
      return ANSI.color(UNICODE.INFO_RAW, ANSI.BLUE);
    },
    get WARNING() {
      return ANSI.color(UNICODE.WARNING_RAW, ANSI.YELLOW);
    },
    get CIRCLE_CROSS() {
      return ANSI.color(UNICODE.CIRCLE_CROSS_RAW, ANSI.RED);
    },
    get ELLIPSIS() {
      return UNICODE.supported ? `…` : `...`;
    },
  };
  return UNICODE;
};

const UNICODE = createUnicode({
  supported: true,
  ANSI,
});

const inspectBoolean = (value) => value.toString();

const inspectNull = () => "null";

// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/numeric-separators-style.js

const inspectNumber = (value, { numericSeparator }) => {
  if (isNegativeZero(value)) {
    return "-0";
  }
  // isNaN
  // eslint-disable-next-line no-self-compare
  if (value !== value) {
    return "NaN";
  }
  if (value === Infinity) {
    return "Infinity";
  }
  if (value === -Infinity) {
    return "-Infinity";
  }
  const numberString = String(value);
  if (!numericSeparator) {
    return numberString;
  }
  const {
    number,
    mark = "",
    sign = "",
    power = "",
  } = numberString.match(
    /^(?<number>.*?)(?:(?<mark>e)(?<sign>[+-])?(?<power>\d+))?$/i,
  ).groups;
  const numberWithSeparators = formatNumber$1(number);
  const powerWithSeparators = addSeparator(power, {
    minimumDigits: 5,
    groupLength: 3,
  });
  return `${numberWithSeparators}${mark}${sign}${powerWithSeparators}`;
};

// Use this and instead of Object.is(value, -0)
// because in some corner cases firefox returns false
// for Object.is(-0, -0)
const isNegativeZero = (value) => {
  return value === 0 && 1 / value === -Infinity;
};

const formatNumber$1 = (numberString) => {
  const parts = numberString.split(".");
  const [integer, fractional] = parts;

  if (parts.length === 2) {
    const integerWithSeparators = addSeparator(integer, {
      minimumDigits: 5,
      groupLength: 3,
    });
    return `${integerWithSeparators}.${fractional}`;
  }

  return addSeparator(integer, {
    minimumDigits: 5,
    groupLength: 3,
  });
};

const addSeparator = (numberString, { minimumDigits, groupLength }) => {
  if (numberString[0] === "-") {
    return `-${groupDigits(numberString.slice(1), {
      minimumDigits,
      groupLength,
    })}`;
  }
  return groupDigits(numberString, { minimumDigits, groupLength });
};

const groupDigits = (digits, { minimumDigits, groupLength }) => {
  const digitCount = digits.length;
  if (digitCount < minimumDigits) {
    return digits;
  }

  let digitsWithSeparator = digits.slice(-groupLength);
  let remainingDigits = digits.slice(0, -groupLength);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-groupLength);
    remainingDigits = remainingDigits.slice(0, -groupLength);
    digitsWithSeparator = `${group}_${digitsWithSeparator}`;
  }
  return digitsWithSeparator;
};

// const addSeparatorFromLeft = (value, { minimumDigits, groupLength }) => {
//   const { length } = value;
//   if (length < minimumDigits) {
//     return value;
//   }

//   const parts = [];
//   for (let start = 0; start < length; start += groupLength) {
//     const end = Math.min(start + groupLength, length);
//     parts.push(value.slice(start, end));
//   }
//   return parts.join("_");
// };

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";

const inspectString = (
  value,
  {
    quote = "auto",
    canUseTemplateString = false,
    preserveLineBreaks = false,
    quoteDefault = DOUBLE_QUOTE,
  } = {},
) => {
  quote =
    quote === "auto"
      ? determineQuote(value, { canUseTemplateString, quoteDefault })
      : quote;
  if (quote === BACKTICK) {
    return `\`${escapeTemplateStringSpecialCharacters(value)}\``;
  }
  return surroundStringWith(value, { quote, preserveLineBreaks });
};

// https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1
const escapeTemplateStringSpecialCharacters = (string) => {
  string = String(string);
  let i = 0;
  let escapedString = "";
  while (i < string.length) {
    const char = string[i];
    i++;
    escapedString += isTemplateStringSpecialChar(char) ? `\\${char}` : char;
  }
  return escapedString;
};

const isTemplateStringSpecialChar = (char) =>
  templateStringSpecialChars.indexOf(char) > -1;
const templateStringSpecialChars = ["\\", "`", "$"];

const determineQuote = (
  string,
  { canUseTemplateString, quoteDefault = DOUBLE_QUOTE } = {},
) => {
  const containsDoubleQuote = string.includes(DOUBLE_QUOTE);
  if (!containsDoubleQuote) {
    return DOUBLE_QUOTE;
  }
  const containsSimpleQuote = string.includes(SINGLE_QUOTE);
  if (!containsSimpleQuote) {
    return SINGLE_QUOTE;
  }
  if (canUseTemplateString) {
    const containsBackTick = string.includes(BACKTICK);
    if (!containsBackTick) {
      return BACKTICK;
    }
  }
  const doubleQuoteCount = string.split(DOUBLE_QUOTE).length - 1;
  const singleQuoteCount = string.split(SINGLE_QUOTE).length - 1;
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return quoteDefault;
};

const inspectChar = (char, { quote, preserveLineBreaks }) => {
  const point = char.charCodeAt(0);
  if (preserveLineBreaks && (char === "\n" || char === "\r")) {
    return char;
  }
  if (
    char === quote ||
    point === 92 ||
    point < 32 ||
    (point > 126 && point < 160) ||
    // line separators
    point === 8232 ||
    point === 8233
  ) {
    const replacement =
      char === quote
        ? `\\${quote}`
        : point === 8232
          ? "\\u2028"
          : point === 8233
            ? "\\u2029"
            : meta[point];
    return replacement;
  }
  return char;
};

// https://github.com/jsenv/jsenv-uneval/blob/6c97ef9d8f2e9425a66f2c88347e0a118d427f3a/src/internal/escapeString.js#L3
// https://github.com/jsenv/jsenv-inspect/blob/bb11de3adf262b68f71ed82b0a37d4528dd42229/src/internal/string.js#L3
// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const surroundStringWith = (string, { quote, preserveLineBreaks }) => {
  let result = "";
  let last = 0;
  const lastIndex = string.length;
  let i = 0;
  while (i < lastIndex) {
    const char = string[i];
    const replacement = inspectChar(char, { quote, preserveLineBreaks });
    if (char !== replacement) {
      if (last === i) {
        result += replacement;
      } else {
        result += `${string.slice(last, i)}${replacement}`;
      }
      last = i + 1;
    }
    i++;
  }
  if (last !== lastIndex) {
    result += string.slice(last);
  }
  return `${quote}${result}${quote}`;
};

// prettier-ignore
const meta = [
  '\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07', // x07
  '\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',           // x0F
  '\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17', // x17
  '\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F', // x1F
  '', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',      // x2F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x3F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x4F
  '', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',     // x5F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x6F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',    // x7F
  '\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87', // x87
  '\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F', // x8F
  '\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97', // x97
  '\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F', // x9F
];

const inspectSymbol = (value, { nestedHumanize, parenthesis }) => {
  const symbolDescription = symbolToDescription(value);
  const symbolDescriptionSource = symbolDescription
    ? nestedHumanize(symbolDescription)
    : "";
  const symbolSource = `Symbol(${symbolDescriptionSource})`;

  if (parenthesis) return `${symbolSource}`;
  return symbolSource;
};

const symbolToDescription =
  "description" in Symbol.prototype
    ? (symbol) => symbol.description
    : (symbol) => {
        const toStringResult = symbol.toString();
        const openingParenthesisIndex = toStringResult.indexOf("(");
        const closingParenthesisIndex = toStringResult.indexOf(")");
        const symbolDescription = toStringResult.slice(
          openingParenthesisIndex + 1,
          closingParenthesisIndex,
        );
        return symbolDescription;
      };

const inspectUndefined = () => "undefined";

const inspectBigInt = (value) => {
  return `${value}n`;
};

const prefixFirstAndIndentRemainingLines = (
  text,
  { prefix, indentation, trimLines, trimLastLine },
) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  if (indentation === undefined) {
    if (prefix) {
      indentation = "  "; // prefix + space
    } else {
      indentation = "";
    }
  }
  let result = prefix ? `${prefix} ${firstLine}` : firstLine;
  let i = 0;
  while (i < lines.length) {
    const line = trimLines ? lines[i].trim() : lines[i];
    i++;
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
        ? ""
        : `\n`;
  }
  return result;
};

const preNewLineAndIndentation = (
  value,
  { depth = 0, indentUsingTab, indentSize },
) => {
  return `${newLineAndIndent({
    count: depth + 1,
    useTabs: indentUsingTab,
    size: indentSize,
  })}${value}`;
};

const postNewLineAndIndentation = ({ depth, indentUsingTab, indentSize }) => {
  return newLineAndIndent({
    count: depth,
    useTabs: indentUsingTab,
    size: indentSize,
  });
};

const newLineAndIndent = ({ count, useTabs, size }) => {
  if (useTabs) {
    // eslint-disable-next-line prefer-template
    return "\n" + "\t".repeat(count);
  }
  // eslint-disable-next-line prefer-template
  return "\n" + " ".repeat(count * size);
};

const wrapNewLineAndIndentation = (
  value,
  { depth = 0, indentUsingTab, indentSize },
) => {
  return `${preNewLineAndIndentation(value, {
    depth,
    indentUsingTab,
    indentSize,
  })}${postNewLineAndIndentation({ depth, indentUsingTab, indentSize })}`;
};

const inspectConstructor = (value, { parenthesis, useNew }) => {
  let formattedString = value;
  if (parenthesis) {
    formattedString = `(${value})`;
  }
  if (useNew) {
    formattedString = `new ${formattedString}`;
  }
  return formattedString;
};

const inspectArray = (
  value,
  {
    seen = [],
    nestedHumanize,
    depth,
    indentUsingTab,
    indentSize,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) {
    return "Symbol.for('circular')";
  }
  seen.push(value);

  let valuesSource = "";
  let i = 0;
  const j = value.length;

  while (i < j) {
    const valueSource = value.hasOwnProperty(i)
      ? nestedHumanize(value[i], { seen })
      : "";
    if (i === 0) {
      valuesSource += valueSource;
    } else {
      valuesSource += `,${preNewLineAndIndentation(valueSource, {
        depth,
        indentUsingTab,
        indentSize,
      })}`;
    }
    i++;
  }

  let arraySource;
  if (valuesSource.length) {
    arraySource = wrapNewLineAndIndentation(valuesSource, {
      depth,
      indentUsingTab,
      indentSize,
    });
  } else {
    arraySource = "";
  }

  arraySource = `[${arraySource}]`;

  return inspectConstructor(arraySource, { parenthesis, useNew });
};

const inspectBigIntObject = (value, { nestedHumanize }) => {
  const bigIntSource = nestedHumanize(value.valueOf());

  return `BigInt(${bigIntSource})`;
};

const inspectBooleanObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const booleanSource = nestedHumanize(value.valueOf());
  return inspectConstructor(`Boolean(${booleanSource})`, {
    useNew,
    parenthesis,
  });
};

const inspectError = (
  error,
  { nestedHumanize, useNew, parenthesis },
) => {
  const messageSource = nestedHumanize(error.message);

  const errorSource = inspectConstructor(
    `${errorToConstructorName(error)}(${messageSource})`,
    {
      useNew,
      parenthesis,
    },
  );
  return errorSource;
};

const errorToConstructorName = ({ name }) => {
  if (derivedErrorNameArray.includes(name)) {
    return name;
  }
  return "Error";
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
const derivedErrorNameArray = [
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
];

const inspectDate = (value, { nestedHumanize, useNew, parenthesis }) => {
  const dateSource = nestedHumanize(value.toISOString(), {
    numericSeparator: false,
  });
  return inspectConstructor(`Date(${dateSource})`, {
    useNew,
    parenthesis,
  });
};

const inspectFunction = (
  value,
  { showFunctionBody, parenthesis, depth },
) => {
  let functionSource;
  if (showFunctionBody) {
    functionSource = value.toString();
  } else {
    const isArrowFunction = value.prototype === undefined;
    const head = isArrowFunction
      ? "() =>"
      : `function ${depth === 0 ? value.name : ""}()`;
    functionSource = `${head} {/* hidden */}`;
  }

  if (parenthesis) {
    return `(${functionSource})`;
  }
  return functionSource;
};

const inspectNumberObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const numberSource = nestedHumanize(value.valueOf());
  return inspectConstructor(`Number(${numberSource})`, { useNew, parenthesis });
};

const inspectObject = (
  value,
  {
    nestedHumanize,
    seen = [],
    depth,
    indentUsingTab,
    indentSize,
    objectConstructor,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) return "Symbol.for('circular')";

  seen.push(value);

  const propertySourceArray = [];
  Object.getOwnPropertyNames(value).forEach((propertyName) => {
    const propertyNameAsNumber = Number(propertyName);
    const propertyNameSource = nestedHumanize(
      Number.isInteger(propertyNameAsNumber) && !isNaN(propertyNameAsNumber)
        ? propertyNameAsNumber
        : propertyName,
    );
    propertySourceArray.push({
      nameOrSymbolSource: propertyNameSource,
      valueSource: nestedHumanize(value[propertyName], { seen }),
    });
  });
  Object.getOwnPropertySymbols(value).forEach((symbol) => {
    propertySourceArray.push({
      nameOrSymbolSource: `[${nestedHumanize(symbol)}]`,
      valueSource: nestedHumanize(value[symbol], { seen }),
    });
  });

  let propertiesSource = "";
  propertySourceArray.forEach(({ nameOrSymbolSource, valueSource }, index) => {
    if (index === 0) {
      propertiesSource += `${nameOrSymbolSource}: ${valueSource}`;
    } else {
      propertiesSource += `,${preNewLineAndIndentation(
        `${nameOrSymbolSource}: ${valueSource}`,
        {
          depth,
          indentUsingTab,
          indentSize,
        },
      )}`;
    }
  });

  let objectSource;
  if (propertiesSource.length) {
    objectSource = `${wrapNewLineAndIndentation(propertiesSource, {
      depth,
      indentUsingTab,
      indentSize,
    })}`;
  } else {
    objectSource = "";
  }

  if (objectConstructor) {
    objectSource = `Object({${objectSource}})`;
  } else {
    objectSource = `{${objectSource}}`;
  }

  return inspectConstructor(objectSource, { parenthesis, useNew });
};

const inspectRegExp = (value) => value.toString();

const inspectStringObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const stringSource = nestedHumanize(value.valueOf());

  return inspectConstructor(`String(${stringSource})`, { useNew, parenthesis });
};

// tslint:disable:ordered-imports


const humanize = (
  value,
  {
    parenthesis = false,
    quote = "auto",
    canUseTemplateString = true,
    useNew = false,
    objectConstructor = false,
    showFunctionBody = false,
    indentUsingTab = false,
    indentSize = 2,
    numericSeparator = true,
    preserveLineBreaks = false,
  } = {},
) => {
  const scopedHumanize = (scopedValue, scopedOptions) => {
    const options = {
      ...scopedOptions,
      nestedHumanize: (nestedValue, nestedOptions = {}) => {
        return scopedHumanize(nestedValue, {
          ...scopedOptions,
          depth: scopedOptions.depth + 1,
          ...nestedOptions,
        });
      },
    };
    return humanizeValue(scopedValue, options);
  };

  return scopedHumanize(value, {
    parenthesis,
    quote,
    canUseTemplateString,
    useNew,
    objectConstructor,
    showFunctionBody,
    indentUsingTab,
    indentSize,
    numericSeparator,
    preserveLineBreaks,
    depth: 0,
  });
};

const humanizeMethodSymbol = Symbol.for("inspect");

const humanizeValue = (value, options) => {
  const customHumanize = value && value[humanizeMethodSymbol];
  if (customHumanize) {
    return customHumanize(options);
  }
  const primitiveType = primitiveTypeFromValue(value);
  const primitiveStringifier = primitiveStringifiers[primitiveType];
  if (primitiveStringifier) {
    return primitiveStringifier(value, options);
  }
  const compositeType = compositeTypeFromObject(value);
  const compositeStringifier = compositeStringifiers[compositeType];
  if (compositeStringifier) {
    return compositeStringifier(value, options);
  }
  return inspectConstructor(
    `${compositeType}(${inspectObject(value, options)})`,
    {
      ...options,
      parenthesis: false,
    },
  );
};

const primitiveTypeFromValue = (value) => {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return typeof value;
};
const primitiveStringifiers = {
  boolean: inspectBoolean,
  function: inspectFunction,
  null: inspectNull,
  number: inspectNumber,
  string: inspectString,
  symbol: inspectSymbol,
  undefined: inspectUndefined,
  bigint: inspectBigInt,
};
const compositeTypeFromObject = (object) => {
  if (typeof object === "object" && Object.getPrototypeOf(object) === null) {
    return "Object";
  }
  const toStringResult = toString.call(object);
  // returns format is '[object ${tagName}]';
  // and we want ${tagName}
  const tagName = toStringResult.slice("[object ".length, -1);
  if (tagName === "Object") {
    const objectConstructorName = object.constructor.name;
    if (objectConstructorName !== "Object") {
      return objectConstructorName;
    }
  }
  return tagName;
};
const { toString } = Object.prototype;

const compositeStringifiers = {
  Array: inspectArray,
  BigInt: inspectBigIntObject,
  Boolean: inspectBooleanObject,
  Error: inspectError,
  Date: inspectDate,
  Function: inspectFunction,
  Number: inspectNumberObject,
  Object: inspectObject,
  RegExp: inspectRegExp,
  String: inspectStringObject,
};

const getPrecision = (number) => {
  if (Math.floor(number) === number) return 0;
  const [, decimals] = number.toString().split(".");
  return decimals.length || 0;
};

const setRoundedPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round,
  });
};

const setPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: parseInt,
  });
};

const setDecimalsPrecision = (
  number,
  {
    transform,
    decimals, // max decimals for number in [-Infinity, -1[]1, Infinity]
    decimalsWhenSmall, // max decimals for number in [-1,1]
  } = {},
) => {
  if (number === 0) {
    return 0;
  }
  let numberCandidate = Math.abs(number);
  if (numberCandidate < 1) {
    const integerGoal = Math.pow(10, decimalsWhenSmall - 1);
    let i = 1;
    while (numberCandidate < integerGoal) {
      numberCandidate *= 10;
      i *= 10;
    }
    const asInteger = transform(numberCandidate);
    const asFloat = asInteger / i;
    return number < 0 ? -asFloat : asFloat;
  }
  const coef = Math.pow(10, decimals);
  const numberMultiplied = (number + Number.EPSILON) * coef;
  const asInteger = transform(numberMultiplied);
  const asFloat = asInteger / coef;
  return number < 0 ? -asFloat : asFloat;
};

// https://www.codingem.com/javascript-how-to-limit-decimal-places/
// export const roundNumber = (number, maxDecimals) => {
//   const decimalsExp = Math.pow(10, maxDecimals)
//   const numberRoundInt = Math.round(decimalsExp * (number + Number.EPSILON))
//   const numberRoundFloat = numberRoundInt / decimalsExp
//   return numberRoundFloat
// }

// export const setPrecision = (number, precision) => {
//   if (Math.floor(number) === number) return number
//   const [int, decimals] = number.toString().split(".")
//   if (precision <= 0) return int
//   const numberTruncated = `${int}.${decimals.slice(0, precision)}`
//   return numberTruncated
// }

const UNIT_MS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};
const UNIT_KEYS$1 = Object.keys(UNIT_MS);
const SMALLEST_UNIT_NAME = UNIT_KEYS$1[UNIT_KEYS$1.length - 1];
const TIME_DICTIONARY_EN = {
  year: { long: "year", plural: "years", short: "y" },
  month: { long: "month", plural: "months", short: "m" },
  week: { long: "week", plural: "weeks", short: "w" },
  day: { long: "day", plural: "days", short: "d" },
  hour: { long: "hour", plural: "hours", short: "h" },
  minute: { long: "minute", plural: "minutes", short: "m" },
  second: { long: "second", plural: "seconds", short: "s" },
  joinDuration: (primary, remaining) => `${primary} and ${remaining}`,
};

const humanizeEllapsedTime = (
  ms,
  { short, timeDictionnary = TIME_DICTIONARY_EN } = {},
) => {
  if (ms < 1000) {
    if (short) {
      return `0${timeDictionnary.second.short}`;
    }
    return `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return inspectEllapsedUnit(primary, { short, timeDictionnary });
  }
  const primaryText = inspectEllapsedUnit(primary, {
    short,
    timeDictionnary,
  });
  const remainingText = inspectEllapsedUnit(remaining, {
    short,
    timeDictionnary,
  });
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const inspectEllapsedUnit = (unit, { short, timeDictionnary }) => {
  const count =
    unit.name === "second" ? Math.floor(unit.count) : Math.round(unit.count);
  const name = unit.name;
  if (short) {
    const unitText = timeDictionnary[name].short;
    return `${count}${unitText}`;
  }
  if (count <= 1) {
    const unitText = timeDictionnary[name].long;
    return `${count} ${unitText}`;
  }
  const unitText = timeDictionnary[name].plural;
  return `${count} ${unitText}`;
};

/**
 * Converts a duration in milliseconds into a human-readable string intended for display in
 * CLI output — where readability matters more than precision.
 *
 * - Values below 1ms are displayed as "0 second". Sub-millisecond durations are not
 *   meaningful at human scale, and showing "0.0001 second" (or switching to a "millisecond"
 *   unit) would hurt readability. The chosen trade-off is to always use "second" as the
 *   smallest unit and accept the loss of precision for very small values.
 * - Values below 1s are displayed in fractional seconds (e.g. "0.05 second").
 * - Values are expressed using the two most significant units (e.g. "1 hour and 23 minutes").
 * - Rounding never causes a value to display as the next unit boundary
 *   (e.g. 59_999ms → "59.9 seconds", never "60 seconds").
 *
 * @param {number} ms - Duration in milliseconds.
 * @param {object} [options]
 * @param {boolean} [options.short=false] - Use compact unit symbols (e.g. "1h and 23m").
 * @param {boolean} [options.rounded=true] - Round the last displayed digit. When false, truncates instead.
 * @param {number} [options.decimals] - Override the number of decimal places shown.
 * @returns {string}
 */
const humanizeDuration = (
  ms,
  {
    short,
    rounded = true,
    decimals,
    timeDictionnary = TIME_DICTIONARY_EN,
  } = {},
) => {
  if (ms < 1) {
    if (short) {
      return `0${timeDictionnary.second.short}`;
    }
    return `0 ${timeDictionnary.second.long}`;
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    const primaryUnitIndex = UNIT_KEYS$1.indexOf(primary.name);
    const nextUnitName = UNIT_KEYS$1[primaryUnitIndex - 1];
    const maxCount = nextUnitName
      ? UNIT_MS[nextUnitName] / UNIT_MS[primary.name]
      : null;
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      maxCount,
      short,
      rounded,
      timeDictionnary,
    });
  }
  const primaryText = humanizeDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  const remainingText = humanizeDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
    timeDictionnary,
  });
  if (short) {
    return `${primaryText}${remainingText}`;
  }
  return timeDictionnary.joinDuration(primaryText, remainingText);
};
const humanizeDurationUnit = (
  unit,
  { decimals, maxCount, short, rounded, timeDictionnary },
) => {
  let count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
  if (maxCount !== null && maxCount !== undefined && count >= maxCount) {
    // Prevent rounding up to the next unit boundary (e.g. 59.999s → 60s → cap to 59.9s)
    const factor = Math.pow(10, decimals ?? 0);
    count = Math.floor(unit.count * factor) / factor;
  }
  const name = unit.name;
  if (short) {
    const unitText = timeDictionnary[name].short;
    return `${count}${unitText}`;
  }
  if (count <= 1) {
    const unitText = timeDictionnary[name].long;
    return `${count} ${unitText}`;
  }
  const unitText = timeDictionnary[name].plural;
  return `${count} ${unitText}`;
};

const parseMs = (ms) => {
  let firstUnitName = SMALLEST_UNIT_NAME;
  let firstUnitCount = ms / UNIT_MS[SMALLEST_UNIT_NAME];
  const firstUnitIndex = UNIT_KEYS$1.findIndex((unitName) => {
    if (unitName === SMALLEST_UNIT_NAME) {
      return false;
    }
    const msPerUnit = UNIT_MS[unitName];
    const unitCount = Math.floor(ms / msPerUnit);
    if (unitCount) {
      firstUnitName = unitName;
      firstUnitCount = unitCount;
      return true;
    }
    return false;
  });
  if (firstUnitName === SMALLEST_UNIT_NAME) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  const remainingMs = ms - firstUnitCount * UNIT_MS[firstUnitName];
  const remainingUnitName = UNIT_KEYS$1[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / UNIT_MS[remainingUnitName];
  // - 1 year and 1 second is too much information
  //   so we don't check the remaining units
  // - 1 year and 0.0001 week is awful
  //   hence the if below
  if (Math.round(remainingUnitCount) < 1) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  // When remaining rounds up to a full next-unit (e.g. 59.999s rounds to 60s = 1min),
  // drop the remaining to avoid displaying "59 minutes and 60 seconds".
  const remainingUnitMs = UNIT_MS[remainingUnitName];
  const nextUnitMs = UNIT_MS[firstUnitName];
  const maxRemainingCount = nextUnitMs / remainingUnitMs; // e.g. 60 for seconds-in-a-minute
  // Cap remaining so it never rounds up to the next unit boundary
  // (e.g. 59.5s stays as 59s instead of rounding to 60s = 1min)
  const cappedRemainingCount =
    remainingUnitCount >= maxRemainingCount - 1
      ? maxRemainingCount - 1
      : remainingUnitCount;
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: cappedRemainingCount,
    },
  };
};

const humanizeFileSize = (numberOfBytes, { decimals, short } = {}) => {
  return inspectBytes(numberOfBytes, { decimals, short });
};

const humanizeMemory = (metricValue, { decimals, short } = {}) => {
  return inspectBytes(metricValue, { decimals, fixedDecimals: true, short });
};

const inspectBytes = (
  number,
  { fixedDecimals = false, decimals, short } = {},
) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  );
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  if (decimals === undefined) {
    if (unitNumber < 100) {
      decimals = 1;
    } else {
      decimals = 0;
    }
  }
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals,
    decimalsWhenSmall: 1,
  });
  const value = fixedDecimals
    ? unitNumberRounded.toFixed(decimals)
    : unitNumberRounded;
  if (short) {
    return `${value}${unitName}`;
  }
  return `${value} ${unitName}`;
};

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

// The JSX half of interpolation (VNode detection, fragment assembly) is
// installed by the frontend using it (@jsenv/navi's interpolate.jsx) rather
// than imported: this module sits under createI18n and the formatters, which
// must stay importable where preact is not installed. Until installed, a VNode
// replacement is neither detected nor assembled — values are joined as
// strings — which is only reachable by passing a VNode without going through
// <Interpolate>.
let jsx = null;
const installInterpolateJsx = (runtime) => {
  jsx = runtime;
};

/**
 * Interpolates a template string, replacing `[key]` placeholders with values.
 *
 * Usable on its own — no i18n instance required — whenever a sentence should
 * stay readable as one string instead of being cut into JSX expressions or
 * concatenations. `<Interpolate>` is the JSX form of this function, and
 * `createI18n` runs every translation through it. See @jsenv/navi's
 * `docs/i18n.md`.
 *
 * `[]` was chosen as the placeholder delimiter (rather than `{}` or `{{}}`)
 * because it does not conflict with JSX syntax, JavaScript template literals,
 * or common punctuation in translated strings.
 *
 * @param {string} template
 *   e.g. `"Hello [name], you have [count] messages"`. A non-string is returned
 *   untouched, as is any template when `replacements` is missing.
 * @param {object} [replacements]
 *   Values keyed by placeholder name. A key can be:
 *   - a direct name — `[name]` ← `{ name: "Alice" }`
 *   - a dot-path — `[item.label]` ← `{ item: { label: "Book" } }` (a literal
 *     `"item.label"` key wins over the path)
 *
 *   A value that is a function is called at that point, so an expensive or
 *   lazily-known replacement is only computed when the placeholder is actually
 *   present in this language's template.
 *
 *   A placeholder with no matching value is left in the output as-is
 *   (`"[name]"`), making the gap visible rather than silently empty.
 * @param {object} [options]
 * @param {boolean} [options.allowJsx=false]
 *   Allow VNode replacements (what `<Interpolate>` passes). Without it, a VNode
 *   value warns and is coerced to a string.
 * @returns {string|import("preact").VNode}
 *   A plain string when every replacement is a string, a Preact fragment when
 *   at least one VNode was interpolated with `allowJsx`.
 */
const interpolateText = (
  template,
  replacements,
  { allowJsx = false } = {},
) => {
  if (!replacements || typeof template !== "string") {
    return template;
  }
  const parts = template.split(/(\[[^\]]+\])/);
  let hasVnode = false;
  const resolved = [];
  for (const part of parts) {
    const match = part.match(/^\[([^\]]+)\]$/);
    if (!match) {
      resolved.push(part);
      continue;
    }
    const key = match[1];
    let value = resolveValue(replacements, key, part);
    if (typeof value === "function") {
      value = value();
    }
    if (jsx && jsx.isValidElement(value)) {
      if (allowJsx) {
        hasVnode = true;
      } else {
        console.warn(
          `interpolateText: VNode passed for placeholder [${match[1]}] but allowJsx is false — value coerced to string`,
        );
      }
    }
    resolved.push(value);
  }
  if (!hasVnode) {
    return resolved.join("");
  }
  return jsx.createFragment(resolved);
};

// Resolves a placeholder key against the replacements object.
// 1. Direct lookup: replacements["item.name"]
// 2. Dot-path lookup: replacements["item"]["name"]
// 3. Fallback: the original placeholder string (e.g. "[item.name]")
const resolveValue = (replacements, key, fallback) => {
  if (key in replacements) {
    return replacements[key];
  }
  const dotIndex = key.indexOf(".");
  if (dotIndex !== -1) {
    const head = key.slice(0, dotIndex);
    const tail = key.slice(dotIndex + 1);
    const parent = replacements[head];
    if (parent && typeof parent === "object") {
      const nested = parent[tail];
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return fallback;
};

/**
 * The language every formatter/i18n call falls back to when it is given no
 * `lang` — an injectable source, deliberately free of any import.
 *
 * This module is the seam that keeps text formatting importable outside the
 * browser (a backend wording a date, say): by default the source is the
 * runtime's own locale, exactly what Intl itself would pick. A frontend swaps
 * the source for something live — @jsenv/navi points it at its
 * `languagesSignal`, so the fallback follows the user's language preference,
 * and because the source is read fresh on every call, reading it during a
 * component render subscribes the component the same way reading the signal
 * directly would.
 */

let systemLocale;
let runtimeLangSource = () => {
  systemLocale ??= new Intl.DateTimeFormat().resolvedOptions().locale;
  return systemLocale;
};

const getRuntimeLang = () => runtimeLangSource();

/**
 * @param {() => string|string[]} source - Returns the language (BCP 47 tag,
 *   or an ordered preference array) to use when a call passes no `lang`.
 */
const setRuntimeLangSource = (source) => {
  runtimeLangSource = source;
};

/**
 * Creates a lightweight i18n instance: a central place where an app declares
 * its texts once and reads them back translated into the active language.
 *
 * Worth using even in a single-language app — one registry beats strings
 * scattered across components, and adding a second language later becomes a
 * data change instead of a refactor. See @jsenv/navi's `docs/i18n.md` for how
 * to choose between the two key styles below and how this relates to
 * `humanizeI18n`, the registry the built-in texts live in.
 *
 * @param {object} [options]
 * @param {string} [options.keyLang]
 *   When set, each key also serves as its own translation for `keyLang`.
 *   This allows writing keys directly in that language (typically the language
 *   the app is written in) so only *other* languages need registering:
 *
 *   ```js
 *   const i18n = createI18n({ keyLang: "en" });
 *   i18n.add("Hello [name]!", { fr: "Bonjour [name] !" });
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "fr" }); // "Bonjour Alice !"
 *   ```
 *
 *   `keyLang` only applies to keys passed to `add()`/`addAll()`; a key never
 *   registered stays opaque and comes back as-is.
 *
 *   Without `keyLang`, keys are opaque identifiers and every language
 *   (including the one the app was written in) must be registered explicitly:
 *
 *   ```js
 *   const i18n = createI18n();
 *   i18n.add("greeting", { en: "Hello [name]!", fr: "Bonjour [name] !" });
 *   i18n("greeting", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   ```
 *
 * @param {string} [options.fallbackLang]
 *   Language consulted when the active language has no translation for a key
 *   — per key, not per language: a partially translated language falls through
 *   to `fallbackLang` only for the keys it is missing. Without it, a missing
 *   translation returns the key itself.
 *
 * @param {string|string[]} [options.runtimeLang]
 *   The active language (BCP 47 tag or ordered array of tags) — named
 *   "runtime" rather than "system" because there is no actual access to the
 *   OS/user's system language from a browser, only `navigator.languages` (or
 *   an explicit override) at runtime. Defaults to the shared runtime language
 *   source (see runtime_lang.js) — the runtime's own locale, or whatever a
 *   frontend installed in its place — read fresh on every `format()`/`has()`
 *   call (not frozen at creation time), so overriding the language app-wide
 *   is picked up here too.
 *   Passing an explicit `runtimeLang` opts out of that and stays fixed for
 *   this instance's whole lifetime.
 *
 * ---
 *
 * ## Registration
 *
 * **`i18n.add(key, { lang: "translation" })`** — one key, multiple languages.
 *
 * **`i18n.addAll({ key: { lang: "translation" }, ... })`** — multiple keys at once.
 *
 * **`i18n.addLangKeys(lang, { key: "translation", ... })`** — full language pack
 * (useful when loading a JSON translation file).
 *
 * All three accumulate: registering a key that already exists overwrites that
 * one key and leaves the rest of the language untouched. This is what lets an
 * app override a single built-in text without redeclaring the others.
 *
 * A regional variant (e.g. `"fr-CA"`) automatically inherits all keys from its
 * parent (`"fr"`) that it does not explicitly override:
 * ```js
 * i18n.addLangKeys("fr", { hello: "Bonjour !" });
 * i18n.addLangKeys("fr-CA", { hello: "Allo !" }); // other "fr" keys inherited
 * ```
 * Inheritance is resolved at registration time, so register the parent first.
 *
 * ---
 *
 * ## Reading
 *
 * **`i18n(key, values?, { lang? })`** — the translation for `key`, with
 * `[placeholder]` occurrences replaced from `values` (see `interpolateText`).
 * Returns `key` itself when nothing matches, so an untranslated string still
 * renders something readable. `i18n.format` is an alias of this call.
 *
 * **`i18n.has(key, { lang? })`** — whether a translation genuinely exists,
 * i.e. how to tell "no translation" apart from "translation equal to the key".
 *
 * @returns {Function & { add, addAll, addLangKeys, has, format, languageMap }}
 */
const createI18n = ({ keyLang, fallbackLang, runtimeLang } = {}) => {
  const languageMap = new Map();
  // Bumped by addLangKeys — the only thing besides the active lang itself
  // that could change what getActiveLang()/getResolvedFallbackLang() below
  // resolve to, so it's what invalidates their own small caches.
  let languageMapVersion = 0;

  // Without an explicit runtimeLang, the runtime language source is re-read
  // fresh on every call rather than frozen here — freezing it would silently
  // ignore an app-wide language change (see runtime_lang.js) for the rest of
  // this instance's life.
  const hasExplicitRuntimeLang = runtimeLang !== undefined;

  // matchBestLang does real work (a Map lookup per candidate, a possible
  // "fr-CA" → "fr" split-and-retry loop) — worth skipping on every single
  // format()/has() call in the common case, since what it resolves to only
  // ever changes when languageMap itself changes (addLangKeys) or, for the
  // non-explicit case, when the runtime lang itself changes (see
  // runtime_lang.js; an installed source is expected to keep its reference
  // stable while nothing changed, and the default one caches its string) —
  // comparing those two cheaply (===) is enough to know the cached result
  // below is still valid.
  let cachedActiveLang;
  let cachedActiveLangRuntimeLang;
  let cachedActiveLangVersion = -1;
  const getActiveLang = () => {
    const currentRuntimeLang = hasExplicitRuntimeLang
      ? runtimeLang
      : getRuntimeLang();
    if (
      cachedActiveLangVersion === languageMapVersion &&
      cachedActiveLangRuntimeLang === currentRuntimeLang
    ) {
      return cachedActiveLang;
    }
    cachedActiveLang = matchBestLang(currentRuntimeLang, languageMap);
    cachedActiveLangVersion = languageMapVersion;
    cachedActiveLangRuntimeLang = currentRuntimeLang;
    return cachedActiveLang;
  };

  // fallbackLang is a plain, never-reactive option set once at creation —
  // its own resolution only ever needs recomputing when languageMap does.
  let cachedResolvedFallbackLang;
  let cachedResolvedFallbackLangVersion = -1;
  const getResolvedFallbackLang = () => {
    if (!fallbackLang) {
      return null;
    }
    if (cachedResolvedFallbackLangVersion === languageMapVersion) {
      return cachedResolvedFallbackLang;
    }
    cachedResolvedFallbackLang = matchBestLang(fallbackLang, languageMap);
    cachedResolvedFallbackLangVersion = languageMapVersion;
    return cachedResolvedFallbackLang;
  };

  const addLangKeys = (lang, translations) => {
    // Accumulate: merge with any existing translations for this lang
    const existing = languageMap.get(lang);
    if (existing) {
      translations = { ...existing, ...translations };
    }
    // A regional variant inherits all keys not explicitly overridden
    // e.g. "fr-CA" inherits from "fr"
    const dashIndex = lang.indexOf("-");
    if (dashIndex !== -1) {
      const parentLang = lang.slice(0, dashIndex);
      const parentTranslations = languageMap.get(parentLang);
      if (parentTranslations) {
        translations = { ...parentTranslations, ...translations };
      }
    }
    languageMap.set(lang, translations);
    languageMapVersion++;
  };

  const add = (key, langTranslations) => {
    if (keyLang && !(keyLang in langTranslations)) {
      // Auto-register the key itself as the translation for keyLang
      addLangKeys(keyLang, { [key]: key });
    }
    for (const [lang, value] of Object.entries(langTranslations)) {
      addLangKeys(lang, { [key]: value });
    }
  };

  const addAll = (keyMap) => {
    for (const [key, langTranslations] of Object.entries(keyMap)) {
      add(key, langTranslations);
    }
  };

  const _getTemplate = (key, lang) => {
    // matchBestLang, not matchLang directly: lang can be an ordered array of
    // preferences, and matchLang alone assumes a plain string, throwing on
    // .split() otherwise.
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      const translated = translations[key];
      if (translated !== undefined) {
        return translated;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      const fallbackTranslated = fallbackTranslations[key];
      if (fallbackTranslated !== undefined) {
        return fallbackTranslated;
      }
    }
    // No translation found — return key as-is (opaque fallback)
    return key;
  };

  const format = (key, values, { lang = getActiveLang() } = {}) => {
    const template = _getTemplate(key, lang);
    return interpolateText(template, values);
  };

  const has = (key, { lang = getActiveLang() } = {}) => {
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      if (translations && key in translations) {
        return true;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      if (fallbackTranslations && key in fallbackTranslations) {
        return true;
      }
    }
    return false;
  };

  // The i18n instance is itself a callable function
  const i18n = (key, values, opts) => format(key, values, opts);
  i18n.add = add;
  i18n.addAll = addAll;
  i18n.addLangKeys = addLangKeys;
  i18n.has = has;
  i18n.format = format;
  i18n.languageMap = languageMap;

  return i18n;
};

// Walk "fr-CA-variant" → "fr-CA" → "fr" until a registered lang is found
const matchLang = (lang, languageMap) => {
  if (languageMap.has(lang)) {
    return lang;
  }
  const parts = lang.split("-");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join("-");
    if (languageMap.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

// lang can be a string or an ordered array of preference strings
const matchBestLang = (lang, languageMap) => {
  if (!lang) {
    return null;
  }
  const candidates = Array.isArray(lang) ? lang : [lang];
  for (const candidate of candidates) {
    const match = matchLang(candidate, languageMap);
    if (match) {
      return match;
    }
  }
  return null;
};

/**
 * The shared registry holding the texts jsenv libraries display on their own:
 * the words this package's formatters need — relative time wording, duration
 * unit symbols, date field placeholders — and, when @jsenv/navi is installed,
 * everything its components say (button labels, validation messages,
 * empty-list messages…).
 *
 * One instance for all of them rather than one per package: a text belongs to
 * whoever displays it, but an app overriding one wants a single handle to do
 * it through. navi registers its own keys here and re-exports this very
 * object as `naviI18n`, so a `time.*` key registered below is overridable
 * from either name.
 *
 * Keys are opaque identifiers (`"time.ongoing"`), never the English sentence
 * — the opposite of what an app is advised to do for its own texts; navi's
 * `docs/i18n.md` explains why.
 *
 * @example
 * import { humanizeI18n } from "@jsenv/humanize";
 *
 * // Override a built-in text:
 * humanizeI18n.add("time.ongoing", { fr: "En cours…" });
 *
 * // Teach a language that is not shipped:
 * humanizeI18n.addLangKeys("ja", { "time.midnight": "真夜中" });
 */
const humanizeI18n = createI18n();

// What the time formatters in ../time/format_time.js write in words:
// relative wording, the midnight word, the mark between the two bounds of a
// span, and the compact duration unit symbols.
humanizeI18n.addAll({
  "time.less_than_minute": {
    en: "in less than a minute",
    fr: "dans moins d'une minute",
    de: "in weniger als einer Minute",
    es: "en menos de un minuto",
    it: "in meno di un minuto",
    pt: "em menos de um minuto",
    nl: "over minder dan een minuut",
  },
  "time.ongoing": {
    en: "Ongoing",
    fr: "En cours",
    de: "Laufend",
    es: "En curso",
    it: "In corso",
    pt: "Em andamento",
    nl: "Bezig",
  },
  // [day] and [time] are replaced at runtime with the localized day/time strings
  "time.tomorrow_at": {
    en: "[day] at [time]",
    fr: "[day] à [time]",
    de: "[day] um [time]",
    es: "[day] a las [time]",
    it: "[day] alle [time]",
    pt: "[day] às [time]",
    nl: "[day] om [time]",
  },
  // [duration] is replaced at runtime with the formatted duration string (e.g. "1h30", "45 min")
  "time.in_duration": {
    en: "in [duration]",
    fr: "dans [duration]",
    de: "in [duration]",
    es: "en [duration]",
    it: "tra [duration]",
    pt: "em [duration]",
    nl: "over [duration]",
  },
  // The word formatTimeOfDay splices in place of the "0 heure(s)" part of a
  // spelled-out time of day — see its own comment for why hour 0 needs a word
  // of its own, and how the swap keeps the rest of the sentence in this
  // language's grammar. A language with no entry here keeps its literal
  // "0 heure(s)" wording rather than this key.
  "time.midnight": {
    en: "midnight",
    fr: "minuit",
    de: "Mitternacht",
    es: "medianoche",
    it: "mezzanotte",
    pt: "meia-noite",
    nl: "middernacht",
  },
  // What formatTimeRange writes between the two bounds of a span — "8h–10h",
  // "11 mai – 14 mai". An en dash, the mark for a span, not a hyphen.
  "time.range_separator": {
    en: "–",
    fr: "–",
    de: "–",
    es: "–",
    it: "–",
    pt: "–",
    nl: "–",
  },
  // Compact duration unit symbols used in "1h30", "45min", "2d", etc.
  "time.duration.year_symbol": {
    en: "y",
    fr: "a",
    de: "J",
    es: "a",
    it: "a",
    pt: "a",
    nl: "j",
    ja: "年",
    zh: "年",
    ko: "년",
  },
  "time.duration.month_symbol": {
    en: "mo",
    fr: "mo",
    de: "Mo",
    es: "mo",
    it: "mo",
    pt: "mo",
    nl: "mo",
    ja: "月",
    zh: "月",
    ko: "월",
  },
  "time.duration.week_symbol": {
    en: "w",
    fr: "sem",
    de: "W",
    es: "sem",
    it: "sett",
    pt: "sem",
    nl: "w",
    ja: "週",
    zh: "周",
    ko: "주",
  },
  "time.duration.day_symbol": {
    en: "d",
    fr: "j",
    de: "T",
    es: "d",
    it: "g",
    pt: "d",
    nl: "d",
    ja: "日",
    zh: "天",
    ko: "일",
  },
  "time.duration.hour_symbol": {
    en: "h",
    fr: "h",
    de: "h",
    es: "h",
    it: "h",
    pt: "h",
    nl: "u",
    ja: "時間",
    zh: "小时",
    ko: "시간",
  },
  "time.duration.minute_symbol": {
    en: "min",
    fr: "min",
    de: "min",
    es: "min",
    it: "min",
    pt: "min",
    nl: "min",
    ja: "分",
    zh: "分",
    ko: "분",
  },
  "time.duration.second_symbol": {
    en: "s",
    fr: "s",
    de: "s",
    es: "s",
    it: "s",
    pt: "s",
    nl: "s",
    ja: "秒",
    zh: "秒",
    ko: "초",
  },
  "time.duration.millisecond_symbol": {
    en: "ms",
    fr: "ms",
    de: "ms",
    es: "ms",
    it: "ms",
    pt: "ms",
    nl: "ms",
    ja: "ms",
    zh: "ms",
    ko: "ms",
  },
});

// Date/time placeholder tokens — shown when no value is selected
// Override any key to adapt to your language conventions
humanizeI18n.addAll({
  "time.placeholder.day": {
    fr: "jj",
    en: "dd",
    de: "TT",
    es: "dd",
    it: "gg",
    pt: "dd",
    nl: "dd",
  },
  "time.placeholder.month": {
    fr: "mm",
    en: "mm",
    de: "MM",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.year": {
    fr: "aaaa",
    en: "yyyy",
    de: "JJJJ",
    es: "aaaa",
    it: "aaaa",
    pt: "aaaa",
    nl: "jjjj",
  },
  "time.placeholder.hour": {
    fr: "hh",
    en: "hh",
    de: "hh",
    es: "hh",
    it: "hh",
    pt: "hh",
    nl: "uu",
  },
  "time.placeholder.minute": {
    fr: "mm",
    en: "mm",
    de: "mm",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.week": {
    fr: "sem.",
    en: "wk",
    de: "KW",
    es: "sem.",
    it: "sett.",
    pt: "sem.",
    nl: "wk",
  },
});

const formatNumber = (value, { lang = getRuntimeLang() } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};

/**
 * Locale-aware time formatting: days, months, times of day, spans and
 * durations, worded the way a reader of that language expects them.
 *
 * It lives in a package with no frontend of its own so that a server and a
 * browser word the same instant identically — a notification sentence and the
 * card it points at must read the same date the same way. Nothing here touches
 * the DOM, and nothing it imports may.
 *
 * `lang` defaults to the runtime language source (see ../i18n/runtime_lang.js):
 * the runtime's own locale, or whatever a browser bundle installs in its place
 * (@jsenv/navi points it at the user's live language preference, so reading it
 * during a render subscribes the component). The words around the numbers come
 * from humanizeI18n, their order and shape from Intl.
 *
 * Its neighbour ./time.js writes durations too, in English, for CLI
 * output where readability beats precision — these write for the reader of an
 * app, in their language.
 *
 * All functions accept an optional `{ now }` parameter for testability.
 */


// Constructing an Intl formatter dominates the cost of a call (~19µs vs
// ~0.4µs to format with a kept instance, node 26 on an M-series Mac) and
// these formatters run in render loops — a card easily writes half a dozen
// per render — so every instance is memoized by (constructor, lang,
// options). lang and each option value come from small closed sets, so the
// cache stays bounded.
const intlCache = new Map();
const memoIntl = (constructorName, lang, options) => {
  let key = `${constructorName}|${Array.isArray(lang) ? lang.join() : lang}`;
  if (options) {
    for (const optionName of Object.keys(options)) {
      key += `|${optionName}:${options[optionName]}`;
    }
  }
  const cached = intlCache.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl[constructorName](lang, options);
  intlCache.set(key, formatter);
  return formatter;
};

// Our own compact/custom duration notation interpolates raw numbers
// directly (unlike Intl.DurationFormat, which groups thousands on its own,
// e.g. "5 400 secondes") — this keeps that consistent without reimplementing
// locale-aware grouping. Falls back to the raw value as-is for a
// non-numeric mid-edit value (e.g. "2a"), which Intl.NumberFormat can't
// format anyway.
const formatCompactNumber = (value, lang) => {
  const n = Number(value);
  return Number.isFinite(n) ? memoIntl("NumberFormat", lang).format(n) : value;
};

/**
 * Formats a date as a human-readable day string.
 *
 * @param {Date} date
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"numeric"|{ weekday?: "long"|"short"|"narrow"|false, day?: boolean, month?: "long"|"short"|"narrow"|"numeric"|false }, year?: boolean|"auto", now?: Date, timeZone?: string }} [options]
 *   A string spells the weekday and the month the same way. An object spells
 *   them apart, each key defaulting to `"long"`: a narrow card usually wants
 *   the weekday whole (it is the reading anchor) and the month abbreviated (it
 *   is where the characters are — "septembre" is 9 of them, "sept." reads the
 *   same). `"numeric"` stays a string-only spelling: it drops the weekday and
 *   writes the whole date in digits.
 *
 *   In the object form, `false` drops a part: `{ day: false, month: false }`
 *   writes the weekday alone ("mardi"), `{ month: false }` the weekday and
 *   day-of-month ("mardi 18"), `{ weekday: false }` the date without its
 *   anchor ("18 juillet"). At least one part must stay — with all three
 *   dropped, Intl falls back to its own default date spelling.
 * @param {boolean|"auto"} [options.year=true]
 *   Whether the `"numeric"` spelling writes the year: `false` drops it
 *   ("30/07", the day/month order still following the locale), `"auto"` drops
 *   it only when the date is in the current year (`now`'s year). The spelled
 *   formats never write the year, so they ignore it.
 * @param {string} [options.timeZone]
 *   IANA zone the instant is worded in ("Europe/Paris"); defaults to the
 *   runtime's own zone. The case is a server wording an instant for readers
 *   in a known zone — a game at 00:30 Paris must not be dated the previous
 *   day just because the process clock runs on UTC. `year: "auto"` reads both
 *   years in that zone too.
 *
 * @example
 * formatDay(new Date(), { lang: "fr" })                    // "lundi 11 mai" (long, default)
 * formatDay(new Date(), { lang: "fr", format: "short" })  // "lun. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "narrow" }) // "lu. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "numeric" }) // "11/05/2026"
 * formatDay(new Date(), { lang: "fr", format: "numeric", year: false }) // "11/05"
 * formatDay(new Date(), { lang: "fr", format: { weekday: "long", month: "short" } }) // "mercredi 2 sept."
 * formatDay(new Date(), { lang: "fr", format: { day: false, month: false } }) // "mercredi"
 * formatDay(new Date(), { lang: "fr", format: { month: false } })             // "mercredi 2"
 */
const formatDay = (
  date,
  {
    lang = getRuntimeLang(),
    format = "long",
    year = true,
    now = new Date(),
    timeZone,
  } = {},
) => {
  if (format === "numeric") {
    const yearWritten =
      year === "auto"
        ? readYear(date, timeZone) !== readYear(now, timeZone)
        : year !== false;
    return memoIntl("DateTimeFormat", lang, {
      day: "2-digit",
      month: "2-digit",
      ...(yearWritten ? { year: "numeric" } : {}),
      timeZone,
    }).format(date);
  }
  const {
    weekday = "long",
    day = true,
    month = "long",
  } = typeof format === "string" ? { weekday: format, month: format } : format;
  // a `false` part is omitted, not passed: Intl rejects false as a value
  return memoIntl("DateTimeFormat", lang, {
    ...(weekday === false ? {} : { weekday }),
    ...(day === false ? {} : { day: "numeric" }),
    ...(month === false ? {} : { month }),
    timeZone,
  }).format(date);
};

/**
 * Returns the day offset relative to now: -1 (yesterday), 0 (today), 1 (tomorrow), or the
 * actual number of days difference for any other date.
 */
const getRelativeDay = (date, { now = new Date() } = {}) => {
  const dateKey = toLocalDayKey(date);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (dateKey === toLocalDayKey(yesterdayDate)) {
    return -1;
  }

  if (dateKey === toLocalDayKey(now)) {
    return 0;
  }

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (dateKey === toLocalDayKey(tomorrowDate)) {
    return 1;
  }

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);
  const dateMidnight = new Date(date);
  dateMidnight.setHours(0, 0, 0, 0);
  return Math.round((dateMidnight - nowMidnight) / DAY);
};

/**
 * Formats a relative day offset (-1/0/1) as a locale-aware label: "hier", "aujourd'hui", "demain".
 */
// ── Placeholder helpers ────────────────────────────────────────────────────
// Derive locale-aware format placeholders from Intl.DateTimeFormat.formatToParts
// using a sentinel date whose parts are unambiguous (day=28, month=11, year=9999).
// Per-language token tables cover the most common locales; unknown langs fall
// back to "dd/mm/yyyy".

const SENTINEL_DATE = new Date(9999, 10, 28); // 28 Nov 9999 — day≠month, both 2-digit

const getToken = (key, lang) =>
  humanizeI18n(`time.placeholder.${key}`, undefined, { lang });

const formatDatePlaceholder = ({ lang = getRuntimeLang() } = {}) => {
  const parts = memoIntl("DateTimeFormat", lang, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

const formatMonthPlaceholder = ({
  lang = getRuntimeLang(),
  format = "long",
} = {}) => {
  const parts = memoIntl("DateTimeFormat", lang, {
    month: format,
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "month") {
        // Text month formats (long/short/narrow) → dash; numeric → token
        return format === "numeric" ? "–" : getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

const formatWeekPlaceholder = ({ lang = getRuntimeLang() } = {}) => {
  return `${getToken("week", lang)} xx / ${getToken(lang)}`;
};

const formatDatetimePlaceholder = ({
  lang = getRuntimeLang(),
  format = "long",
} = {}) => {
  const intlOptions =
    format === "long"
      ? {
          weekday: "short",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }
      : format === "narrow"
        ? {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }
        : {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          };
  const parts = memoIntl("DateTimeFormat", lang, intlOptions).formatToParts(
    SENTINEL_DATE,
  );
  let skipNext = false;
  return parts
    .map((p) => {
      if (p.type === "weekday") {
        skipNext = true;
        return "";
      }
      if (p.type === "literal" && skipNext) {
        skipNext = false;
        return "";
      }
      skipNext = false;
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "hour") {
        return getToken("hour", lang);
      }
      if (p.type === "minute") {
        return getToken("minute", lang);
      }
      return p.value;
    })
    .join("")
    .trim();
};

// ── End placeholder helpers ────────────────────────────────────────────────

const formatDayRelative = (offset, { lang = getRuntimeLang() } = {}) => {
  return memoIntl("RelativeTimeFormat", lang, {
    numeric: "auto",
  }).format(offset, "day");
};

const formatMonth = (
  date,
  { lang = getRuntimeLang(), format = "long", timeZone } = {},
) => {
  return memoIntl("DateTimeFormat", lang, {
    month: format, // "long", "short", or "narrow"
    year: "numeric",
    timeZone,
  }).format(date);
};

/**
 * Formats a date as "lun. 11 mai, 14:30" (long), "11 mai, 14:30" (short), "11/05, 14:30" (narrow).
 * `timeZone` words the instant in that IANA zone instead of the runtime's own.
 */
const formatDatetime = (
  date,
  { lang = getRuntimeLang(), format = "long", timeZone } = {},
) => {
  if (format === "long") {
    return memoIntl("DateTimeFormat", lang, {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(date);
  }
  if (format === "narrow") {
    return memoIntl("DateTimeFormat", lang, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(date);
  }
  // "short": no weekday
  return memoIntl("DateTimeFormat", lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
};

/**
 * Formats a date as "14:30".
 * `timeZone` words the instant in that IANA zone instead of the runtime's own.
 */
const formatTime = (
  date,
  { lang = getRuntimeLang(), timeZone } = {},
) => {
  return memoIntl("DateTimeFormat", lang, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
};

/**
 * Formats a time-of-day the way `<Time type="time">` writes it, as a plain
 * string — for the places a component cannot go (a `title` attribute, a push
 * notification).
 *
 * @param {Date|number|string} value
 *   A Date, a ms timestamp, or an "HH:MM"/"HH:MM:SS" string. Only the clock
 *   time is read. A nullish value renders the "--:--" placeholder; an
 *   unparseable one is returned as-is, stringified.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact"|"timestring", pad?: boolean, precision?: "hour"|"minute", timeZone?: string }} [options]
 *   The options `<Time type="time">` takes: `"timestring"` is the clock
 *   "14:30"; the other formats write the time as a duration-shaped phrase —
 *   see {@link formatMinuteDuration}'s `clockStyle` for what `pad` and
 *   `precision` shape in `format="compact"`.
 * @param {string} [options.timeZone]
 *   IANA zone the instant's clock is read in ("Europe/Paris"); defaults to
 *   the runtime's own zone. Only applies to a Date/timestamp — an
 *   "HH:MM" string is already a wall-clock reading, there is nothing to
 *   move to another zone, so it ignores this.
 *
 * @example
 * formatTimeOfDay(date, { lang: "fr" })                                  // "14 heures 30" (long, default)
 * formatTimeOfDay(date, { lang: "fr", format: "timestring" })            // "14:30"
 * formatTimeOfDay(date, { lang: "fr", format: "compact" })               // "14h30"
 * formatTimeOfDay(date, { lang: "fr", format: "compact", pad: false })   // "8h30", "8h"
 */
const formatTimeOfDay = (
  value,
  {
    lang = getRuntimeLang(),
    format = "long",
    pad = true,
    precision = pad ? "minute" : "hour",
    timeZone,
  } = {},
) => {
  if (value === undefined || value === null) {
    return "--:--";
  }
  const date = toTimeOfDay(value);
  // toDate turns a non-finite number into an Invalid Date, which is an object
  if (!date || isNaN(date.getTime())) {
    return String(value);
  }
  // An "HH:MM" string is a wall-clock reading, not an instant — re-reading
  // it in another zone would shift what the caller already spelled out.
  const zone = typeof value === "string" ? undefined : timeZone;
  if (format === "timestring") {
    return formatTime(date, { lang, timeZone: zone });
  }
  const { hours, minutes } = readClock(date, zone);
  const totalMinutes = hours * 60 + minutes;
  // clockStyle: this is always a time-of-day here, never a duration — keeps
  // a zero hour instead of dropping it (midnight would otherwise be
  // indistinguishable from an actual 5-minute duration), and in
  // format="compact" also zero-pads a single-digit hour so "5h30"/"0h05"
  // read as "05h30"/"00h05", closer to a "HH:MM" clock.
  if (hours !== 0 || format !== "long") {
    // At midnight, short/narrow/compact keep the "0 h"/"0h" hour part —
    // "0 h et 5 min"/"0h 5min"/"00h05" — rather than substituting a
    // translated "midnight" word, which would look out of place squeezed
    // into these otherwise terse, symbol-based formats.
    return formatMinuteDuration(totalMinutes, {
      lang,
      format,
      clockStyle: true,
      pad,
      precision,
    });
  }
  // Midnight (hour 0) at format="long" can't go through
  // formatMinuteDuration's own default zero-hour handling: it drops a
  // zero-valued unit entirely (by design — a real 5-minute duration should
  // print as "5 minutes", not "0 hours 5 minutes"), so "00:05" would
  // otherwise render identically to an actual 5-minute duration, silently
  // losing the fact that it's midnight. Every other hour keeps at least its
  // own "N hour(s)" wording as a hint that this is a time-of-day — only
  // hour 0 loses that hint entirely.
  const midnightWord = humanizeI18n("time.midnight", undefined, { lang });
  if (midnightWord === "time.midnight") {
    // No "midnight" translation registered for this language — fall back
    // to this language's own literal "0 heure(s)" wording instead (still
    // better than leaking the untranslated key, or substituting an
    // English word that wouldn't grammatically match the rest of the
    // sentence in whatever language this actually is).
    return formatMinuteDuration(totalMinutes, {
      lang,
      format,
      clockStyle: true,
    });
  }
  // Swap just the "0 heure(s)" part of the Intl-generated duration
  // string for the translated "midnight" word, keeping everything else
  // (the conjunction, the minutes part) exactly as Intl would produce
  // for this locale — formatToParts tags each token with the unit it
  // belongs to, so the swap doesn't need to know the locale's own
  // grammar/word order. Only ever one hour-tagged group per call
  // (hours is always 0 or absent here), but guarded anyway in case a
  // future Intl implementation ever splits it into more parts.
  const parts = memoIntl("DurationFormat", lang, {
    style: "long",
    hoursDisplay: "always",
  }).formatToParts({ hours: 0, minutes });
  let hourGroupReplaced = false;
  return parts
    .map((part) => {
      if (part.unit !== "hour") {
        return part.value;
      }
      if (hourGroupReplaced) {
        return "";
      }
      hourGroupReplaced = true;
      return midnightWord;
    })
    .join("");
};

/**
 * Formats a span between two times-of-day the way `<TimeRange>` writes it, as
 * a plain string — "8h–10h", "11h30–14h00", "14 heures 30 – 16 heures".
 *
 * Applies `<TimeRange>`'s shared-precision rule: the two bounds are written
 * to the same precision, decided by the pair — any bound with minutes gives
 * minutes to both, zero included ("11h30–14h00", never "11h30–14h").
 *
 * @param {Date|number|string} from
 * @param {Date|number|string} to
 *   Each bound accepts what {@link formatTimeOfDay} accepts; a nullish bound
 *   renders its "--:--" placeholder.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact"|"timestring", pad?: boolean, precision?: "hour"|"minute", separator?: string, timeZone?: string }} [options]
 *   `precision` writes both bounds at this precision instead of the one the
 *   pair calls for. `separator` defaults to the `"time.range_separator"`
 *   registered text (an en dash), tightened against both bounds in
 *   `format="compact"` —
 *   where the span is one short token — and spaced out otherwise. `timeZone`
 *   reads both bounds' clocks in that IANA zone — see {@link formatTimeOfDay}.
 *
 * @example
 * formatTimeRange("08:00", "10:00", { lang: "fr", format: "compact", pad: false }) // "8h–10h"
 * formatTimeRange("11:30", "14:00", { lang: "fr", format: "compact", pad: false }) // "11h30–14h00"
 */
const formatTimeRange = (
  from,
  to,
  {
    lang = getRuntimeLang(),
    format = "long",
    pad = true,
    timeZone,
    precision = resolveTimeRangePrecision(from, to, { format, pad, timeZone }),
    separator = humanizeI18n("time.range_separator", undefined, { lang }),
  } = {},
) => {
  const boundOptions = { lang, format, pad, precision, timeZone };
  const fromText = formatTimeOfDay(from, boundOptions);
  const toText = formatTimeOfDay(to, boundOptions);
  if (format === "compact") {
    return `${fromText}${separator}${toText}`;
  }
  return `${fromText} ${separator} ${toText}`;
};

// The two bounds of a span are written to the same precision, decided by the
// pair: "8h–10h" as long as neither has minutes, "11h30–14h00" as soon as one
// of them does. Only ever a question for the unpadded compact clock — the
// padded one always writes "08h00", and the spelled-out formats name their
// units, leaving no shape for the eye to trip on.
const resolveTimeRangePrecision = (
  from,
  to,
  { format, pad, timeZone },
) => {
  if (pad || format !== "compact") {
    return "minute";
  }
  const hasMinutes = (value) => {
    const date = toTimeOfDay(value);
    if (!date || isNaN(date.getTime())) {
      return false;
    }
    // Same rule as formatTimeOfDay: a string is a wall-clock reading, only
    // an instant is re-read in `timeZone`.
    const zone = typeof value === "string" ? undefined : timeZone;
    return readClock(date, zone).minutes !== 0;
  };
  return hasMinutes(from) || hasMinutes(to) ? "minute" : "hour";
};

/**
 * Formats a duration expressed in minutes as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own notation that omits the minute symbol when hours are present.
 *
 * @param {number} minutes
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", clockStyle?: boolean, pad?: boolean, precision?: "hour"|"minute", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in minutes
 *   however big it gets ("2160 minutes" instead of "1 jour et 12 heures").
 *   Past 24 hours the default promotes to days, which reads better but hides
 *   the unit the caller works in.
 * @param {boolean} [options.clockStyle=false] - Set this when `minutes`
 *   represents a time-of-day rather than a real duration (used by
 *   `<Time type="time">`, see time.jsx's own TimeTime). A clock's "0" is a
 *   meaningful hour rather than "no hours": a zero-hours component is
 *   normally dropped entirely (a real 5-minute duration should print as
 *   "5 minutes", not "0 hours 5 minutes"); this keeps it instead (e.g.
 *   "0 h et 5 min"/"0h 5min"/"00h05") so midnight doesn't collapse to
 *   something indistinguishable from an actual 5-minute duration.
 *   Must not be set for plain duration formatting.
 * @param {boolean} [options.pad=true] - Zero-pad the hour to 2 digits
 *   ("08h30" rather than "8h30"). `clockStyle` + `format: "compact"` only.
 * @param {"hour"|"minute"} [options.precision="minute"] - Whether a zero
 *   minute is written: `"minute"` keeps it ("10h00"), `"hour"` drops it
 *   ("10h"). `clockStyle` + `format: "compact"` only.
 *
 *   These last two are the clock's two independent shape choices, and only
 *   `format: "compact"` has to make them — the spelled-out formats put their
 *   units in words, so "10 heures"/"10 h"/"10h" already reads as a time of
 *   day whatever the padding, and they always write the hour bare and drop a
 *   zero minute. Padded + minute ("08h00") is the column shape, where every
 *   row occupies the same width; bare + hour ("8h", "8h30") is the shape a
 *   person speaks. Bare + minute ("8h00") only ever makes sense next to a
 *   partner that has minutes of its own — see `<TimeRange>`, which is the
 *   only thing that asks for it.
 *
 * @example
 * formatMinuteDuration(90, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatMinuteDuration(90, { lang: "fr", format: "short" })     // "1 h et 30 min" (Intl short)
 * formatMinuteDuration(90, { lang: "fr", format: "narrow" })    // "1h 30min" (Intl narrow)
 * formatMinuteDuration(90, { lang: "fr", format: "compact" })   // "1h30" (custom, no minute symbol)
 * formatMinuteDuration(45, { lang: "en", format: "compact" })   // "45min"
 * formatMinuteDuration(5, { lang: "fr", format: "narrow", clockStyle: true }) // "0h 5min"
 * formatMinuteDuration(330, { lang: "fr", format: "compact", clockStyle: true }) // "05h30"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "10h"
 * formatMinuteDuration(510, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "8h30"
 * formatMinuteDuration(2160, { lang: "fr" })                     // "1 jour et 12 heures"
 * formatMinuteDuration(2160, { lang: "fr", forceUnit: true })    // "2 160 minutes"
 */
const formatMinuteDuration = (
  minutes,
  {
    lang = getRuntimeLang(),
    format = "long",
    clockStyle = false,
    pad = true,
    precision = "minute",
    forceUnit = false,
  } = {},
) => {
  if (minutes < 0) {
    // the d/h/m split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatMinuteDuration(-minutes, { lang, format, clockStyle, pad, precision, forceUnit })}`;
  }
  if (forceUnit || (minutes === 0 && !clockStyle)) {
    // a zero has nothing to promote to, and rendering it as an empty string
    // would be indistinguishable from a missing value
    return formatSingleUnit(minutes, "minute", { lang, format });
  }
  const totalHours = Math.floor(minutes / 60);
  const m = minutes % 60;
  // a time of day never goes past 24h, and its hour part is the clock hour
  const d = clockStyle ? 0 : Math.floor(totalHours / 24);
  const h = clockStyle ? totalHours : totalHours % 24;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = memoIntl("DurationFormat", lang, {
      style: format, // "long", "short", or "narrow"
      ...(clockStyle ? { hoursDisplay: "always" } : {}),
    });
    const duration = {};
    if (d > 0) {
      duration.days = d;
    }
    if (h > 0 || clockStyle || d > 0) {
      duration.hours = h;
    }
    if (m > 0 || (d === 0 && h === 0)) {
      duration.minutes = m;
    }
    return fmt.format(duration);
  }
  // format="compact": "1j12h", "1h30", "45min", "2h" — no minute symbol when hours are present
  const dSym = humanizeI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = humanizeI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = humanizeI18n("time.duration.minute_symbol", undefined, { lang });
  const dStr = d > 0 ? `${formatCompactNumber(d, lang)}${dSym}` : "";
  const hStr =
    clockStyle && pad
      ? String(h).padStart(2, "0")
      : formatCompactNumber(h, lang);
  if (d === 0 && h === 0 && !clockStyle) {
    return `${m}${mSym}`;
  }
  if (m === 0) {
    if (clockStyle) {
      // "10h00" on a clock, "2h" for a real 2 hours duration — except at
      // precision "hour", where a clock drops the zero minute too ("10h"),
      // the way one says it out loud
      return precision === "minute" ? `${hStr}${hSym}00` : `${hStr}${hSym}`;
    }
    return h === 0 ? dStr : `${dStr}${hStr}${hSym}`;
  }
  return `${dStr}${hStr}${hSym}${String(m).padStart(2, "0")}`;
};

// "forceUnit": stay in the unit the value is expressed in, however big it gets
const formatSingleUnit = (value, unit, { lang, format }) => {
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    return memoIntl("DurationFormat", lang, {
      style: format,
      // Intl drops a zero-valued unit, and "0 minute" is the whole point here
      [`${unit}sDisplay`]: "always",
    }).format({
      [`${unit}s`]: value,
    });
  }
  const symbol = humanizeI18n(`time.duration.${unit}_symbol`, undefined, {
    lang,
  });
  return `${formatCompactNumber(value, lang)}${symbol}`;
};

/**
 * Formats a duration expressed in hours (possibly fractional) as a human-readable string.
 * Delegates to {@link formatMinuteDuration} after converting hours to minutes.
 *
 * @param {number} hours
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in hours however
 *   big it gets ("36 heures" instead of "1 jour et 12 heures"). Ignored for a
 *   fractional value, which has no single-unit spelling.
 *
 * @example
 * formatHourDuration(1.5, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatHourDuration(1.5, { lang: "fr", format: "compact" })   // "1h30"
 * formatHourDuration(2, { lang: "en", format: "compact" })     // "2h"
 * formatHourDuration(36, { lang: "fr" })                        // "1 jour et 12 heures"
 * formatHourDuration(36, { lang: "fr", forceUnit: true })      // "36 heures"
 */
const formatHourDuration = (hours, options = {}) => {
  const { lang = getRuntimeLang(), format = "long", forceUnit } = options;
  if (hours === 0 || (forceUnit && Number.isInteger(hours))) {
    return formatSingleUnit(hours, "hour", { lang, format });
  }
  // a fractional value has no single-unit spelling, it needs its minutes
  const totalMinutes = Math.round(hours * 60);
  return formatMinuteDuration(totalMinutes, { ...options, forceUnit: false });
};

/**
 * Formats a duration expressed in seconds as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own symbol-based notation.
 *
 * @param {number} seconds
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in seconds
 *   however big it gets ("90 000 secondes" instead of "1 jour et 1 heure").
 *
 * @example
 * formatSecondDuration(90, { lang: "fr" })                       // "1 minute 30 secondes" (long, default)
 * formatSecondDuration(90, { lang: "fr", format: "short" })     // "1 min. et 30 s." (Intl short)
 * formatSecondDuration(90, { lang: "fr", format: "narrow" })    // "1min 30s" (Intl narrow)
 * formatSecondDuration(90, { lang: "fr", format: "compact" })   // "1m30s" (custom)
 * formatSecondDuration(45, { lang: "en", format: "compact" })   // "45s"
 */
const formatSecondDuration = (
  seconds,
  { lang = getRuntimeLang(), format = "long", forceUnit = false } = {},
) => {
  if (seconds < 0) {
    // the d/h/m/s split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatSecondDuration(-seconds, { lang, format, forceUnit })}`;
  }
  if (forceUnit || seconds === 0) {
    return formatSingleUnit(seconds, "second", { lang, format });
  }
  const totalHours = Math.floor(seconds / 3600);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = memoIntl("DurationFormat", lang, { style: format });
    const duration = {};
    if (d > 0) duration.days = d;
    if (h > 0) duration.hours = h;
    if (m > 0) duration.minutes = m;
    if (s > 0 || (d === 0 && h === 0 && m === 0)) duration.seconds = s;
    return fmt.format(duration);
  }
  // compact: "1d1h30m45s", "1h30m45s", "1m30s", "45s"
  const dSym = humanizeI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = humanizeI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = humanizeI18n("time.duration.minute_symbol", undefined, { lang });
  const sSym = humanizeI18n("time.duration.second_symbol", undefined, { lang });
  const parts = [];
  // h/m/s are bounded by construction (never need grouping); d can be
  // arbitrarily large for a long duration.
  if (d > 0) parts.push(`${formatCompactNumber(d, lang)}${dSym}`);
  if (h > 0) parts.push(`${h}${hSym}`);
  if (m > 0) parts.push(`${m}${mSym}`);
  if (s > 0 || parts.length === 0) parts.push(`${s}${sSym}`);
  return parts.join("");
};

/**
 * Formats a duration object as a human-readable string.
 * Reads the parts directly — no conversion to seconds — so years/months/days
 * are preserved as-is and non-numeric mid-edit values (e.g. "2a") are rendered
 * with their unit symbol rather than being stringified.
 *
 * @param {string|number|{ years?: any, months?: any, weeks?: any, days?: any,
 *           hours?: any, minutes?: any, seconds?: any, milliseconds?: any }} duration -
 *   A string goes through {@link parseDuration} ("PT1H30M", "1h30"), a number
 *   is read as seconds. Each unit is written with the value it carries: 90
 *   minutes reads "90 minutes", never "1 heure 30" — the variants that
 *   promote a count into bigger units are {@link formatMinuteDuration},
 *   {@link formatHourDuration} and {@link formatSecondDuration}.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact" }} [options]
 *
 * @example
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr" })                       // "2 heures 15 minutes" (long, default)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "short" })     // "2 h et 15 min" (Intl short)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "narrow" })    // "2h 15min" (Intl narrow)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "compact" })   // "2h15" (custom, no minute symbol)
 * formatDuration({ minutes: 45 }, { lang: "fr", format: "compact" })             // "45min"
 * formatDuration({ hours: 0, minutes: 0 }, { lang: "fr" })                        // "0 minute"
 * formatDuration({ hours: "2a", minutes: "15" }, { lang: "fr", format: "compact" }) // "2ah15"
 */
const formatDuration = (
  duration,
  { lang = getRuntimeLang(), format = "long" } = {},
) => {
  if (typeof duration === "string") {
    duration = parseDuration(duration) ?? {};
  } else if (typeof duration === "number") {
    duration = { seconds: duration };
  }
  const has = (key) => duration[key] !== undefined && duration[key] !== null;

  // "long" and "narrow" delegate to Intl.DurationFormat when available and all values are numeric.
  //
  // "short" always uses our own compact symbols ("2h15", "45min") because:
  // 1. We omit the minute symbol when hours are also present ("2h15" not "2h 15 min"),
  //    which Intl.DurationFormat style:"narrow" does not do.
  // 2. Non-numeric mid-edit values (e.g. { hours: "2a" }) must render as-is with their
  //    unit symbol — Intl.DurationFormat only accepts integers.
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const intlDuration = {};
    let allNumeric = true;
    let hasNegative = false;
    let hasPositive = false;
    for (const key of [
      "years",
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
      "seconds",
      "milliseconds",
    ]) {
      if (!has(key)) {
        continue;
      }
      const n = Number(duration[key]);
      if (!isFinite(n)) {
        allNumeric = false;
        break;
      }
      if (n < 0) {
        hasNegative = true;
      } else if (n > 0) {
        hasPositive = true;
      }
      intlDuration[key] = n;
    }
    // Temporal requires all components to share the same sign.
    // Mixed-sign values (e.g. { hours: -1, minutes: 15 }) throw a RangeError.
    if (
      allNumeric &&
      Object.keys(intlDuration).length > 0 &&
      !(hasNegative && hasPositive)
    ) {
      if (!hasNegative && !hasPositive) {
        return formatSingleUnit(0, smallestUnitOf(intlDuration), {
          lang,
          format,
        });
      }
      return memoIntl("DurationFormat", lang, { style: format }).format(
        intlDuration,
      );
    }
    // Fall through to compact notation when values are non-numeric or mixed-sign
  }

  // A component explicitly present but numerically zero (e.g. the demo's own
  // { hours: 0, minutes: 5 }) conveys no information for a genuine duration
  // — same convention formatMinuteDuration/formatSecondDuration already
  // follow (checking h > 0/m > 0, not merely "was a value passed") — so
  // it's dropped here too, regardless of whether the caller included the
  // key at all. Non-numeric mid-edit values (e.g. "2a") still count as
  // present — Number("2a") is NaN, never === 0 — so those keep rendering
  // as-is with their own unit symbol. When every component is zero there is
  // nothing left to drop, so the zero itself is rendered — see below.
  const hasNonZero = (key) => has(key) && Number(duration[key]) !== 0;

  const sym = (key) =>
    humanizeI18n(`time.duration.${key}_symbol`, undefined, { lang });
  const parts = [];

  if (hasNonZero("years")) {
    parts.push(`${formatCompactNumber(duration.years, lang)}${sym("year")}`);
  }
  if (hasNonZero("months")) {
    parts.push(`${formatCompactNumber(duration.months, lang)}${sym("month")}`);
  }
  if (hasNonZero("weeks")) {
    parts.push(`${formatCompactNumber(duration.weeks, lang)}${sym("week")}`);
  }
  if (hasNonZero("days")) {
    parts.push(`${formatCompactNumber(duration.days, lang)}${sym("day")}`);
  }

  // Hours + minutes: when both present, pad minutes to 2 digits after the h
  // symbol — minutes stays a plain 2-digit pad (it's always 0-59 by
  // convention), only hours goes through grouping.
  const hSym = sym("hour");
  const mSym = sym("minute");
  if (hasNonZero("hours") && hasNonZero("minutes")) {
    parts.push(
      `${formatCompactNumber(duration.hours, lang)}${hSym}${String(duration.minutes).padStart(2, "0")}`,
    );
  } else if (hasNonZero("hours")) {
    parts.push(`${formatCompactNumber(duration.hours, lang)}${hSym}`);
  } else if (hasNonZero("minutes")) {
    parts.push(`${formatCompactNumber(duration.minutes, lang)}${mSym}`);
  }

  if (hasNonZero("seconds")) {
    parts.push(
      `${formatCompactNumber(duration.seconds, lang)}${sym("second")}`,
    );
  }
  if (hasNonZero("milliseconds")) {
    parts.push(
      `${formatCompactNumber(duration.milliseconds, lang)}${sym("millisecond")}`,
    );
  }
  if (parts.length > 0) {
    return parts.join("");
  }
  // everything was zero: say so in the smallest unit the caller mentioned,
  // rather than a bare "0" whose unit the reader has to guess
  const smallestUnit = smallestUnitOf(duration);
  return smallestUnit ? `0${sym(smallestUnit)}` : "0";
};

const UNIT_KEYS = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];
const smallestUnitOf = (duration) => {
  for (const key of [...UNIT_KEYS].reverse()) {
    if (duration[key] !== undefined && duration[key] !== null) {
      return key.slice(0, -1); // "seconds" -> "second"
    }
  }
  return null;
};

/**
 * Formats a date relative to now: "il y a 3 jours", "dans 2 heures", etc.
 */
const formatTimeAgo = (
  date,
  { lang = getRuntimeLang(), now = new Date(), bare, format = "long" } = {},
) => {
  const rtf = memoIntl("RelativeTimeFormat", lang, {
    numeric: "auto",
    style: format,
  });
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diff = date.getTime() - nowMs;
  const absDiff = Math.abs(diff);

  let value;
  let unit;
  if (absDiff < MINUTE) {
    value = Math.round(diff / 1000);
    unit = "second";
  } else if (absDiff < HOUR) {
    value = Math.round(diff / MINUTE);
    unit = "minute";
  } else if (absDiff < DAY) {
    value = Math.round(diff / HOUR);
    unit = "hour";
  } else if (absDiff < 7 * DAY) {
    value = Math.round(diff / DAY);
    unit = "day";
  } else if (absDiff < 30 * DAY) {
    value = Math.round(diff / (7 * DAY));
    unit = "week";
  } else if (absDiff < YEAR) {
    value = Math.round(diff / (30 * DAY));
    unit = "month";
  } else {
    value = Math.round(diff / YEAR);
    unit = "year";
  }

  if (!bare || value >= 0) {
    return rtf.format(value, unit);
  }
  // Drop the leading past-tense literal ("il y a ", "ago ") — keep only integer + unit.
  const parts = rtf.formatToParts(value, unit);
  const integerIndex = parts.findIndex((p) => p.type === "integer");
  return parts
    .slice(integerIndex)
    .map((p) => p.value)
    .join("")
    .trim();
};

/**
 * Formats a timed event with an optional duration window.
 *
 * States:
 * - Future  (now < start)              → "dans 1 heure et 30 minutes", "demain à 15 h", …
 * - Ongoing (start ≤ now < start+dur)  → "En cours"
 * - Past    (now ≥ start+dur)          → relative ("il y a 2 heures", …)
 *
 * @param {Date|number} start      Start of the event (Date or ms timestamp)
 * @param {number}      durationMs Duration in milliseconds (0 = instant event)
 * @param {{ lang?: string, now?: Date|number, bare?: boolean, format?: "long"|"short"|"narrow" }} options
 *
 * @example
 * // 90 min from now
 * formatTimeRelative(Date.now() + 90 * 60_000, 0, { lang: "fr" }) // "dans 1 heure et 30 minutes"
 * // currently happening (30 min window)
 * formatTimeRelative(Date.now() - 5 * 60_000, 30 * 60_000, { lang: "fr" }) // "En cours"
 * // ended 2 hours ago
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 3_600_000, { lang: "fr" }) // "il y a 2 heures"
 * // short format
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 0, { lang: "fr", format: "short" }) // "il y a 3 h"
 */
const formatTimeRelative = (
  start,
  durationMs = 0,
  { lang = getRuntimeLang(), now = new Date(), bare, format = "long" } = {},
) => {
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  const endMs = startMs + durationMs;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (nowMs >= startMs && nowMs < endMs) {
    return getOngoingText(lang);
  }
  if (nowMs >= endMs) {
    const refDate = endMs > startMs ? new Date(endMs) : new Date(startMs);
    return formatTimeAgo(refDate, { lang, now, bare, format });
  }

  const diff = startMs - nowMs;
  return formatFuture(new Date(startMs), diff, { lang, now, format });
};

const formatFuture = (date, diff, { lang, now, format = "long" }) => {
  const rtf = memoIntl("RelativeTimeFormat", lang, {
    numeric: "auto",
    style: format,
  });
  const nowDate = now instanceof Date ? now : new Date(now);

  // < 1 min
  if (diff < MINUTE) {
    return getLessThanMinuteText(lang);
  }

  // < 1 hour → "dans X minutes"
  if (diff < HOUR) {
    return rtf.format(Math.ceil(diff / MINUTE), "minute");
  }

  // 1h to 2h → "dans 1 heure 30"
  if (diff < 2 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    const minutes = Math.round((diff % HOUR) / MINUTE);
    if (minutes === 0) {
      return rtf.format(hours, "hour");
    }
    const duration = formatMinuteDuration(hours * 60 + minutes, {
      lang,
      format,
    });
    const template = humanizeI18n("time.in_duration", undefined, { lang });
    if (template !== "time.in_duration") {
      return template.replace("[duration]", duration);
    }
    return `in ${duration}`;
  }

  // < 6h → "dans X heures" (precise enough, skip tomorrow label)
  if (diff < 6 * HOUR) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // Tomorrow (calendar day) and within ~30h → "demain à 15h"
  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (diff < 30 * HOUR && toLocalDayKey(date) === toLocalDayKey(tomorrowDate)) {
    return formatTomorrowAt(date, lang);
  }

  // < 24h → "dans X heures"
  if (diff < DAY) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // < 7 days → "dans X jours"
  if (diff < 7 * DAY) {
    return rtf.format(Math.round(diff / DAY), "day");
  }

  // < 30 days → "dans X semaines"
  if (diff < 30 * DAY) {
    return rtf.format(Math.round(diff / (7 * DAY)), "week");
  }

  // months (Intl handles "le mois prochain" when value = 1)
  if (diff < YEAR) {
    return rtf.format(Math.round(diff / (30 * DAY)), "month");
  }

  return rtf.format(Math.round(diff / YEAR), "year");
};

const formatTomorrowAt = (date, lang) => {
  const dayLabel = memoIntl("RelativeTimeFormat", lang, {
    numeric: "auto",
  }).format(1, "day");
  const hasMinutes = date.getMinutes() !== 0;
  const timeLabel = memoIntl("DateTimeFormat", lang, {
    hour: "numeric",
    ...(hasMinutes ? { minute: "2-digit" } : {}),
  }).format(date);
  const atTemplate = humanizeI18n("time.tomorrow_at", undefined, {
    lang,
  });
  // atTemplate is e.g. "[day] à [time]" — replace placeholders
  if (atTemplate !== "time.tomorrow_at") {
    return atTemplate.replace("[day]", dayLabel).replace("[time]", timeLabel);
  }
  // fallback: concatenate with a space
  return `${dayLabel} ${timeLabel}`;
};

const getLessThanMinuteText = (lang) => {
  return humanizeI18n("time.less_than_minute", undefined, { lang });
};

const getOngoingText = (lang) => {
  return humanizeI18n("time.ongoing", undefined, { lang });
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

// Compares calendar days in local time (ignores the clock time)
const toLocalDayKey = (date) => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * Coerces what `<Time>` accepts as a value — a Date, a ms timestamp, a
 * parseable string — into a Date, or null when it cannot. `parseString`
 * lets a caller claim the string forms it recognizes ("HH:MM" for a
 * time-of-day, "YYYY-MM" for a month…) before the generic ones apply.
 */
const toDate = (value, parseString) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    if (parseString) {
      return parseString(value);
    }
    // "YYYY-MM-DD" — use local midnight to avoid UTC shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    // ISO / other parseable strings
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toTimeOfDay = (value) => {
  return toDate(value, (string) => {
    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(string)) {
      const d = new Date(`1970-01-01T${string}`);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });
};

// Reads the wall-clock hour/minute of an instant — in the runtime's own zone
// by default, in `timeZone` when given. A Date only carries local getters, so
// another zone's clock has to come out of Intl parts (hourCycle h23 so
// midnight reads hour 0, never 24).
const readClock = (date, timeZone) => {
  if (!timeZone) {
    return { hours: date.getHours(), minutes: date.getMinutes() };
  }
  const parts = memoIntl("DateTimeFormat", "en", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") {
      hours = Number(part.value);
    } else if (part.type === "minute") {
      minutes = Number(part.value);
    }
  }
  return { hours, minutes };
};

// Reads the calendar year of an instant in `timeZone` (the runtime's own zone
// when not given) — what formatDay's `year: "auto"` compares.
const readYear = (date, timeZone) => {
  if (!timeZone) {
    return date.getFullYear();
  }
  return Number(
    memoIntl("DateTimeFormat", "en", { timeZone, year: "numeric" }).format(
      date,
    ),
  );
};

const distributePercentages = (
  namedNumbers,
  { maxPrecisionHint = 2 } = {},
) => {
  const numberNames = Object.keys(namedNumbers);
  if (numberNames.length === 0) {
    return {};
  }
  if (numberNames.length === 1) {
    const firstNumberName = numberNames[0];
    return { [firstNumberName]: "100 %" };
  }
  const numbers = numberNames.map((name) => namedNumbers[name]);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const ratios = numbers.map((number) => number / total);
  const percentages = {};
  ratios.pop();
  ratios.forEach((ratio, index) => {
    const percentage = ratio * 100;
    percentages[numberNames[index]] = percentage;
  });
  const lowestPercentage = (1 / Math.pow(10, maxPrecisionHint)) * 100;
  let precision = 0;
  Object.keys(percentages).forEach((name) => {
    const percentage = percentages[name];
    if (percentage < lowestPercentage) {
      // check the amout of meaningful decimals
      // and that what we will use
      const percentageRounded = setRoundedPrecision(percentage);
      const percentagePrecision = getPrecision(percentageRounded);
      if (percentagePrecision > precision) {
        precision = percentagePrecision;
      }
    }
  });
  let remainingPercentage = 100;

  Object.keys(percentages).forEach((name) => {
    const percentage = percentages[name];
    const percentageAllocated = setRoundedPrecision(percentage, {
      decimals: precision,
    });
    remainingPercentage -= percentageAllocated;
    percentages[name] = percentageAllocated;
  });
  const lastName = numberNames[numberNames.length - 1];
  percentages[lastName] = setRoundedPrecision(remainingPercentage, {
    decimals: precision,
  });
  return percentages;
};

const formatDefault = (v) => v;

const generateContentFrame = ({
  content,
  line,
  column,

  linesAbove = 3,
  linesBelow = 0,
  lineMaxWidth = 120,
  lineNumbersOnTheLeft = true,
  lineMarker = true,
  columnMarker = true,
  format = formatDefault,
} = {}) => {
  const lineStrings = content.split(/\r?\n/);
  if (line === 0) line = 1;
  if (column === undefined) {
    columnMarker = false;
    column = 1;
  }
  if (column === 0) column = 1;

  let lineStartIndex = line - 1 - linesAbove;
  if (lineStartIndex < 0) {
    lineStartIndex = 0;
  }
  let lineEndIndex = line - 1 + linesBelow;
  if (lineEndIndex > lineStrings.length - 1) {
    lineEndIndex = lineStrings.length - 1;
  }
  if (columnMarker) {
    // human reader deduce the line when there is a column marker
    lineMarker = false;
  }
  if (line - 1 === lineEndIndex) {
    lineMarker = false; // useless because last line
  }
  let lineIndex = lineStartIndex;

  let columnsBefore;
  let columnsAfter;
  if (column > lineMaxWidth) {
    columnsBefore = column - Math.ceil(lineMaxWidth / 2);
    columnsAfter = column + Math.floor(lineMaxWidth / 2);
  } else {
    columnsBefore = 0;
    columnsAfter = lineMaxWidth;
  }
  let columnMarkerIndex = column - 1 - columnsBefore;

  let source = "";
  while (lineIndex <= lineEndIndex) {
    const lineString = lineStrings[lineIndex];
    const lineNumber = lineIndex + 1;
    const isLastLine = lineIndex === lineEndIndex;
    const isMainLine = lineNumber === line;
    lineIndex++;

    {
      if (lineMarker) {
        if (isMainLine) {
          source += `${format(">", "marker_line")} `;
        } else {
          source += "  ";
        }
      }
      if (lineNumbersOnTheLeft) {
        // fill with spaces to ensure if line moves from 7,8,9 to 10 the display is still great
        const asideSource = `${fillLeft(lineNumber, lineEndIndex + 1)} |`;
        source += `${format(asideSource, "line_number_aside")} `;
      }
    }
    {
      source += truncateLine(lineString, {
        start: columnsBefore,
        end: columnsAfter,
        prefix: "…",
        suffix: "…",
        format,
      });
    }
    {
      if (columnMarker && isMainLine) {
        source += `\n`;
        if (lineMarker) {
          source += "  ";
        }
        if (lineNumbersOnTheLeft) {
          const asideSpaces = `${fillLeft(lineNumber, lineEndIndex + 1)} | `
            .length;
          source += " ".repeat(asideSpaces);
        }
        source += " ".repeat(columnMarkerIndex);
        source += format("^", "marker_column");
      }
    }
    if (!isLastLine) {
      source += "\n";
    }
  }
  return source;
};

const truncateLine = (line, { start, end, prefix, suffix, format }) => {
  const lastIndex = line.length;

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }

  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;

  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;

  if (start >= lastIndex || from === to) {
    return "";
  }
  let result = "";
  while (from < to) {
    result += format(line[from], "char");
    from++;
  }
  if (result.length === 0) {
    return "";
  }
  if (startTruncated && endTruncated) {
    return `${format(prefix, "marker_overflow_left")}${result}${format(
      suffix,
      "marker_overflow_right",
    )}`;
  }
  if (startTruncated) {
    return `${format(prefix, "marker_overflow_left")}${result}`;
  }
  if (endTruncated) {
    return `${result}${format(suffix, "marker_overflow_right")}`;
  }
  return result;
};

const fillLeft = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += value;
  return padded;
};

const createCallOrderer = () => {
  const queue = [];
  const callWhenPreviousExecutionAreDone = (executionIndex, callback) => {
    if (queue[executionIndex]) {
      throw new Error(`${executionIndex} already used`);
    }

    let allBeforeAreDone = true;
    if (executionIndex > 0) {
      let beforeIndex = executionIndex - 1;
      do {
        const value = queue[beforeIndex];
        if (!value) {
          allBeforeAreDone = false;
          break;
        }
      } while (beforeIndex--);
    }
    if (!allBeforeAreDone) {
      queue[executionIndex] = callback;
      return;
    }
    queue[executionIndex] = true;
    callback();
    let afterIndex = executionIndex + 1;
    while (afterIndex < queue.length) {
      const value = queue[afterIndex];
      if (value === undefined) {
        break;
      }
      if (typeof value === "function") {
        queue[afterIndex] = true;
        value();
      }
      afterIndex++;
    }
  };
  return callWhenPreviousExecutionAreDone;
};

const errorToMarkdown = (error) => {
  const errorIsAPrimitive =
    error === null ||
    (typeof error !== "object" && typeof error !== "function");

  if (errorIsAPrimitive) {
    return `\`\`\`js
${error}
\`\`\``;
  }
  return `\`\`\`
${error.stack}
\`\`\``;
};

const errorToHTML = (error) => {
  const errorIsAPrimitive =
    error === null ||
    (typeof error !== "object" && typeof error !== "function");

  if (errorIsAPrimitive) {
    if (typeof error === "string") {
      return `<pre>${escapeHtml(error)}</pre>`;
    }
    return `<pre>${JSON.stringify(error, null, "  ")}</pre>`;
  }
  return `<pre>${escapeHtml(error.stack)}</pre>`;
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export { ANSI, UNICODE, createCallOrderer, createDetailedMessage, createI18n, distributePercentages, errorToHTML, errorToMarkdown, formatDatePlaceholder, formatDatetime, formatDatetimePlaceholder, formatDay, formatDayRelative, formatDuration, formatHourDuration, formatMinuteDuration, formatMonth, formatMonthPlaceholder, formatNumber, formatSecondDuration, formatTime, formatTimeOfDay, formatTimeRange, formatTimeRelative, formatWeekPlaceholder, generateContentFrame, getRelativeDay, getRuntimeLang, humanize, humanizeDuration, humanizeEllapsedTime, humanizeFileSize, humanizeI18n, humanizeMemory, humanizeMethodSymbol, installInterpolateJsx, interpolateText, preNewLineAndIndentation, prefixFirstAndIndentRemainingLines, resolveTimeRangePrecision, setRuntimeLangSource, toDate, toTimeOfDay, wrapNewLineAndIndentation };
//# sourceMappingURL=jsenv_humanize_browser.js.map
