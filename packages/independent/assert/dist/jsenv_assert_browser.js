const inspectBoolean = value => value.toString();

const inspectNull = () => "null";

// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/numeric-separators-style.js

const inspectNumber = (value, {
  numericSeparator
}) => {
  if (isNegativeZero$1(value)) {
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
    power = ""
  } = numberString.match(/^(?<number>.*?)(?:(?<mark>e)(?<sign>[+-])?(?<power>\d+))?$/i).groups;
  const numberWithSeparators = formatNumber(number);
  const powerWithSeparators = addSeparator(power, {
    minimumDigits: 5,
    groupLength: 3
  });
  return "".concat(numberWithSeparators).concat(mark).concat(sign).concat(powerWithSeparators);
};

// Use this and instead of Object.is(value, -0)
// because in some corner cases firefox returns false
// for Object.is(-0, -0)
const isNegativeZero$1 = value => {
  return value === 0 && 1 / value === -Infinity;
};
const formatNumber = numberString => {
  const parts = numberString.split(".");
  const [integer, fractional] = parts;
  if (parts.length === 2) {
    const integerWithSeparators = addSeparator(integer, {
      minimumDigits: 5,
      groupLength: 3
    });
    return "".concat(integerWithSeparators, ".").concat(fractional);
  }
  return addSeparator(integer, {
    minimumDigits: 5,
    groupLength: 3
  });
};
const addSeparator = (numberString, {
  minimumDigits,
  groupLength
}) => {
  if (numberString[0] === "-") {
    return "-".concat(groupDigits(numberString.slice(1), {
      minimumDigits,
      groupLength
    }));
  }
  return groupDigits(numberString, {
    minimumDigits,
    groupLength
  });
};
const groupDigits = (digits, {
  minimumDigits,
  groupLength
}) => {
  const digitCount = digits.length;
  if (digitCount < minimumDigits) {
    return digits;
  }
  let digitsWithSeparator = digits.slice(-groupLength);
  let remainingDigits = digits.slice(0, -groupLength);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-groupLength);
    remainingDigits = remainingDigits.slice(0, -groupLength);
    digitsWithSeparator = "".concat(group, "_").concat(digitsWithSeparator);
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

// https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1

const escapeTemplateStringSpecialCharacters = string => {
  string = String(string);
  let i = 0;
  let escapedString = "";
  while (i < string.length) {
    const char = string[i];
    i++;
    escapedString += isTemplateStringSpecialChar(char) ? "\\".concat(char) : char;
  }
  return escapedString;
};
const isTemplateStringSpecialChar = char => templateStringSpecialChars.indexOf(char) > -1;
const templateStringSpecialChars = ["\\", "`", "$"];
const preNewLineAndIndentation = (value, {
  depth,
  indentUsingTab,
  indentSize
}) => {
  return "".concat(newLineAndIndent({
    count: depth + 1,
    useTabs: indentUsingTab,
    size: indentSize
  })).concat(value);
};
const postNewLineAndIndentation = ({
  depth,
  indentUsingTab,
  indentSize
}) => {
  return newLineAndIndent({
    count: depth,
    useTabs: indentUsingTab,
    size: indentSize
  });
};
const newLineAndIndent = ({
  count,
  useTabs,
  size
}) => {
  if (useTabs) {
    // eslint-disable-next-line prefer-template
    return "\n" + "\t".repeat(count);
  }
  // eslint-disable-next-line prefer-template
  return "\n" + " ".repeat(count * size);
};
const wrapNewLineAndIndentation = (value, {
  depth,
  indentUsingTab,
  indentSize
}) => {
  return "".concat(preNewLineAndIndentation(value, {
    depth,
    indentUsingTab,
    indentSize
  })).concat(postNewLineAndIndentation({
    depth,
    indentUsingTab,
    indentSize
  }));
};

const DOUBLE_QUOTE = "\"";
const SINGLE_QUOTE = "'";
const BACKTICK = "`";
const inspectString = (value, {
  quote = "auto",
  canUseTemplateString = false,
  preserveLineBreaks = false,
  quoteDefault = DOUBLE_QUOTE
} = {}) => {
  quote = quote === "auto" ? determineQuote(value, {
    canUseTemplateString,
    quoteDefault
  }) : quote;
  if (quote === BACKTICK) {
    return "`".concat(escapeTemplateStringSpecialCharacters(value), "`");
  }
  return surroundStringWith(value, {
    quote,
    preserveLineBreaks
  });
};
const determineQuote = (string, {
  canUseTemplateString,
  quoteDefault = DOUBLE_QUOTE
} = {}) => {
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
const inspectChar = (char, {
  quote,
  preserveLineBreaks
}) => {
  const point = char.charCodeAt(0);
  if (preserveLineBreaks && (char === "\n" || char === "\r")) {
    return char;
  }
  if (char === quote || point === 92 || point < 32 || point > 126 && point < 160 ||
  // line separators
  point === 8232 || point === 8233) {
    const replacement = char === quote ? "\\".concat(quote) : point === 8232 ? "\\u2028" : point === 8233 ? "\\u2029" : meta[point];
    return replacement;
  }
  return char;
};

// https://github.com/jsenv/jsenv-uneval/blob/6c97ef9d8f2e9425a66f2c88347e0a118d427f3a/src/internal/escapeString.js#L3
// https://github.com/jsenv/jsenv-inspect/blob/bb11de3adf262b68f71ed82b0a37d4528dd42229/src/internal/string.js#L3
// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const surroundStringWith = (string, {
  quote,
  preserveLineBreaks
}) => {
  let result = "";
  let last = 0;
  const lastIndex = string.length;
  let i = 0;
  while (i < lastIndex) {
    const char = string[i];
    const replacement = inspectChar(char, {
      quote,
      preserveLineBreaks
    });
    if (char !== replacement) {
      if (last === i) {
        result += replacement;
      } else {
        result += "".concat(string.slice(last, i)).concat(replacement);
      }
      last = i + 1;
    }
    i++;
  }
  if (last !== lastIndex) {
    result += string.slice(last);
  }
  return "".concat(quote).concat(result).concat(quote);
};

// prettier-ignore
const meta = ['\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07',
// x07
'\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',
// x0F
'\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17',
// x17
'\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F',
// x1F
'', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',
// x2F
'', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
// x3F
'', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
// x4F
'', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',
// x5F
'', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
// x6F
'', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',
// x7F
'\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87',
// x87
'\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F',
// x8F
'\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97',
// x97
'\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F' // x9F
];

const inspectSymbol = (value, {
  nestedInspect,
  parenthesis
}) => {
  const symbolDescription = symbolToDescription$1(value);
  const symbolDescriptionSource = symbolDescription ? nestedInspect(symbolDescription) : "";
  const symbolSource = "Symbol(".concat(symbolDescriptionSource, ")");
  if (parenthesis) return "".concat(symbolSource);
  return symbolSource;
};
const symbolToDescription$1 = "description" in Symbol.prototype ? symbol => symbol.description : symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  const symbolDescription = toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  return symbolDescription;
};

const inspectUndefined = () => "undefined";

const inspectBigInt = value => {
  return "".concat(value, "n");
};

const inspectConstructor = (value, {
  parenthesis,
  useNew
}) => {
  let formattedString = value;
  if (parenthesis) {
    formattedString = "(".concat(value, ")");
  }
  if (useNew) {
    formattedString = "new ".concat(formattedString);
  }
  return formattedString;
};

const inspectArray = (value, {
  seen = [],
  nestedInspect,
  depth,
  indentUsingTab,
  indentSize,
  parenthesis,
  useNew
}) => {
  if (seen.indexOf(value) > -1) {
    return "Symbol.for('circular')";
  }
  seen.push(value);
  let valuesSource = "";
  let i = 0;
  const j = value.length;
  while (i < j) {
    const valueSource = value.hasOwnProperty(i) ? nestedInspect(value[i], {
      seen
    }) : "";
    if (i === 0) {
      valuesSource += valueSource;
    } else {
      valuesSource += ",".concat(preNewLineAndIndentation(valueSource, {
        depth,
        indentUsingTab,
        indentSize
      }));
    }
    i++;
  }
  let arraySource;
  if (valuesSource.length) {
    arraySource = wrapNewLineAndIndentation(valuesSource, {
      depth,
      indentUsingTab,
      indentSize
    });
  } else {
    arraySource = "";
  }
  arraySource = "[".concat(arraySource, "]");
  return inspectConstructor(arraySource, {
    parenthesis,
    useNew
  });
};

const inspectBigIntObject = (value, {
  nestedInspect
}) => {
  const bigIntSource = nestedInspect(value.valueOf());
  return "BigInt(".concat(bigIntSource, ")");
};

const inspectBooleanObject = (value, {
  nestedInspect,
  useNew,
  parenthesis
}) => {
  const booleanSource = nestedInspect(value.valueOf());
  return inspectConstructor("Boolean(".concat(booleanSource, ")"), {
    useNew,
    parenthesis
  });
};

const inspectError = (error, {
  nestedInspect,
  useNew,
  parenthesis
}) => {
  const messageSource = nestedInspect(error.message);
  const errorSource = inspectConstructor("".concat(errorToConstructorName(error), "(").concat(messageSource, ")"), {
    useNew,
    parenthesis
  });
  return errorSource;
};
const errorToConstructorName = ({
  name
}) => {
  if (derivedErrorNameArray.includes(name)) {
    return name;
  }
  return "Error";
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
const derivedErrorNameArray = ["EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError"];

const inspectDate = (value, {
  nestedInspect,
  useNew,
  parenthesis
}) => {
  const dateSource = nestedInspect(value.valueOf(), {
    numericSeparator: false
  });
  return inspectConstructor("Date(".concat(dateSource, ")"), {
    useNew,
    parenthesis
  });
};

const inspectFunction = (value, {
  showFunctionBody,
  parenthesis,
  depth
}) => {
  let functionSource;
  if (showFunctionBody) {
    functionSource = value.toString();
  } else {
    const isArrowFunction = value.prototype === undefined;
    const head = isArrowFunction ? "() =>" : "function ".concat(depth === 0 ? value.name : "", "()");
    functionSource = "".concat(head, " {/* hidden */}");
  }
  if (parenthesis) {
    return "(".concat(functionSource, ")");
  }
  return functionSource;
};

const inspectNumberObject = (value, {
  nestedInspect,
  useNew,
  parenthesis
}) => {
  const numberSource = nestedInspect(value.valueOf());
  return inspectConstructor("Number(".concat(numberSource, ")"), {
    useNew,
    parenthesis
  });
};

const inspectObject = (value, {
  nestedInspect,
  seen = [],
  depth,
  indentUsingTab,
  indentSize,
  objectConstructor,
  parenthesis,
  useNew
}) => {
  if (seen.indexOf(value) > -1) return "Symbol.for('circular')";
  seen.push(value);
  const propertySourceArray = [];
  Object.getOwnPropertyNames(value).forEach(propertyName => {
    const propertyNameAsNumber = parseInt(propertyName, 10);
    const propertyNameSource = nestedInspect(Number.isInteger(propertyNameAsNumber) ? propertyNameAsNumber : propertyName);
    propertySourceArray.push({
      nameOrSymbolSource: propertyNameSource,
      valueSource: nestedInspect(value[propertyName], {
        seen
      })
    });
  });
  Object.getOwnPropertySymbols(value).forEach(symbol => {
    propertySourceArray.push({
      nameOrSymbolSource: "[".concat(nestedInspect(symbol), "]"),
      valueSource: nestedInspect(value[symbol], {
        seen
      })
    });
  });
  let propertiesSource = "";
  propertySourceArray.forEach(({
    nameOrSymbolSource,
    valueSource
  }, index) => {
    if (index === 0) {
      propertiesSource += "".concat(nameOrSymbolSource, ": ").concat(valueSource);
    } else {
      propertiesSource += ",".concat(preNewLineAndIndentation("".concat(nameOrSymbolSource, ": ").concat(valueSource), {
        depth,
        indentUsingTab,
        indentSize
      }));
    }
  });
  let objectSource;
  if (propertiesSource.length) {
    objectSource = "".concat(wrapNewLineAndIndentation(propertiesSource, {
      depth,
      indentUsingTab,
      indentSize
    }));
  } else {
    objectSource = "";
  }
  if (objectConstructor) {
    objectSource = "Object({".concat(objectSource, "})");
  } else {
    objectSource = "{".concat(objectSource, "}");
  }
  return inspectConstructor(objectSource, {
    parenthesis,
    useNew
  });
};

const inspectRegExp = value => value.toString();

const inspectStringObject = (value, {
  nestedInspect,
  useNew,
  parenthesis
}) => {
  const stringSource = nestedInspect(value.valueOf());
  return inspectConstructor("String(".concat(stringSource, ")"), {
    useNew,
    parenthesis
  });
};

// primitives
const inspectMethodSymbol = Symbol.for("inspect");
const inspectValue = (value, options) => {
  const customInspect = value && value[inspectMethodSymbol];
  if (customInspect) {
    return customInspect(options);
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
  return inspectConstructor("".concat(compositeType, "(").concat(inspectObject(value, options), ")"), {
    ...options,
    parenthesis: false
  });
};
const primitiveTypeFromValue = value => {
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
  bigint: inspectBigInt
};
const compositeTypeFromObject = object => {
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
const {
  toString
} = Object.prototype;
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
  String: inspectStringObject
};

const inspect = (value, {
  parenthesis = false,
  quote = "auto",
  canUseTemplateString = true,
  useNew = false,
  objectConstructor = false,
  showFunctionBody = false,
  indentUsingTab = false,
  indentSize = 2,
  numericSeparator = true,
  preserveLineBreaks = false
} = {}) => {
  const scopedInspect = (scopedValue, scopedOptions) => {
    const options = {
      ...scopedOptions,
      nestedInspect: (nestedValue, nestedOptions = {}) => {
        return scopedInspect(nestedValue, {
          ...scopedOptions,
          depth: scopedOptions.depth + 1,
          ...nestedOptions
        });
      }
    };
    return inspectValue(scopedValue, options);
  };
  return scopedInspect(value, {
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
    depth: 0
  });
};

const isComposite = value => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};
const isPrimitive$1 = value => !isComposite(value);

/* eslint-disable no-use-before-define */
// https://github.com/dmail/dom/blob/e55a8c7b4cda6be2f7a4b1222f96d028a379b67f/src/visit.js#L89

const findPreviousComparison = (comparison, predicate) => {
  const createPreviousIterator = () => {
    let current = comparison;
    const next = () => {
      const previous = getPrevious(current);
      current = previous;
      return {
        done: !previous,
        value: previous
      };
    };
    return {
      next
    };
  };
  const iterator = createPreviousIterator();
  let next = iterator.next();
  while (!next.done) {
    const value = next.value;
    if (predicate(value)) {
      return value;
    }
    next = iterator.next();
  }
  return null;
};
const getLastChild = comparison => {
  return comparison.children[comparison.children.length - 1];
};
const getDeepestChild = comparison => {
  let deepest = getLastChild(comparison);
  while (deepest) {
    const lastChild = getLastChild(deepest);
    if (lastChild) {
      deepest = lastChild;
    } else {
      break;
    }
  }
  return deepest;
};
const getPreviousSibling = comparison => {
  const {
    parent
  } = comparison;
  if (!parent) return null;
  const {
    children
  } = parent;
  const index = children.indexOf(comparison);
  if (index === 0) return null;
  return children[index - 1];
};
const getPrevious = comparison => {
  const previousSibling = getPreviousSibling(comparison);
  if (previousSibling) {
    const deepestChild = getDeepestChild(previousSibling);
    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  const parent = comparison.parent;
  return parent;
};

const isRegExp = value => somePrototypeMatch(value, ({
  constructor
}) => constructor && constructor.name === "RegExp");
const isArray = value => somePrototypeMatch(value, ({
  constructor
}) => constructor && constructor.name === "Array");
const isError = value => somePrototypeMatch(value, ({
  constructor
}) => constructor && constructor.name === "Error");
const isSet = value => somePrototypeMatch(value, ({
  constructor
}) => constructor && constructor.name === "Set");
const isMap = value => somePrototypeMatch(value, ({
  constructor
}) => constructor && constructor.name === "Map");
const somePrototypeMatch = (value, predicate) => {
  if (value === undefined || value === null) {
    return false;
  }
  let prototype = Object.getPrototypeOf(value);
  while (prototype) {
    if (predicate(prototype)) return true;
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
};

const compare = ({
  actual,
  expected
}, {
  checkPropertiesOrder
}) => {
  const comparison = createComparison({
    type: "root",
    actual,
    expected
  });
  comparison.failed = !defaultComparer(comparison, {
    checkPropertiesOrder
  });
  return comparison;
};
const expectationSymbol = Symbol.for("expectation");
const createExpectation = comparerProperties => {
  return {
    [expectationSymbol]: true,
    comparerProperties
  };
};
const createNotExpectation = value => {
  const notExpectation = createExpectation({
    type: "not",
    expected: value,
    comparer: ({
      actual
    }) => {
      if (isNegativeZero(value)) {
        return !isNegativeZero(actual);
      }
      if (isNegativeZero(actual)) {
        return !isNegativeZero(value);
      }
      return actual !== value;
    }
  });
  notExpectation[inspectMethodSymbol] = () => {
    return "an other value";
  };
  return notExpectation;
};
const createAnyExpectation = expectedConstructor => {
  const anyExpectation = createExpectation({
    type: "any",
    expected: expectedConstructor,
    comparer: ({
      actual
    }) => {
      return somePrototypeMatch(actual, ({
        constructor
      }) => constructor && (constructor === expectedConstructor || constructor.name === expectedConstructor.name));
    }
  });
  anyExpectation[inspectMethodSymbol] = () => {
    return "any(".concat(expectedConstructor.name, ")");
  };
  return anyExpectation;
};
const createMatchesRegExpExpectation = regexp => {
  const matchesRegexpExpectation = createExpectation({
    type: "matches_reg_exp",
    expected: regexp,
    comparer: ({
      actual
    }) => {
      if (typeof actual !== "string") {
        return false;
      }
      return regexp.test(actual);
    }
  });
  matchesRegexpExpectation[inspectMethodSymbol] = () => {
    return "matchesRegExp(".concat(regexp, ")");
  };
  return matchesRegexpExpectation;
};
const createStartsWithExpectation = string => {
  const startsWithExpectation = createExpectation({
    type: "starts_with",
    expected: string,
    comparer: ({
      actual
    }) => {
      if (typeof actual !== "string") {
        return false;
      }
      return actual.startsWith(string);
    }
  });
  startsWithExpectation[inspectMethodSymbol] = () => {
    return "startsWith(".concat(inspect(string), ")");
  };
  return startsWithExpectation;
};
const createCloseToExpectation = (number, precision = 2) => {
  const closeToExpectation = createExpectation({
    type: "close_to",
    expected: number,
    comparer: ({
      actual
    }) => {
      if (actual === Infinity && number === Infinity) {
        return true;
      }
      if (actual === -Infinity && number === -Infinity) {
        return true;
      }
      const expectedDiff = Math.pow(10, -precision) / 2;
      const receivedDiff = Math.abs(number - actual);
      return receivedDiff < expectedDiff;
    }
  });
  closeToExpectation[inspectMethodSymbol] = () => {
    return "closeTo(".concat(inspect(number), ")");
  };
  return closeToExpectation;
};
const createBetweenExpectation = (min, max) => {
  const betweenExpectation = createExpectation({
    type: "between",
    expected: {
      min,
      max
    },
    comparer: ({
      actual
    }) => {
      if (typeof actual !== "number") {
        return false;
      }
      if (actual < min) {
        return false;
      }
      if (actual > max) {
        return false;
      }
      return true;
    }
  });
  betweenExpectation[inspectMethodSymbol] = () => {
    return "around(".concat(inspect(min), ", ").concat(inspect(max), ")");
  };
  return betweenExpectation;
};
const createComparison = ({
  parent = null,
  children = [],
  ...rest
}) => {
  const comparison = {
    parent,
    children,
    ...rest
  };
  return comparison;
};
const defaultComparer = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  if (typeof expected === "object" && expected !== null && expectationSymbol in expected) {
    subcompare(comparison, {
      ...expected.comparerProperties,
      actual,
      options
    });
    return !comparison.failed;
  }
  if (isPrimitive$1(expected) || isPrimitive$1(actual)) {
    compareIdentity(comparison, options);
    return !comparison.failed;
  }
  const expectedReference = findPreviousComparison(comparison, referenceComparisonCandidate => referenceComparisonCandidate !== comparison && referenceComparisonCandidate.expected === comparison.expected);
  if (expectedReference) {
    if (expectedReference.actual === comparison.actual) {
      subcompare(comparison, {
        type: "reference",
        actual: expectedReference,
        expected: expectedReference,
        comparer: () => true,
        options
      });
      return true;
    }
    subcompare(comparison, {
      type: "reference",
      actual: findPreviousComparison(comparison, referenceComparisonCandidate => referenceComparisonCandidate !== comparison && referenceComparisonCandidate.actual === comparison.actual),
      expected: expectedReference,
      comparer: ({
        actual,
        expected
      }) => actual === expected,
      options
    });
    if (comparison.failed) return false;
    // if we expectedAReference and it did not fail, we are done
    // this expectation was already compared and comparing it again
    // would cause infinite loop
    return true;
  }
  const actualReference = findPreviousComparison(comparison, referenceComparisonCandidate => referenceComparisonCandidate !== comparison && referenceComparisonCandidate.actual === comparison.actual);
  if (actualReference) {
    subcompare(comparison, {
      type: "reference",
      actual: actualReference,
      expected: null,
      comparer: () => false,
      options
    });
    return false;
  }
  compareIdentity(comparison, options);
  // actual === expected, no need to compare prototype, properties, ...
  if (!comparison.failed) {
    return true;
  }
  comparison.failed = false;
  comparePrototype(comparison, options);
  if (comparison.failed) {
    return false;
  }
  compareIntegrity(comparison, options);
  if (comparison.failed) {
    return false;
  }
  compareExtensibility(comparison, options);
  if (comparison.failed) {
    return false;
  }
  comparePropertiesDescriptors(comparison, options);
  if (comparison.failed) {
    return false;
  }
  compareProperties(comparison, options);
  if (comparison.failed) {
    return false;
  }
  compareSymbolsDescriptors(comparison, options);
  if (comparison.failed) {
    return false;
  }
  compareSymbols(comparison, options);
  if (comparison.failed) {
    return false;
  }
  if (typeof Set === "function" && isSet(expected)) {
    compareSetEntries(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }
  if (typeof Map === "function" && isMap(expected)) {
    compareMapEntries(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }
  if ("valueOf" in expected && typeof expected.valueOf === "function") {
    // always keep this one after properties because we must first ensure
    // valueOf is on both actual and expected
    // usefull because new Date(10).valueOf() === 10
    // or new Boolean(true).valueOf() === true
    compareValueOfReturnValue(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }

  // required otherwise assert({ actual: /a/, expected: /b/ }) would not throw
  if (isRegExp(expected)) {
    compareToStringReturnValue(comparison, options);
    if (comparison.failed) {
      return false;
    }
  }
  return true;
};
const subcompare = (comparison, {
  type,
  data,
  actual,
  expected,
  comparer = defaultComparer,
  options
}) => {
  const subcomparison = createComparison({
    type,
    data,
    actual,
    expected,
    parent: comparison
  });
  comparison.children.push(subcomparison);
  subcomparison.failed = !comparer(subcomparison, options);
  comparison.failed = subcomparison.failed;
  return subcomparison;
};
const compareIdentity = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  subcompare(comparison, {
    type: "identity",
    actual,
    expected,
    comparer: () => {
      if (isBuffer(actual) && isBuffer(expected)) {
        return actual.equals(expected);
      }
      if (isNegativeZero(expected)) {
        return isNegativeZero(actual);
      }
      if (isNegativeZero(actual)) {
        return isNegativeZero(expected);
      }
      return actual === expected;
    },
    options
  });
};
// under some rare and odd circumstances firefox Object.is(-0, -0)
// returns false making test fail.
// it is 100% reproductible with big.test.js.
// However putting debugger or executing Object.is just before the
// comparison prevent Object.is failure.
// It makes me thing there is something strange inside firefox internals.
// All this to say avoid relying on Object.is to test if the value is -0
const isNegativeZero = value => {
  return typeof value === "number" && 1 / value === -Infinity;
};
const isBuffer = value => {
  return typeof Buffer === "function" && Buffer.isBuffer(value);
};
const comparePrototype = (comparison, options) => {
  subcompare(comparison, {
    type: "prototype",
    actual: Object.getPrototypeOf(comparison.actual),
    expected: Object.getPrototypeOf(comparison.expected),
    options
  });
};
const compareExtensibility = (comparison, options) => {
  subcompare(comparison, {
    type: "extensibility",
    actual: Object.isExtensible(comparison.actual) ? "extensible" : "non-extensible",
    expected: Object.isExtensible(comparison.expected) ? "extensible" : "non-extensible",
    comparer: ({
      actual,
      expected
    }) => actual === expected,
    options
  });
};

// https://tc39.github.io/ecma262/#sec-setintegritylevel
const compareIntegrity = (comparison, options) => {
  subcompare(comparison, {
    type: "integrity",
    actual: getIntegriy(comparison.actual),
    expected: getIntegriy(comparison.expected),
    comparer: ({
      actual,
      expected
    }) => actual === expected,
    options
  });
};
const getIntegriy = value => {
  if (Object.isFrozen(value)) return "frozen";
  if (Object.isSealed(value)) return "sealed";
  return "none";
};
const compareProperties = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  const isErrorConstructor = typeof actual === "function" && actual.name === "Error";
  const ignoredProperties = isErrorConstructor ? ["prepareStackTrace"] : [];
  const expectedPropertyNames = Object.getOwnPropertyNames(expected);
  const actualPropertyNames = Object.getOwnPropertyNames(actual);
  const actualMissing = expectedPropertyNames.filter(name => {
    const missing = actualPropertyNames.indexOf(name) === -1;
    return missing && ignoredProperties.indexOf(name) === -1;
  });
  const actualExtra = actualPropertyNames.filter(name => {
    const extra = expectedPropertyNames.indexOf(name) === -1;
    return extra && ignoredProperties.indexOf(name) === -1;
  });
  const expectedMissing = [];
  const expectedExtra = [];
  subcompare(comparison, {
    type: "properties",
    actual: {
      missing: actualMissing,
      extra: actualExtra
    },
    expected: {
      missing: expectedMissing,
      extra: expectedExtra
    },
    comparer: () => actualMissing.length === 0 && actualExtra.length === 0,
    options
  });
  if (comparison.failed) {
    return;
  }
  if (options.checkPropertiesOrder && !isErrorConstructor) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    subcompare(comparison, {
      type: "properties-order",
      actual: actualKeys,
      expected: expectedKeys,
      comparer: () => expectedKeys.every((name, index) => name === actualKeys[index]),
      options
    });
  }
};
const compareSymbols = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  const expectedSymbols = Object.getOwnPropertySymbols(expected);
  const actualSymbols = Object.getOwnPropertySymbols(actual);
  const actualMissing = expectedSymbols.filter(symbol => actualSymbols.indexOf(symbol) === -1);
  const actualExtra = actualSymbols.filter(symbol => expectedSymbols.indexOf(symbol) === -1);
  const expectedMissing = [];
  const expectedExtra = [];
  subcompare(comparison, {
    type: "symbols",
    actual: {
      missing: actualMissing,
      extra: actualExtra
    },
    expected: {
      missing: expectedMissing,
      extra: expectedExtra
    },
    comparer: () => actualMissing.length === 0 && actualExtra.length === 0,
    options
  });
  if (comparison.failed) return;
  if (options.checkPropertiesOrder) {
    subcompare(comparison, {
      type: "symbols-order",
      actual: actualSymbols,
      expected: expectedSymbols,
      comparer: () => expectedSymbols.every((symbol, index) => symbol === actualSymbols[index]),
      options
    });
  }
};
const comparePropertiesDescriptors = (comparison, options) => {
  const {
    expected
  } = comparison;
  const expectedPropertyNames = Object.getOwnPropertyNames(expected);
  // eslint-disable-next-line no-unused-vars
  for (const expectedPropertyName of expectedPropertyNames) {
    comparePropertyDescriptor(comparison, expectedPropertyName, expected, options);
    if (comparison.failed) break;
  }
};
const compareSymbolsDescriptors = (comparison, options) => {
  const {
    expected
  } = comparison;
  const expectedSymbols = Object.getOwnPropertySymbols(expected);
  // eslint-disable-next-line no-unused-vars
  for (const expectedSymbol of expectedSymbols) {
    comparePropertyDescriptor(comparison, expectedSymbol, expected, options);
    if (comparison.failed) break;
  }
};
const comparePropertyDescriptor = (comparison, property, owner, options) => {
  const {
    actual,
    expected
  } = comparison;
  const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, property);
  const actualDescriptor = Object.getOwnPropertyDescriptor(actual, property);
  if (!actualDescriptor) {
    return;
  }
  const configurableComparison = subcompare(comparison, {
    type: "property-configurable",
    data: property,
    actual: actualDescriptor.configurable ? "configurable" : "non-configurable",
    expected: expectedDescriptor.configurable ? "configurable" : "non-configurable",
    comparer: ({
      actual,
      expected
    }) => actual === expected,
    options
  });
  if (configurableComparison.failed) {
    return;
  }
  const enumerableComparison = subcompare(comparison, {
    type: "property-enumerable",
    data: property,
    actual: actualDescriptor.enumerable ? "enumerable" : "non-enumerable",
    expected: expectedDescriptor.enumerable ? "enumerable" : "non-enumerable",
    comparer: ({
      actual,
      expected
    }) => actual === expected,
    options
  });
  if (enumerableComparison.failed) {
    return;
  }
  const writableComparison = subcompare(comparison, {
    type: "property-writable",
    data: property,
    actual: actualDescriptor.writable ? "writable" : "non-writable",
    expected: expectedDescriptor.writable ? "writable" : "non-writable",
    comparer: ({
      actual,
      expected
    }) => actual === expected,
    options
  });
  if (writableComparison.failed) {
    return;
  }
  if (isError(owner) && isErrorPropertyIgnored(property)) {
    return;
  }
  if (typeof owner === "function") {
    if (owner.name === "RegExp" && isRegExpPropertyIgnored(property)) {
      return;
    }
    if (isFunctionPropertyIgnored(property)) {
      return;
    }
  }
  const getComparison = subcompare(comparison, {
    type: "property-get",
    data: property,
    actual: actualDescriptor.get,
    expected: expectedDescriptor.get,
    options
  });
  if (getComparison.failed) {
    return;
  }
  const setComparison = subcompare(comparison, {
    type: "property-set",
    data: property,
    actual: actualDescriptor.set,
    expected: expectedDescriptor.set,
    options
  });
  if (setComparison.failed) {
    return;
  }
  const valueComparison = subcompare(comparison, {
    type: "property-value",
    data: isArray(expected) ? propertyToArrayIndex(property) : property,
    actual: actualDescriptor.value,
    expected: expectedDescriptor.value,
    options
  });
  if (valueComparison.failed) {
    return;
  }
};
const isRegExpPropertyIgnored = name => RegExpIgnoredProperties.includes(name);
const isFunctionPropertyIgnored = name => functionIgnoredProperties.includes(name);
const isErrorPropertyIgnored = name => errorIgnoredProperties.includes(name);

// some regexp properties fails the comparison but that's expected
// to my experience it happens only in webkit.
// check https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/RegExp/input
// to see why these properties exists and would fail between each regex instance
const RegExpIgnoredProperties = ["input", "$_", "lastMatch", "$&", "lastParen", "$+", "leftContext", "$`", "rightContext", "$'"];
const functionIgnoredProperties = [
// function caller would fail comparison but that's expected
"caller",
// function arguments would fail comparison but that's expected
"arguments"];
const errorIgnoredProperties = [
// stack fails comparison but it's not important
"stack",
// firefox properties that would fail comparison but that's expected
"file", "fileName", "lineNumber", "columnNumber",
// webkit properties that would fail comparison but that's expected
"line", "column", "sourceURL"];
const propertyToArrayIndex = property => {
  if (typeof property !== "string") return property;
  const propertyAsNumber = parseInt(property, 10);
  if (Number.isInteger(propertyAsNumber) && propertyAsNumber >= 0) {
    return propertyAsNumber;
  }
  return property;
};
const compareSetEntries = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  const expectedEntries = Array.from(expected.values()).map((value, index) => {
    return {
      index,
      value
    };
  });
  const actualEntries = Array.from(actual.values()).map((value, index) => {
    return {
      index,
      value
    };
  });

  // first check actual entries match expected entries
  // eslint-disable-next-line no-unused-vars
  for (const actualEntry of actualEntries) {
    const expectedEntry = expectedEntries[actualEntry.index];
    if (expectedEntry) {
      const entryComparison = subcompare(comparison, {
        type: "set-entry",
        data: actualEntry.index,
        actual: actualEntry.value,
        expected: expectedEntry.value,
        options
      });
      if (entryComparison.failed) return;
    }
  }
  const actualSize = actual.size;
  const expectedSize = expected.size;
  const sizeComparison = subcompare(comparison, {
    type: "set-size",
    actual: actualSize,
    expected: expectedSize,
    comparer: () => actualSize === expectedSize,
    options
  });
  if (sizeComparison.failed) return;
};
const compareMapEntries = (comparison, options) => {
  const {
    actual,
    expected
  } = comparison;
  const actualEntries = Array.from(actual.keys()).map(key => {
    return {
      key,
      value: actual.get(key)
    };
  });
  const expectedEntries = Array.from(expected.keys()).map(key => {
    return {
      key,
      value: expected.get(key)
    };
  });
  const entryMapping = [];
  const expectedEntryCandidates = expectedEntries.slice();
  actualEntries.forEach(actualEntry => {
    const expectedEntry = expectedEntryCandidates.find(expectedEntryCandidate => {
      const mappingComparison = subcompare(comparison, {
        type: "map-entry-key-mapping",
        actual: actualEntry.key,
        expected: expectedEntryCandidate.key,
        options
      });
      if (mappingComparison.failed) {
        comparison.failed = false;
        return false;
      }
      return true;
    });
    if (expectedEntry) expectedEntryCandidates.splice(expectedEntryCandidates.indexOf(expectedEntry), 1);
    entryMapping.push({
      actualEntry,
      expectedEntry
    });
  });

  // should we ensure entries are defined in the same order ?
  // I'm not sure about that, but maybe.
  // in that case, just like for properties order
  // this is the last thing we would check
  // because it gives less information

  // first check all actual entry macthes expected entry
  let index = 0;
  // eslint-disable-next-line no-unused-vars
  for (const actualEntry of actualEntries) {
    const actualEntryMapping = entryMapping.find(mapping => mapping.actualEntry === actualEntry);
    if (actualEntryMapping && actualEntryMapping.expectedEntry) {
      const mapEntryComparison = subcompare(comparison, {
        type: "map-entry",
        data: index,
        actual: actualEntry,
        expected: actualEntryMapping.expectedEntry,
        options
      });
      if (mapEntryComparison.failed) return;
    }
    index++;
  }

  // second check there is no unexpected entry
  const mappingWithoutExpectedEntry = entryMapping.find(mapping => mapping.expectedEntry === undefined);
  const unexpectedEntry = mappingWithoutExpectedEntry ? mappingWithoutExpectedEntry.actualEntry : null;
  const unexpectedEntryComparison = subcompare(comparison, {
    type: "map-entry",
    actual: unexpectedEntry,
    expected: null,
    options
  });
  if (unexpectedEntryComparison.failed) return;

  // third check there is no missing entry (expected but not found)
  const expectedEntryWithoutActualEntry = expectedEntries.find(expectedEntry => entryMapping.every(mapping => mapping.expectedEntry !== expectedEntry));
  const missingEntry = expectedEntryWithoutActualEntry || null;
  const missingEntryComparison = subcompare(comparison, {
    type: "map-entry",
    actual: null,
    expected: missingEntry,
    options
  });
  if (missingEntryComparison.failed) return;
};
const compareValueOfReturnValue = (comparison, options) => {
  subcompare(comparison, {
    type: "value-of-return-value",
    actual: comparison.actual.valueOf(),
    expected: comparison.expected.valueOf(),
    options
  });
};
const compareToStringReturnValue = (comparison, options) => {
  subcompare(comparison, {
    type: "to-string-return-value",
    actual: comparison.actual.toString(),
    expected: comparison.expected.toString(),
    options
  });
};

const propertyNameToDotNotationAllowed = propertyName => {
  return /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) || /^[a-z_$]$/i.test(propertyName);
};

const propertyToAccessorString = property => {
  if (typeof property === "number") {
    return "[".concat(inspect(property), "]");
  }
  if (typeof property === "string") {
    const dotNotationAllowedForProperty = propertyNameToDotNotationAllowed(property);
    if (dotNotationAllowedForProperty) {
      return ".".concat(property);
    }
    return "[".concat(inspect(property), "]");
  }
  return "[".concat(symbolToWellKnownSymbol(property), "]");
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Well-known_symbols
const symbolToWellKnownSymbol = symbol => {
  const wellKnownSymbolName = Object.getOwnPropertyNames(Symbol).find(name => symbol === Symbol[name]);
  if (wellKnownSymbolName) {
    return "Symbol".concat(propertyToAccessorString(wellKnownSymbolName));
  }
  const description = symbolToDescription(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return "Symbol.for(".concat(inspect(description), ")");
    }
    return "Symbol(".concat(inspect(description), ")");
  }
  return "Symbol()";
};
const symbolToDescription = symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  // return symbol.description // does not work on node
};

const comparisonToPath = (comparison, name = "actual") => {
  const comparisonPath = [];
  let ancestor = comparison.parent;
  while (ancestor && ancestor.type !== "root") {
    comparisonPath.unshift(ancestor);
    ancestor = ancestor.parent;
  }
  if (comparison.type !== "root") {
    comparisonPath.push(comparison);
  }
  const path = comparisonPath.reduce((previous, {
    type,
    data
  }) => {
    if (type === "property-enumerable") {
      return "".concat(previous).concat(propertyToAccessorString(data), "[[Enumerable]]");
    }
    if (type === "property-configurable") {
      return "".concat(previous).concat(propertyToAccessorString(data), "[[Configurable]]");
    }
    if (type === "property-writable") {
      return "".concat(previous).concat(propertyToAccessorString(data), "[[Writable]]");
    }
    if (type === "property-get") {
      return "".concat(previous).concat(propertyToAccessorString(data), "[[Get]]");
    }
    if (type === "property-set") {
      return "".concat(previous).concat(propertyToAccessorString(data), "[[Set]]");
    }
    if (type === "property-value") {
      return "".concat(previous).concat(propertyToAccessorString(data));
    }
    if (type === "map-entry") {
      return "".concat(previous, "[[mapEntry:").concat(data, "]]");
    }
    if (type === "set-entry") {
      return "".concat(previous, "[[setEntry:").concat(data, "]]");
    }
    if (type === "reference") {
      return "".concat(previous);
    }
    if (type === "integrity") {
      return "".concat(previous, "[[Integrity]]");
    }
    if (type === "extensibility") {
      return "".concat(previous, "[[Extensible]]");
    }
    if (type === "prototype") {
      return "".concat(previous, "[[Prototype]]");
    }
    if (type === "properties") {
      return "".concat(previous);
    }
    if (type === "properties-order") {
      return "".concat(previous);
    }
    if (type === "symbols") {
      return "".concat(previous);
    }
    if (type === "symbols-order") {
      return "".concat(previous);
    }
    if (type === "to-string-return-value") {
      return "".concat(previous, ".toString()");
    }
    if (type === "value-of-return-value") {
      return "".concat(previous, ".valueOf()");
    }
    if (type === "identity" || type === "not" || type === "any" || type === "matches_reg_exp" || type === "starts_with" || type === "close_to" || type === "between") {
      return previous;
    }
    return "".concat(previous, " type:").concat(type, ", data:").concat(data);
  }, name);
  return path;
};

const valueToWellKnown = value => {
  const compositeWellKnownPath = valueToCompositeWellKnownPath(value);
  if (compositeWellKnownPath) {
    return compositeWellKnownPath.slice(1).reduce((previous, property) => "".concat(previous).concat(propertyToAccessorString(property)), compositeWellKnownPath[0]);
  }
  return null;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();
const valueToCompositeWellKnownPath = value => {
  return compositeWellKnownMap.get(value);
};
const isPrimitive = value => !isComposite(value);
const addWellKnownComposite = (value, name) => {
  const visitValue = (value, path) => {
    if (isPrimitive(value)) {
      primitiveWellKnownMap.set(value, path);
      return;
    }
    if (compositeWellKnownMap.has(value)) return; // prevent infinite recursion
    compositeWellKnownMap.set(value, path);
    const visitProperty = property => {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, property);
      } catch (e) {
        // may happen if you try to access some iframe properties or stuff like that
        if (e.name === "SecurityError") {
          return;
        }
        throw e;
      }
      if (!descriptor) {
        return;
      }

      // do not trigger getter/setter
      if ("value" in descriptor) {
        const propertyValue = descriptor.value;
        visitValue(propertyValue, [...path, property]);
      }
    };
    Object.getOwnPropertyNames(value).forEach(name => visitProperty(name));
    Object.getOwnPropertySymbols(value).forEach(symbol => visitProperty(symbol));
  };
  visitValue(value, [name]);
};
if (typeof global === "object") {
  addWellKnownComposite(global, "global");
}
if (typeof window === "object") {
  addWellKnownComposite(window, "window");
}

const valueToString = value => {
  return valueToWellKnown(value) || inspect(value);
};

const anyComparisonToErrorMessage = comparison => {
  if (comparison.type !== "any") return undefined;
  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedConstructor = comparison.expected;
  return createAnyMessage({
    path,
    expectedConstructor,
    actualValue
  });
};
const createAnyMessage = ({
  path,
  expectedConstructor,
  actualValue
}) => "unexpected value\n--- found ---\n".concat(actualValue, "\n--- expected ---\nany(").concat(expectedConstructor.name, ")\n--- path ---\n").concat(path);

const createDetailedMessage = (message, details = {}) => {
  let string = "".concat(message);
  Object.keys(details).forEach(key => {
    const value = details[key];
    string += "\n--- ".concat(key, " ---\n").concat(Array.isArray(value) ? value.join("\n") : value);
  });
  return string;
};

const defaultComparisonToErrorMessage = comparison => {
  const path = comparisonToPath(comparison);
  const {
    expected,
    actual
  } = comparison;
  const expectedValue = valueToString(expected);
  const actualValue = valueToString(actual);
  return createDetailedMessage("unequal values", {
    found: actualValue,
    expected: expectedValue,
    path
  });
};

const referenceComparisonToErrorMessage = comparison => {
  if (comparison.type !== "reference") return undefined;
  const {
    actual,
    expected
  } = comparison;
  const isMissing = expected && !actual;
  const isExtra = !expected && actual;
  const path = comparisonToPath(comparison);
  if (isExtra) {
    return createUnexpectedReferenceMessage({
      path,
      expectedValue: valueToString(comparison.parent.expected),
      unexpectedReferencePath: comparisonToPath(actual, "actual")
    });
  }
  if (isMissing) {
    return createMissingReferenceMessage({
      path,
      expectedReferencePath: comparisonToPath(expected, "expected"),
      actualValue: valueToString(comparison.parent.actual)
    });
  }
  return createUnequalRefencesMessage({
    path,
    expectedReferencePath: comparisonToPath(expected, "expected"),
    actualReferencePath: comparisonToPath(actual, "actual")
  });
};
const createUnexpectedReferenceMessage = ({
  path,
  expectedValue,
  unexpectedReferencePath
}) => "found a reference instead of a value\n--- reference found to ---\n".concat(unexpectedReferencePath, "\n--- value expected ---\n").concat(expectedValue, "\n--- path ---\n").concat(path);
const createMissingReferenceMessage = ({
  path,
  expectedReferencePath,
  actualValue
}) => "found a value instead of a reference\n--- value found ---\n".concat(actualValue, "\n--- reference expected to ---\n").concat(expectedReferencePath, "\n--- path ---\n").concat(path);
const createUnequalRefencesMessage = ({
  path,
  expectedReferencePath,
  actualReferencePath
}) => "unequal references\n--- reference found to ---\n".concat(actualReferencePath, "\n--- reference expected to ---\n").concat(expectedReferencePath, "\n--- path ---\n").concat(path);

const comparisonToRootComparison = comparison => {
  let current = comparison;
  while (current) {
    if (current.parent) {
      current = current.parent;
    } else {
      break;
    }
  }
  return current;
};

const findSelfOrAncestorComparison = (comparison, predicate) => {
  let current = comparison;
  let foundComparison;
  while (current) {
    if (current && predicate(current)) {
      foundComparison = current;
      current = foundComparison.parent;
      while (current) {
        if (predicate(current)) foundComparison = current;
        current = current.parent;
      }
      return foundComparison;
    }
    current = current.parent;
  }
  return null;
};

const prototypeComparisonToErrorMessage = comparison => {
  const prototypeComparison = findSelfOrAncestorComparison(comparison, ({
    type
  }) => type === "prototype");
  if (!prototypeComparison) return null;
  const rootComparison = comparisonToRootComparison(comparison);
  const path = comparisonToPath(prototypeComparison);
  const prototypeToString = prototype => {
    const wellKnown = valueToWellKnown(prototype);
    if (wellKnown) return wellKnown;
    // we could check in the whole comparison tree, not only for actual/expected
    // but any reference to that prototype
    // to have a better name for it
    // if anything refer to it except himself
    // it would be a better name for that object no ?
    if (prototype === rootComparison.expected) return "expected";
    if (prototype === rootComparison.actual) return "actual";
    return inspect(prototype);
  };
  const expectedPrototype = prototypeComparison.expected;
  const actualPrototype = prototypeComparison.actual;
  return createUnequalPrototypesMessage({
    path,
    expectedPrototype: prototypeToString(expectedPrototype),
    actualPrototype: prototypeToString(actualPrototype)
  });
};
const createUnequalPrototypesMessage = ({
  path,
  expectedPrototype,
  actualPrototype
}) => "unequal prototypes\n--- prototype found ---\n".concat(actualPrototype, "\n--- prototype expected ---\n").concat(expectedPrototype, "\n--- path ---\n").concat(path);

const propertiesComparisonToErrorMessage = comparison => {
  if (comparison.type !== "properties") {
    return undefined;
  }
  const path = comparisonToPath(comparison.parent);
  const missing = comparison.actual.missing;
  const extra = comparison.actual.extra;
  const missingCount = missing.length;
  const extraCount = extra.length;
  const unexpectedProperties = {};
  extra.forEach(propertyName => {
    unexpectedProperties[propertyName] = comparison.parent.actual[propertyName];
  });
  const missingProperties = {};
  missing.forEach(propertyName => {
    missingProperties[propertyName] = comparison.parent.expected[propertyName];
  });
  if (missingCount === 1 && extraCount === 0) {
    return createDetailedMessage("1 missing property", {
      "missing property": inspect(missingProperties),
      path
    });
  }
  if (missingCount > 1 && extraCount === 0) {
    return createDetailedMessage("".concat(missingCount, " missing properties"), {
      "missing properties": inspect(missingProperties),
      path
    });
  }
  if (missingCount === 0 && extraCount === 1) {
    return createDetailedMessage("1 unexpected property", {
      "unexpected property": inspect(unexpectedProperties),
      path
    });
  }
  if (missingCount === 0 && extraCount > 1) {
    return createDetailedMessage("".concat(extraCount, " unexpected properties"), {
      "unexpected properties": inspect(unexpectedProperties),
      path
    });
  }
  let message = "";
  if (extraCount === 1) {
    message += "1 unexpected property";
  } else {
    message += "".concat(extraCount, " unexpected properties");
  }
  if (missingCount === 1) {
    message += " and 1 missing property";
  } else {
    message += " and ".concat(missingCount, " missing properties");
  }
  return createDetailedMessage(message, {
    [extraCount === 1 ? "unexpected property" : "unexpected properties"]: inspect(unexpectedProperties),
    [missingCount === 1 ? "missing property" : "missing properties"]: inspect(missingProperties),
    path
  });
};

const propertiesOrderComparisonToErrorMessage = comparison => {
  if (comparison.type !== "properties-order") return undefined;
  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;
  return createUnexpectedPropertiesOrderMessage({
    path,
    expectedPropertiesOrder: propertyNameArrayToString(expected),
    actualPropertiesOrder: propertyNameArrayToString(actual)
  });
};
const createUnexpectedPropertiesOrderMessage = ({
  path,
  expectedPropertiesOrder,
  actualPropertiesOrder
}) => "unexpected properties order\n--- properties order found ---\n".concat(actualPropertiesOrder.join("\n"), "\n--- properties order expected ---\n").concat(expectedPropertiesOrder.join("\n"), "\n--- path ---\n").concat(path);
const propertyNameArrayToString = propertyNameArray => {
  return propertyNameArray.map(propertyName => inspect(propertyName));
};

const symbolsComparisonToErrorMessage = comparison => {
  if (comparison.type !== "symbols") return undefined;
  const path = comparisonToPath(comparison);
  const extra = comparison.actual.extra;
  const missing = comparison.actual.missing;
  const hasExtra = extra.length > 0;
  const hasMissing = missing.length > 0;
  if (hasExtra && !hasMissing) {
    return createUnexpectedSymbolsMessage({
      path,
      unexpectedSymbols: symbolArrayToString$1(extra)
    });
  }
  if (!hasExtra && hasMissing) {
    return createMissingSymbolsMessage({
      path,
      missingSymbols: symbolArrayToString$1(missing)
    });
  }
  return createUnexpectedAndMissingSymbolsMessage({
    path,
    unexpectedSymbols: symbolArrayToString$1(extra),
    missingSymbols: symbolArrayToString$1(missing)
  });
};
const createUnexpectedSymbolsMessage = ({
  path,
  unexpectedSymbols
}) => "unexpected symbols\n--- unexpected symbol list ---\n".concat(unexpectedSymbols.join("\n"), "\n--- path ---\n").concat(path);
const createMissingSymbolsMessage = ({
  path,
  missingSymbols
}) => "missing symbols\n--- missing symbol list ---\n".concat(missingSymbols.join("\n"), "\n--- path ---\n").concat(path);
const createUnexpectedAndMissingSymbolsMessage = ({
  path,
  unexpectedSymbols,
  missingSymbols
}) => "unexpected and missing symbols\n--- unexpected symbol list ---\n".concat(unexpectedSymbols.join("\n"), "\n--- missing symbol list ---\n").concat(missingSymbols.join("\n"), "\n--- path ---\n").concat(path);
const symbolArrayToString$1 = symbolArray => {
  return symbolArray.map(symbol => inspect(symbol));
};

const symbolsOrderComparisonToErrorMessage = comparison => {
  if (comparison.type !== "symbols-order") return undefined;
  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;
  return createUnexpectedSymbolsOrderMessage({
    path,
    expectedSymbolsOrder: symbolArrayToString(expected),
    actualSymbolsOrder: symbolArrayToString(actual)
  });
};
const createUnexpectedSymbolsOrderMessage = ({
  path,
  expectedSymbolsOrder,
  actualSymbolsOrder
}) => "unexpected symbols order\n--- symbols order found ---\n".concat(actualSymbolsOrder.join("\n"), "\n--- symbols order expected ---\n").concat(expectedSymbolsOrder.join("\n"), "\n--- path ---\n").concat(path);
const symbolArrayToString = symbolArray => {
  return symbolArray.map(symbol => inspect(symbol));
};

const setSizeComparisonToMessage = comparison => {
  if (comparison.type !== "set-size") return undefined;
  if (comparison.actual > comparison.expected) return createBiggerThanExpectedMessage(comparison);
  return createSmallerThanExpectedMessage(comparison);
};
const createBiggerThanExpectedMessage = comparison => "a set is bigger than expected\n--- set size found ---\n".concat(comparison.actual, "\n--- set size expected ---\n").concat(comparison.expected, "\n--- path ---\n").concat(comparisonToPath(comparison.parent));
const createSmallerThanExpectedMessage = comparison => "a set is smaller than expected\n--- set size found ---\n".concat(comparison.actual, "\n--- set size expected ---\n").concat(comparison.expected, "\n--- path ---\n").concat(comparisonToPath(comparison.parent));

const mapEntryComparisonToErrorMessage = comparison => {
  const mapEntryComparison = findSelfOrAncestorComparison(comparison, ({
    type
  }) => type === "map-entry");
  if (!mapEntryComparison) return null;
  const isUnexpected = !mapEntryComparison.expected && mapEntryComparison.actual;
  if (isUnexpected) return createUnexpectedMapEntryErrorMessage(mapEntryComparison);
  const isMissing = mapEntryComparison.expected && !mapEntryComparison.actual;
  if (isMissing) return createMissingMapEntryErrorMessage(mapEntryComparison);
  return null;
};
const createUnexpectedMapEntryErrorMessage = comparison => "an entry is unexpected\n--- unexpected entry key ---\n".concat(valueToString(comparison.actual.key), "\n--- unexpected entry value ---\n").concat(valueToString(comparison.actual.value), "\n--- path ---\n").concat(comparisonToPath(comparison.parent));
const createMissingMapEntryErrorMessage = comparison => "an entry is missing\n--- missing entry key ---\n".concat(valueToString(comparison.expected.key), "\n--- missing entry value ---\n").concat(valueToString(comparison.expected.value), "\n--- path ---\n").concat(comparisonToPath(comparison.parent));

const matchesRegExpToErrorMessage = comparison => {
  if (comparison.type !== "matches_reg_exp") {
    return undefined;
  }
  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedRegexp = valueToString(comparison.expected);
  return createMatchesRegExpMessage({
    path,
    actualValue,
    expectedRegexp
  });
};
const createMatchesRegExpMessage = ({
  path,
  expectedRegexp,
  actualValue
}) => "unexpected value\n--- found ---\n".concat(actualValue, "\n--- expected ---\nmatchesRegExp(").concat(expectedRegexp, ")\n--- path ---\n").concat(path);

const notComparisonToErrorMessage = comparison => {
  if (comparison.type !== "not") return undefined;
  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  return createNotMessage({
    path,
    actualValue
  });
};
const createNotMessage = ({
  path,
  actualValue
}) => "unexpected value\n--- found ---\n".concat(actualValue, "\n--- expected ---\nan other value\n--- path ---\n").concat(path);

const arrayLengthComparisonToMessage = comparison => {
  if (comparison.type !== "identity") return undefined;
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") return undefined;
  if (parentComparison.data !== "length") return undefined;
  const grandParentComparison = parentComparison.parent;
  if (!isArray(grandParentComparison.actual)) return undefined;
  const actualArray = grandParentComparison.actual;
  const expectedArray = grandParentComparison.expected;
  const actualLength = comparison.actual;
  const expectedLength = comparison.expected;
  const path = comparisonToPath(grandParentComparison);
  if (actualLength < expectedLength) {
    const missingValues = expectedArray.slice(actualLength);
    return createDetailedMessage("an array is smaller than expected", {
      "array length found": actualLength,
      "array length expected": expectedLength,
      "missing values": inspect(missingValues),
      path
    });
  }
  const extraValues = actualArray.slice(expectedLength);
  return createDetailedMessage("an array is bigger than expected", {
    "array length found": actualLength,
    "array length expected": expectedLength,
    "extra values": inspect(extraValues),
    path
  });
};

const MAX_HEIGHT = 10;
let MAX_WIDTH = 80;
const COLUMN_MARKER_CHAR = "^";
const EXPECTED_CONTINUES_WITH_MAX_LENGTH = 30;
const stringsComparisonToErrorMessage = comparison => {
  const isStartsWithComparison = comparison.type === "starts_with";
  if (comparison.type !== "identity" && !isStartsWithComparison) {
    return undefined;
  }
  const {
    actual,
    expected
  } = comparison;
  if (typeof actual !== "string") {
    return undefined;
  }
  if (typeof expected !== "string") {
    return undefined;
  }
  const name = stringNameFromComparison(comparison);
  const path = comparisonToPath(comparison);
  return formatStringAssertionErrorMessage({
    actual,
    expected,
    path,
    name
  });
};
const formatStringAssertionErrorMessage = ({
  actual,
  expected,
  path = "",
  name = "string"
}) => {
  const actualQuote = determineQuote(actual);
  const formatActualChar = char => {
    return inspectChar(char, {
      quote: actualQuote,
      preserveLineBreaks: true
    });
  };
  const expectedQuote = determineQuote(expected);
  const formatExpectedChar = char => {
    return inspectChar(char, {
      quote: expectedQuote,
      preserveLineBreaks: false
    });
  };
  const actualLength = actual.length;
  const expectedLength = expected.length;
  let i = 0;
  let lineIndex = 0;
  let columnIndex = 0;
  const lineStrings = actual.split(/\r?\n/);
  const lineNumbersOnTheLeft = lineStrings.length > 1;
  const formatDetails = ({
    annotationLabel,
    expectedOverview = true
  }) => {
    if (actual.includes("".concat(COLUMN_MARKER_CHAR, " unexpected character"))) {
      return {
        actual: inspect(actual, {
          preserveLineBreaks: true
        }),
        expected: inspect(expected, {
          preserveLineBreaks: true
        })
      };
    }
    let details = "";
    let lineDisplayed = 0;
    const idealNumberOfRowBefore = Math.ceil(MAX_WIDTH / 2);
    let columnStart = columnIndex - idealNumberOfRowBefore;
    if (columnStart < 0) {
      columnStart = 0;
    }
    let columnEnd = columnStart + MAX_WIDTH;
    const lastLineIndex = lineStrings.length - 1;
    const idealNumberOfLineAfter = MAX_HEIGHT - lineDisplayed;
    let lineAfterStart = lineIndex + 1;
    let lineAfterEnd = lineAfterStart + idealNumberOfLineAfter;
    if (lineAfterEnd > lineStrings.length) {
      lineAfterEnd = lineStrings.length;
    }
    const writeLine = index => {
      const lineSource = lineStrings[index];
      if (lineNumbersOnTheLeft) {
        let asideSource = "".concat(fillRight(index + 1, lineAfterEnd), " |");
        details += "".concat(asideSource, " ");
      }
      details += truncateLine(lineSource, {
        start: columnStart,
        end: columnEnd,
        prefix: "…",
        suffix: "…",
        format: (char, type) => {
          if (type === "char") {
            return formatActualChar(char);
          }
          return char;
        }
      });
    };
    {
      const idealNumberOfLineBefore = Math.ceil(MAX_HEIGHT / 2);
      let beforeLineStart = lineIndex - idealNumberOfLineBefore;
      if (beforeLineStart < 0) {
        beforeLineStart = 0;
      }
      const beforeLineEnd = lineIndex + 1;
      let beforeLineIndex = beforeLineStart;
      while (beforeLineIndex < beforeLineEnd) {
        writeLine(beforeLineIndex);
        beforeLineIndex++;
        details += "\n";
        lineDisplayed++;
      }
      details = details.slice(0, -1);
    }
    {
      let annotationColumn = columnStart === 0 ? columnIndex : columnIndex - columnStart;
      let annotationIndentation = "";
      if (lineNumbersOnTheLeft) {
        const spacesFromLineNumbers = "".concat(fillRight(lineIndex, lineAfterEnd), " | ").length;
        annotationIndentation += " ".repeat(spacesFromLineNumbers);
      }
      annotationIndentation += " ".repeat(annotationColumn);
      details += "\n".concat(annotationIndentation).concat(COLUMN_MARKER_CHAR);
      details += "\n".concat(annotationLabel);
      if (expectedOverview) {
        details += " ".concat(expectedQuote);
        // put expected chars
        let expectedIndex = i;
        let remainingCharsToDisplayOnExpected = EXPECTED_CONTINUES_WITH_MAX_LENGTH;
        while (remainingCharsToDisplayOnExpected-- && expectedIndex < expectedLength) {
          const expectedChar = expected[expectedIndex];
          if (expectedIndex > i && isLineBreak(expectedChar)) {
            break;
          }
          expectedIndex++;
          details += formatExpectedChar(expectedChar);
        }
        details += "".concat(expectedQuote);
        if (expectedIndex < expectedLength) {
          details += "…";
        }
      }
    }
    write_chars_after_annotation: {
      if (lineAfterStart > lastLineIndex) {
        break write_chars_after_annotation;
      }
      if (lineAfterStart === lineAfterEnd) {
        break write_chars_after_annotation;
      }
      details += "\n";
      let lineAfterIndex = lineAfterStart;
      while (lineAfterIndex < lineAfterEnd) {
        writeLine(lineAfterIndex);
        lineAfterIndex++;
        details += "\n";
        lineDisplayed++;
      }
      details = details.slice(0, -1);
    }
    return {
      details
    };
  };
  {
    while (i < actualLength && i < expectedLength) {
      const actualChar = actual[i];
      const expectedChar = expected[i];
      if (actualChar !== expectedChar) {
        let message = "unexpected character in ".concat(name);
        return createDetailedMessage(message, {
          ...formatDetails({
            annotationLabel: "unexpected ".concat(inspect(actualChar), ", expected to continue with")
          }),
          path
        });
      }
      if (isLineBreak(actualChar)) {
        lineIndex++;
        columnIndex = 0;
      } else {
        columnIndex++;
      }
      i++;
    }
  }
  {
    if (actualLength < expectedLength) {
      const missingCharacterCount = expectedLength - actualLength;
      let message = "".concat(name, " is too short");
      if (missingCharacterCount === 1) {
        message += ", one character is missing";
      } else {
        message += ", ".concat(missingCharacterCount, " characters are missing");
      }
      return createDetailedMessage(message, {
        ...formatDetails({
          annotationLabel: "expected to continue with"
        }),
        path
      });
    }
  }
  {
    i = expectedLength;
    const extraCharacterCount = actualLength - expectedLength;
    let message = "".concat(name, " is too long");
    if (extraCharacterCount === 1) {
      message += ", it contains one extra character";
    } else {
      message += ", it contains ".concat(extraCharacterCount, " extra characters");
    }
    let annotationLabel;
    if (expectedLength === 0) {
      annotationLabel = "an empty string was expected";
    } else {
      if (columnIndex === 0) {
        lineIndex--;
        columnIndex = lineStrings[lineIndex].length;
      } else {
        columnIndex--;
      }
      annotationLabel = "expected to end here, on ".concat(inspect(expected[expectedLength - 1]));
    }

    // const continuesWithLineBreak = isLineBreak(actual[expectedLength]);
    return createDetailedMessage(message, {
      ...formatDetails({
        annotationLabel,
        expectedOverview: false
      }),
      path
    });
  }
};
const truncateLine = (line, {
  start,
  end,
  prefix,
  suffix,
  format
}) => {
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
    return "".concat(format(prefix, "prefix")).concat(result).concat(format(suffix, "suffix"));
  }
  if (startTruncated) {
    return "".concat(format(prefix, "prefix")).concat(result);
  }
  if (endTruncated) {
    return "".concat(result).concat(format(suffix, "suffix"));
  }
  return result;
};
const fillRight = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  padded += value;
  while (missingWidth--) {
    padded += char;
  }
  return padded;
};
const isLineBreak = char => {
  return char === "\n" || char === "\r";
};
const stringNameFromComparison = comparison => {
  if (detectRegExpToStringComparison(comparison)) {
    return "regexp";
  }
  if (detectErrorMessageComparison(comparison)) {
    return "error message";
  }
  if (detectFunctionNameComparison(comparison)) {
    return "function name";
  }
  return "string";
};
const detectRegExpToStringComparison = comparison => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "to-string-return-value") {
    return false;
  }
  const grandParentComparison = parentComparison.parent;
  if (!isRegExp(grandParentComparison.actual) || !isRegExp(grandParentComparison.expected)) {
    return false;
  }
  return true;
};
const detectErrorMessageComparison = comparison => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") {
    return false;
  }
  if (parentComparison.data !== "message") {
    return false;
  }
  const grandParentComparison = parentComparison.parent;
  if (!isError(grandParentComparison.actual) || !isError(grandParentComparison.expected)) {
    return false;
  }
  return true;
};
const detectFunctionNameComparison = comparison => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") {
    return false;
  }
  if (parentComparison.data !== "name") {
    return false;
  }
  const grandParentComparison = parentComparison.parent;
  if (typeof grandParentComparison.actual !== "function" || typeof grandParentComparison.expected !== "function") {
    return false;
  }
  return true;
};

const betweenComparisonToMessage = comparison => {
  if (comparison.type !== "between") return undefined;
  const {
    actual,
    expected
  } = comparison;
  const {
    min,
    max
  } = expected;
  const path = comparisonToPath(comparison);

  // not a number
  if (typeof actual !== "number") {
    return createDetailedMessage("not a number", {
      found: inspect(actual),
      expected: "a number between ".concat(inspect(min), " and ").concat(inspect(max)),
      path
    });
  }
  // too small
  if (actual < min) {
    return createDetailedMessage("too small", {
      found: inspect(actual),
      expected: "between ".concat(inspect(min), " and ").concat(inspect(max)),
      path
    });
  }
  // too big
  return createDetailedMessage("too big", {
    found: inspect(actual),
    expected: "between ".concat(inspect(min), " and ").concat(inspect(max)),
    path
  });
};

const errorMessageFromComparison = comparison => {
  const failedComparison = deepestComparison(comparison);
  const errorMessageFromCandidates = firstFunctionReturningSomething([anyComparisonToErrorMessage, mapEntryComparisonToErrorMessage, notComparisonToErrorMessage, matchesRegExpToErrorMessage, prototypeComparisonToErrorMessage, referenceComparisonToErrorMessage, propertiesComparisonToErrorMessage, propertiesOrderComparisonToErrorMessage, symbolsComparisonToErrorMessage, symbolsOrderComparisonToErrorMessage, setSizeComparisonToMessage, arrayLengthComparisonToMessage, stringsComparisonToErrorMessage, betweenComparisonToMessage], failedComparison);
  return errorMessageFromCandidates || defaultComparisonToErrorMessage(failedComparison);
};
const deepestComparison = comparison => {
  let current = comparison;
  while (current) {
    const {
      children
    } = current;
    if (children.length === 0) break;
    current = children[children.length - 1];
  }
  return current;
};
const firstFunctionReturningSomething = (fnCandidates, failedComparison) => {
  let i = 0;
  while (i < fnCandidates.length) {
    const fnCandidate = fnCandidates[i];
    const returnValue = fnCandidate(failedComparison);
    if (returnValue !== null && returnValue !== undefined) {
      return returnValue;
    }
    i++;
  }
  return undefined;
};

const isAssertionError = value => value && typeof value === "object" && value.name === "AssertionError";
const createAssertionError = message => {
  const error = new Error(message);
  error.name = "AssertionError";
  return error;
};

const createAssert = () => {
  const assert = (...args) => {
    if (args.length === 0) {
      throw new Error("assert must be called with { actual, expected }, missing first argument");
    }
    if (args.length > 1) {
      throw new Error("assert must be called with { actual, expected }, received too many arguments");
    }
    const firstArg = args[0];
    if (typeof firstArg !== "object" || firstArg === null) {
      throw new Error("assert must be called with { actual, expected }, received ".concat(firstArg, " as first argument instead of object"));
    }
    if ("actual" in firstArg === false) {
      throw new Error("assert must be called with { actual, expected }, missing actual property on first argument");
    }
    if ("expected" in firstArg === false) {
      throw new Error("assert must be called with { actual, expected }, missing expected property on first argument");
    }
    const {
      actual,
      expected,
      message,
      // An other good alternative to "checkPropertiesOrder" could be
      // to have an helper like sortingProperties
      // const value = assert.sortProperties(value)
      // const expected = assert.sortProperties({ foo: true, bar: true })
      checkPropertiesOrder = true,
      details
    } = firstArg;
    const expectation = {
      actual,
      expected
    };
    const comparison = compare(expectation, {
      checkPropertiesOrder
    });
    if (comparison.failed) {
      let errorMessage = message || errorMessageFromComparison(comparison);
      errorMessage = appendDetails(errorMessage, details);
      const error = createAssertionError(errorMessage);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(error, assert);
      }
      throw error;
    }
  };
  assert.not = value => {
    return createNotExpectation(value);
  };
  assert.any = Constructor => {
    return createAnyExpectation(Constructor);
  };
  assert.matchesRegExp = regexp => {
    const isRegExp = regexp instanceof RegExp;
    if (!isRegExp) {
      throw new TypeError("assert.matchesRegExp must be called with a regexp, received ".concat(regexp));
    }
    return createMatchesRegExpExpectation(regexp);
  };
  assert.startsWith = string => {
    return createStartsWithExpectation(string);
  };
  assert.closeTo = value => {
    if (typeof value !== "number") {
      throw new TypeError("assert.closeTo must be called with a number, received ".concat(value));
    }
    return createCloseToExpectation(value);
  };
  assert.between = (minValue, maxValue) => {
    if (typeof minValue !== "number") {
      throw new TypeError("assert.between 1st argument must be number, received ".concat(minValue));
    }
    if (typeof maxValue !== "number") {
      throw new TypeError("assert.between 2nd argument must be number, received ".concat(maxValue));
    }
    if (minValue > maxValue) {
      throw new Error("assert.between 1st argument is > 2nd argument, ".concat(minValue, " > ").concat(maxValue));
    }
    return createBetweenExpectation(minValue, maxValue);
  };
  assert.asObjectWithoutPrototype = object => {
    const objectWithoutPrototype = Object.create(null);
    Object.assign(objectWithoutPrototype, object);
    return objectWithoutPrototype;
  };
  assert.isAssertionError = isAssertionError;
  assert.createAssertionError = createAssertionError;
  return assert;
};
const appendDetails = (message, details = {}) => {
  let string = "".concat(message);
  Object.keys(details).forEach(key => {
    const value = details[key];
    string += "\n--- ".concat(key, " ---\n").concat(Array.isArray(value) ? value.join("\n") : value);
  });
  return string;
};

const assert = createAssert();

export { assert };
