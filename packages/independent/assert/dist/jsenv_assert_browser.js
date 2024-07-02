function ansiRegex({
  onlyFirst = false
} = {}) {
  const pattern = ['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)', '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|');
  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

const regex = ansiRegex();
function stripAnsi(string) {
  if (typeof string !== 'string') {
    throw new TypeError("Expected a `string`, got `".concat(typeof string, "`"));
  }

  // Even though the regex is global, we don't need to reset the `.lastIndex`
  // because unlike `.exec()` and `.test()`, `.replace()` does it automatically
  // and doing it manually has a performance penalty.
  return string.replace(regex, '');
}

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";
const ANSI = {
  supported: true,
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  GREY: "\x1b[90m",
  color: (text, ANSI_COLOR) => {
    return ANSI_COLOR ? "".concat(ANSI_COLOR).concat(text).concat(RESET) : text;
  },
  BOLD: "\x1b[1m",
  UNDERLINE: "\x1b[4m",
  STRIKE: "\x1b[9m",
  effect: (text, ANSI_EFFECT) => {
    return ANSI_EFFECT ? "".concat(ANSI_EFFECT).concat(text).concat(RESET) : text;
  }
};

// see also https://github.com/sindresorhus/figures

const UNICODE = {
  supported: true,
  get COMMAND_RAW() {
    return "\u276F" ;
  },
  get OK_RAW() {
    return "\u2714" ;
  },
  get FAILURE_RAW() {
    return "\u2716" ;
  },
  get DEBUG_RAW() {
    return "\u25C6" ;
  },
  get INFO_RAW() {
    return "\u2139" ;
  },
  get WARNING_RAW() {
    return "\u26A0" ;
  },
  get CIRCLE_CROSS_RAW() {
    return "\u24E7" ;
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
    return "\u2026" ;
  }
};

const isComposite = value => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isValidPropertyIdentifier = propertyName => {
  return typeof propertyName === "number" || !isNaN(propertyName) || isDotNotationAllowed(propertyName);
};
const isDotNotationAllowed = propertyName => {
  return /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) || /^[a-z_$]$/i.test(propertyName);
};

const createValuePath = (parts = []) => {
  return {
    parts,
    [Symbol.iterator]() {
      return parts[Symbol.iterator]();
    },
    toString: () => parts.map(part => part.value).join(""),
    valueOf: () => parts.map(part => part.value).join(""),
    pop: () => {
      return createValuePath(parts.slice(1));
    },
    append: (property, {
      isIndexedEntry,
      isPropertyDescriptor,
      isMeta
    } = {}) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (isIndexedEntry) {
        propertyKey = "[".concat(property, "]");
      } else if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (
        // first "property" is a "global" variable name that does not need to be wrapped
        // in quotes
        parts.length === 0 || isDotNotationAllowed(property)) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = "\"".concat(property, "\""); // TODO: property escaping
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      if (parts.length === 0) {
        return createValuePath([{
          type: "identifier",
          value: propertyKey
        }]);
      }
      if (isPropertyDescriptor || isMeta) {
        return createValuePath([...parts, {
          type: "property_open_delimiter",
          value: "[["
        }, {
          type: "property_identifier",
          value: propertyKey
        }, {
          type: "property_close_delimiter",
          value: "]]"
        }]);
      }
      if (propertyKeyCanUseDot) {
        return createValuePath([...parts, {
          type: "property_dot",
          value: "."
        }, {
          type: "property_identifier",
          value: propertyKey
        }]);
      }
      return createValuePath([...parts, {
        type: "property_open_delimiter",
        value: "["
      }, {
        type: "property_identifier",
        value: propertyKey
      }, {
        type: "property_close_delimiter",
        value: "]"
      }]);
    }
  };
};
const humanizeSymbol = symbol => {
  const description = symbolToDescription$1(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return "Symbol.for(".concat(description, ")");
    }
    return "Symbol(".concat(description, ")");
  }
  return "Symbol()";
};
const symbolToDescription$1 = symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  // return symbol.description // does not work on node
};

const getObjectTag = obj => {
  // https://github.com/nodejs/node/blob/384fd1787634c13b3e5d2f225076d2175dc3b96b/lib/internal/util/inspect.js#L859
  while (obj || isUndetectableObject(obj)) {
    const constructorDescriptor = Object.getOwnPropertyDescriptor(obj, "constructor");
    if (constructorDescriptor !== undefined && typeof constructorDescriptor.value === "function" && constructorDescriptor.value.name !== "") {
      return String(constructorDescriptor.value.name);
    }
    const toStringTagDescriptor = Object.getOwnPropertyDescriptor(obj, Symbol.toStringTag);
    if (toStringTagDescriptor && typeof toStringTagDescriptor.value === "string") {
      return toStringTagDescriptor.value;
    }
    obj = Object.getPrototypeOf(obj);
    if (obj === null) {
      return "Object";
    }
  }
  return "";
};
function* objectPrototypeChainGenerator(obj) {
  while (obj === 0 || obj || isUndetectableObject(obj)) {
    const proto = Object.getPrototypeOf(obj);
    if (!proto) {
      break;
    }
    yield proto;
    obj = proto;
  }
}
const isUndetectableObject = v => typeof v === "undefined" && v !== undefined;

const tokenizeFunction = fn => {
  const fnSource = String(fn);
  {
    if (fnSource.startsWith("(")) {
      return {
        ...defaultFunctionAnalysis,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    const arrowAsyncMatch = fnSource.match(/^async\s+\(/);
    if (arrowAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true
      };
    }
  }
  {
    if (fnSource.startsWith("class ")) {
      let extendedClassName = "";
      const prototype = Object.getPrototypeOf(fn);
      if (prototype && prototype !== Function.prototype) {
        extendedClassName = prototype.name;
      }
      return {
        ...defaultFunctionAnalysis,
        type: "class",
        name: fn.name,
        extendedClassName,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("{"))
      };
    }
  }
  {
    const classicAsyncGeneratorMatch = fnSource.match(/^async\s+function\s*\*/);
    if (classicAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true,
        isGenerator: true
      };
    }
    const classicAsyncMatch = fnSource.match(/^async\s+function/);
    if (classicAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true
      };
    }
    const classicGeneratorMatch = fnSource.match(/^function\s*\*/);
    if (classicGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isGenerator: true
      };
    }
    if (fnSource.startsWith("function")) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
  }
  {
    if (fnSource.startsWith("get ")) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        getterName: fn.name.slice("get ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    if (fnSource.startsWith("set ")) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        setterName: fn.name.slice("set ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    const methodComputedAsyncGeneratorMatch = fnSource.match(/^async\s+\*\s*\[([\s\S]*?)\]\s*\(/);
    if (methodComputedAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedAsyncGeneratorMatch[0].length - 1),
        isAsync: true,
        isGenerator: true
      };
    }
    const methodComputedAsyncMatch = fnSource.match(/^async\s+\[([\s\S]*?)\]\s*\(/);
    if (methodComputedAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedAsyncMatch[0].length - 1),
        isAsync: true
      };
    }
    const methodComputedMatch = fnSource.match(/^\[([\s\S]*?)\]\s*\(/);
    if (methodComputedMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedMatch[0].length - 1)
      };
    }
    const methodAsyncGeneratorMatch = fnSource.match(/^async\s+\*\s*([\S]+)\s*\(/);
    if (methodAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodAsyncGeneratorMatch[0].length - 1),
        isAsync: true,
        isGenerator: true
      };
    }
    const methodAsyncMatch = fnSource.match(/^async\s+([\S]+)\s*\(/);
    if (methodAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodAsyncMatch[1],
        argsAndBodySource: fnSource.slice(methodAsyncMatch[0].length - 1),
        isAsync: true,
        methodAsyncMatch
      };
    }
    const methodGeneratorMatch = fnSource.match(/^\*\s*([\S]+)\s*\(/);
    if (methodGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodGeneratorMatch[0].length - 1),
        isGenerator: true
      };
    }
    const methodMatch = fnSource.match(/^([\S]+)\s*\(/);
    if (methodMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodMatch[1],
        argsAndBodySource: fnSource.slice(methodMatch[0].length - 1)
      };
    }
  }
  return defaultFunctionAnalysis;
};
const defaultFunctionAnalysis = {
  type: "",
  // "classic", "method", "arrow", "class"
  name: "",
  extendedClassName: "",
  methodNameIsComputed: false,
  methodName: "",
  getterName: "",
  setterName: "",
  isAsync: false,
  isGenerator: false,
  argsAndBodySource: ""
};

const tokenizeInteger = integerValue => {
  const integerAsString = String(integerValue);
  const exponentIndex = integerAsString.indexOf("e");
  if (exponentIndex === -1) {
    return {
      integer: integerAsString
    };
  }
  const digitsAsString = integerAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const afterExponent = integerAsString.slice(exponentIndex + 2); // "e" + "+"
  const numberOfTrailingZero = parseInt(afterExponent);
  let integer = "";
  integer = digitsInteger;
  integer += digitsDecimal;
  integer += afterExponent;
  integer += "0".repeat(numberOfTrailingZero);
  return {
    integer
  };
};

// see https://github.com/shrpne/from-exponential/blob/master/src/index.js
// https://github.com/shrpne/from-exponential/blob/master/test/index.test.js
const tokenizeFloat = floatValue => {
  const floatAsString = String(floatValue);
  const exponentIndex = floatAsString.indexOf("e");
  if (exponentIndex === -1) {
    return tokenizeNonExponentialFloat(floatValue);
  }
  let decimal = "";
  let numberOfLeadingZero;
  const digitsAsString = floatAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const decimalSeparator = digitsDecimal ? digitParts.decimalSeparator : ".";
  const afterExponent = floatAsString.slice(exponentIndex + 2); // "e" + "-"
  numberOfLeadingZero = parseInt(afterExponent);
  decimal += "0".repeat(numberOfLeadingZero);
  decimal += digitsInteger;
  decimal += digitsDecimal;
  return {
    integer: "0",
    decimalSeparator,
    decimal
  };
};
const tokenizeNonExponentialFloat = floatValue => {
  const floatString = String(floatValue);
  const integer = Math.floor(floatValue);
  const integerAsString = String(integer);
  const decimalSeparator = floatString[integerAsString.length];
  const decimal = floatString.slice(integerAsString.length + 1);
  return {
    integer: integerAsString,
    decimalSeparator,
    decimal
  };
};

// tokenizeFloat(1.2e-7);
// tokenizeFloat(2e-7);

const tokenizeUrlSearch = search => {
  // we don't use new URLSearchParams to preserve plus signs, see
  // see https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#preserving_plus_signs
  const params = search.slice(1).split("&");
  const paramsMap = new Map();
  for (const param of params) {
    let [urlSearchParamKey, urlSearchParamValue] = param.split("=");
    urlSearchParamKey = decodeURIComponent(urlSearchParamKey);
    urlSearchParamValue = decodeURIComponent(urlSearchParamValue);
    const existingUrlSearchParamValue = paramsMap.get(urlSearchParamKey);
    if (existingUrlSearchParamValue) {
      urlSearchParamValue = [...existingUrlSearchParamValue, urlSearchParamValue];
    } else {
      urlSearchParamValue = [urlSearchParamValue];
    }
    paramsMap.set(urlSearchParamKey, urlSearchParamValue);
  }
  return paramsMap;
};

// under some rare and odd circumstances firefox Object.is(-0, -0)
// returns false making test fail.
// it is 100% reproductible with big.test.js.
// However putting debugger or executing Object.is just before the
// comparison prevent Object.is failure.
// It makes me thing there is something strange inside firefox internals.
// All this to say avoid relying on Object.is to test if the value is -0
const getIsNegativeZero = value => {
  return typeof value === "number" && 1 / value === -Infinity;
};

const groupDigits = digitsAsString => {
  const digitCount = digitsAsString.length;
  if (digitCount < 4) {
    return digitsAsString;
  }
  let digitsWithSeparator = digitsAsString.slice(-3);
  let remainingDigits = digitsAsString.slice(0, -3);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-3);
    remainingDigits = remainingDigits.slice(0, -3);
    digitsWithSeparator = "".concat(group, "_").concat(digitsWithSeparator);
  }
  return digitsWithSeparator;
};

// canParseDate can be called on any string
// so we want to be sure it's a date before handling it as such
// And Date.parse is super permissive
// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// So we'll restrict permissivness
// A date like 1980/10/05 won't even be considered as a date

const canParseDate = value => {
  const dateParseResult = Date.parse(value);
  // eslint-disable-next-line no-self-compare
  if (dateParseResult !== dateParseResult) {
    return false;
  }
  // Iso format
  // "1995-12-04 00:12:00.000Z"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?([\+\-]\d{2}\:\d{2}|Z)?$/.test(value)) {
    return true;
  }

  // GMT format
  // "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
  if (/^[a-zA-Z]{0,4} [a-z-A-Z]{0,4} [0-9]{2} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT([\+\-][0-9]{0,4})?( \((.*)\))?$/.test(value)) {
    return true;
  }
  // other format
  // "Thu, 01 Jan 1970 00:00:00"
  if (/^[a-zA-Z]{3}, [0-9]{2} [a-zA-Z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value)) {
    return true;
  }
  return false;
};

/*
 * This file is named "scratch" as a testimony of the fact it has been
 * recoded from scratch around april 2024
 *
 * Nice to have:
 * - preact signals
 * - a DOM node should be converted to outerHTML right?
 * - ansi in browser
 * - Blob, FormData, DataView, ArrayBuffer
 * - count diff + displayed diff ( + display in message?)
 * - add or removed reason must be unique
 * - maintenir le format de date lorsqu'il est le meme dans actual/expect et favoriser celui de actual
 */


// ANSI.supported = false;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
/**
 * When a js value CANNOT EXISTS in actual or expect
 * the missing Node is set to PLACEHOLDER_FOR_NOTHING
 * For example,
 * - actual is a primitive, it cannot have properties
 * - expect is a composite, it can have properties
 * -> result into something like this
 * actual: true {
 *   <a>PLACEHOLDER_FOR_NOTHING
 * }
 * expect: {
 *   <a>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing",
  context: {}
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expect
 * the missing Node is set to PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * For example,
 * - actual has 2 properties: "a" and "b"
 * - expect has 2 propertie: "a" and "c"
 * -> result into something like this
 * actual: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>ownPropertyDescriptorEntry,
 *   <c>PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * },
 * expect: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
 *   <c>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed",
  context: {}
};
const PLACEHOLDER_FOR_SAME = {
  placeholder: "same",
  context: {}
};
const PLACEHOLDER_FOR_MODIFIED = {
  placeholder: "modified",
  context: {}
};
const ARRAY_EMPTY_VALUE = {
  tag: "array_empty_value"
};
const SOURCE_CODE_ENTRY_KEY = {
  key: "[[source code]]"
};
const VALUE_OF_RETURN_VALUE_ENTRY_KEY = {
  key: "valueOf()"
};
const SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY = {
  key: "Symbol.toPrimitive()"
};
const defaultOptions = {
  actual: undefined,
  expect: undefined,
  MAX_DEPTH: 5,
  MAX_DEPTH_INSIDE_DIFF: 1,
  MAX_DIFF_INSIDE_VALUE: {
    prop: 2,
    line: 1
  },
  MAX_CONTEXT_BEFORE_DIFF: {
    prop: 2,
    line: 3
  },
  MAX_CONTEXT_AFTER_DIFF: {
    prop: 2,
    line: 3
  },
  MAX_COLUMNS: 100,
  forceMultilineDiff: false,
  message: "",
  details: ""
};
const createAssert = ({
  colors = true,
  measureStringWidth = string => stripAnsi(string).length,
  tokenizeString = string => string.split(""),
  getWellKnownValuePath
} = {}) => {
  const setColor = (text, color) => {
    if (!assert.colors) {
      return text;
    }
    if (text.trim() === "") {
      // cannot set color of blank chars
      return text;
    }
    const textColored = ANSI.color(text, color);
    // if (color === ANSI.RED || color === ANSI.GREEN) {
    //   return ANSI.effect(textColored, ANSI.UNDERLINE);
    // }
    return textColored;
  };
  const assert = (firstArg, ...rest) => {
    if (firstArg === undefined) {
      throw new TypeError("assert must be called with { actual, expect }, it was called without any argument");
    }
    if (rest.length) {
      throw new TypeError("assert must be called with { actual, expect }, it was called with too many arguments");
    }
    if (firstArg === null || typeof firstArg !== "object") {
      throw new TypeError("assert must be called with { actual, expect }, received ".concat(firstArg, " as first argument instead of object"));
    }
    if (!Object.hasOwn(firstArg, "actual")) {
      throw new TypeError("assert must be called with { actual, expect }, actual is missing");
    }
    if (!Object.hasOwn(firstArg, "expect")) {
      throw new TypeError("assert must be called with { actual, expect }, expect is missing");
    }
    const unexpectedParamNames = Object.keys(firstArg).filter(key => !Object.hasOwn(defaultOptions, key));
    if (unexpectedParamNames.length > 0) {
      throw new TypeError("\"".concat(unexpectedParamNames.join(","), "\": there is no such param"));
    }
    const {
      actual,
      expect,
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_DIFF_INSIDE_VALUE,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS,
      forceMultilineDiff,
      message,
      details
    } = {
      ...defaultOptions,
      ...firstArg
    };
    // for test
    assert.localTimezoneOffset = new Date(0).getTimezoneOffset() * 60000;
    const sharedContext = {
      forceMultilineDiff,
      getWellKnownValuePath,
      tokenizeString,
      measureStringWidth,
      setColor,
      assert
    };
    const actualRootNode = createRootNode({
      context: {
        ...sharedContext,
        colorWhenSolo: addedColor,
        colorWhenSame: sameColor,
        colorWhenModified: unexpectColor,
        name: "actual",
        origin: "actual"
      },
      value: actual,
      // otherValue: expect,
      render: renderValue
    });
    const expectRootNode = createRootNode({
      context: {
        ...sharedContext,
        colorWhenSolo: removedColor,
        colorWhenSame: sameColor,
        colorWhenModified: expectColor,
        name: "expect",
        origin: "expect"
      },
      value: expect,
      // otherValue: actual,
      render: renderValue
    });
    const causeSet = new Set();

    /*
     * Comparison are objects used to compare actualNode and expectNode
     * It is used to visit all the entry a js value can have
     * and progressively create a tree of node and comparison
     * as the visit progresses a diff is generated
     * In the process an other type of object is used called *Entry
     * The following entry exists:
     * - ownPropertyDescriptorEntry
     * - ownPropertySymbolEntry
     * - indexedEntry
     *   - array values
     *   - typed array values
     *   - string values
     * - internalEntry
     *   - url internal props
     *   - valueOf()
     *   - Symbol.toPrimitive()
     *   - function body
     *   - map keys and values
     *   - ....
     * Entry represent something that can be found in the js value
     * and can be associated with one or many node (js_value)
     * For example ownPropertyDescriptorEntry have 3 nodes:
     *   ownPropertyNameNode
     *   descriptorKeyNode
     *   descriptorValueNode
     */
    let isNot = false;
    let allowRecompare = false;
    const compare = (actualNode, expectNode) => {
      if (actualNode.ignore && actualNode.comparison) {
        return actualNode.comparison;
      }
      if (expectNode.ignore && expectNode.comparison) {
        return expectNode.comparison;
      }
      const reasons = createReasons();
      const comparison = {
        actualNode,
        expectNode,
        reasons,
        done: false
      };
      if (!actualNode.placeholder) {
        actualNode.otherNode = expectNode;
      }
      if (!expectNode.placeholder) {
        expectNode.otherNode = actualNode;
      }
      const onSelfDiff = reason => {
        reasons.self.modified.add(reason);
        causeSet.add(comparison);
      };
      const onAdded = reason => {
        reasons.self.added.add(reason);
        causeSet.add(comparison);
      };
      const onRemoved = reason => {
        reasons.self.removed.add(reason);
        causeSet.add(comparison);
      };
      const subcompareDuo = (actualChildNode, expectChildNode, {
        revertNot,
        isRecomparison
      } = {}) => {
        let isNotPrevious = isNot;
        if (revertNot) {
          isNot = !isNot;
        }
        if (isRecomparison) {
          allowRecompare = true;
        }
        const childComparison = compare(actualChildNode, expectChildNode);
        isNot = isNotPrevious;
        appendReasonGroup(comparison.reasons.inside, childComparison.reasons.overall);
        return childComparison;
      };
      const subcompareSolo = (childNode, placeholderNode, compareOptions) => {
        if (childNode.context.name === "actual") {
          return subcompareDuo(childNode, placeholderNode, compareOptions);
        }
        return subcompareDuo(placeholderNode, childNode, compareOptions);
      };
      const subcompareChildrenDuo = (actualNode, expectNode) => {
        const isSetEntriesComparison = actualNode.subgroup === "set_entries" && expectNode.subgroup === "set_entries";
        const childComparisonMap = new Map();
        const childComparisonDiffMap = new Map();
        {
          const actualChildrenKeys = [];
          let actualFirstChildWithDiffKey;
          for (let [childKey, actualChildNode] of actualNode.childNodeMap) {
            let expectChildNode;
            if (isSetEntriesComparison) {
              const actualSetValueNode = actualChildNode;
              for (const [, expectSetValueNode] of expectNode.childNodeMap) {
                if (expectSetValueNode.value === actualSetValueNode.value) {
                  expectChildNode = expectSetValueNode;
                  break;
                }
              }
            } else {
              expectChildNode = expectNode.childNodeMap.get(childKey);
            }
            if (actualChildNode && expectChildNode) {
              const childComparison = subcompareDuo(actualChildNode, expectChildNode);
              childComparisonMap.set(childKey, childComparison);
              if (childComparison.hasAnyDiff) {
                childComparisonDiffMap.set(childKey, childComparison);
              }
              if (!actualChildNode.isHidden) {
                actualChildrenKeys.push(childKey);
                if (childComparison.hasAnyDiff && actualFirstChildWithDiffKey === undefined) {
                  actualFirstChildWithDiffKey = childKey;
                }
              }
              continue;
            }
            const addedChildComparison = subcompareSolo(actualChildNode, PLACEHOLDER_WHEN_ADDED_OR_REMOVED);
            childComparisonMap.set(childKey, addedChildComparison);
            childComparisonDiffMap.set(childKey, addedChildComparison);
            if (!actualChildNode.isHidden) {
              actualChildrenKeys.push(childKey);
              if (actualFirstChildWithDiffKey === undefined) {
                actualFirstChildWithDiffKey = childKey;
              }
            }
          }
          actualNode.childrenKeys = actualChildrenKeys;
          actualNode.firstChildWithDiffKey = actualFirstChildWithDiffKey;
        }
        {
          const expectChildrenKeys = [];
          let expectFirstChildWithDiffKey;
          for (let [childKey, expectChildNode] of expectNode.childNodeMap) {
            if (isSetEntriesComparison) {
              const expectSetValueNode = expectChildNode;
              let hasEntry;
              for (const [, actualSetValueNode] of actualNode.childNodeMap) {
                if (actualSetValueNode.value === expectSetValueNode.value) {
                  hasEntry = true;
                  break;
                }
              }
              if (hasEntry) {
                if (!expectChildNode.isHidden) {
                  expectChildrenKeys.push(childKey);
                }
                continue;
              }
            } else {
              const childComparison = childComparisonMap.get(childKey);
              if (childComparison) {
                if (!expectChildNode.isHidden) {
                  expectChildrenKeys.push(childKey);
                  if (childComparison.hasAnyDiff && expectFirstChildWithDiffKey === undefined) {
                    expectFirstChildWithDiffKey = childKey;
                  }
                }
                continue;
              }
            }
            const removedChildComparison = subcompareSolo(expectChildNode, PLACEHOLDER_WHEN_ADDED_OR_REMOVED);
            childComparisonMap.set(childKey, removedChildComparison);
            childComparisonDiffMap.set(childKey, removedChildComparison);
            if (!expectChildNode.isHidden) {
              expectChildrenKeys.push(childKey);
              if (expectFirstChildWithDiffKey === undefined) {
                expectFirstChildWithDiffKey = childKey;
              }
            }
          }
          expectNode.childrenKeys = expectChildrenKeys;
          expectNode.firstChildWithDiffKey = expectFirstChildWithDiffKey;
        }
        actualNode.childComparisonDiffMap = childComparisonDiffMap;
        expectNode.childComparisonDiffMap = childComparisonDiffMap;
      };
      const subcompareChildrenSolo = (node, placeholderNode) => {
        const childComparisonDiffMap = new Map();
        const childrenKeys = [];
        let firstChildWithDiffKey;
        for (const [childKey, childNode] of node.childNodeMap) {
          const soloChildComparison = subcompareSolo(childNode, placeholderNode);
          if (placeholderNode !== PLACEHOLDER_FOR_SAME) {
            childComparisonDiffMap.set(childKey, soloChildComparison);
          }
          if (!childNode.isHidden) {
            childrenKeys.push(childKey);
            if (placeholderNode !== PLACEHOLDER_FOR_SAME && firstChildWithDiffKey === undefined) {
              firstChildWithDiffKey = childKey;
            }
          }
        }
        node.childrenKeys = childrenKeys;
        node.firstChildWithDiffKey = firstChildWithDiffKey;
        node.childComparisonDiffMap = childComparisonDiffMap;
      };
      const visitDuo = (actualNode, expectNode) => {
        if (actualNode.comparison && !allowRecompare) {
          throw new Error("actualNode (".concat(actualNode.subgroup, ") already compared"));
        }
        actualNode.comparison = comparison;
        if (expectNode.comparison && !allowRecompare) {
          throw new Error("expectNode (".concat(expectNode.subgroup, ") already compared"));
        }
        expectNode.comparison = comparison;
        const {
          result,
          reason,
          propagate
        } = comparerDefault(actualNode, expectNode);
        if (result === "failure") {
          onSelfDiff(reason);
          if (propagate) {
            subcompareChildrenSolo(actualNode, propagate);
            subcompareChildrenSolo(expectNode, propagate);
            return;
          }
          subcompareChildrenDuo(actualNode, expectNode);
          return;
        }
        if (result === "success") {
          if (propagate) {
            const actualRender = actualNode.render;
            const expectRender = expectNode.render;
            actualNode.render = props => {
              actualNode.render = actualRender;
              // expectNode.render = expectRender;
              subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
              return actualRender(props);
            };
            expectNode.render = props => {
              // actualNode.render = actualRender;
              expectNode.render = expectRender;
              subcompareChildrenSolo(expectNode, PLACEHOLDER_FOR_SAME);
              return expectRender(props);
            };
            if (actualNode.isHiddenWhenSame) {
              actualNode.isHidden = true;
            }
            if (expectNode.isHiddenWhenSame) {
              expectNode.isHidden = true;
            }
            return;
          }
          subcompareChildrenDuo(actualNode, expectNode);
          return;
        }
        subcompareChildrenDuo(actualNode, expectNode);
        if (
        // is root comparison between numbers?
        actualNode.subgroup === "number_composition" && actualNode.parent.parent === null && expectNode.parent.parent === null) {
          const actualIntegerNode = actualNode.childNodeMap.get("integer");
          const expectIntegerNode = expectNode.childNodeMap.get("integer");
          if (actualIntegerNode && expectIntegerNode) {
            if (actualNode.parent.isInfinity === expectNode.parent.isInfinity) {
              const actualSignNode = actualNode.childNodeMap.get("sign");
              const expectSignNode = expectNode.childNodeMap.get("sign");
              let actualWidth = actualIntegerNode.value.length;
              let expectWidth = expectIntegerNode.value.length;
              if (actualSignNode) {
                actualWidth += "-".length;
              }
              if (expectSignNode) {
                expectWidth += "-".length;
              }
              const diff = Math.abs(expectWidth - actualWidth);
              if (diff < 10) {
                if (actualWidth < expectWidth) {
                  actualNode.startMarker = " ".repeat(expectWidth - actualWidth);
                } else if (actualWidth > expectWidth) {
                  expectNode.startMarker = " ".repeat(actualWidth - expectWidth);
                }
              }
            }
          }
        }
      };
      const visitSolo = (node, placeholderNode) => {
        if (node.comparison && !allowRecompare) {
          throw new Error("node (".concat(node.subgroup, ") already compared"));
        }
        node.comparison = comparison;
        if (node.isHiddenWhenSolo) {
          node.isHidden = true;
        }
        subcompareChildrenSolo(node, placeholderNode);
      };
      visit: {
        // custom comparison
        if (expectNode.customCompare && (actualNode.category === "primitive" || actualNode.category === "composite")) {
          expectNode.customCompare(actualNode, expectNode, {
            subcompareChildrenDuo,
            subcompareChildrenSolo,
            subcompareDuo,
            subcompareSolo,
            onSelfDiff
          });
          break visit;
        }
        if (actualNode.category === expectNode.category) {
          visitDuo(actualNode, expectNode);
          break visit;
        }
        // not found in expect (added or expect cannot have this type of value)
        if (actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED || actualNode === PLACEHOLDER_FOR_NOTHING) {
          visitSolo(expectNode, actualNode);
          onRemoved(getAddedOrRemovedReason(expectNode));
          break visit;
        }
        // not found in actual (removed or actual cannot have this type of value)
        if (expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED || expectNode === PLACEHOLDER_FOR_NOTHING) {
          visitSolo(actualNode, expectNode);
          onAdded(getAddedOrRemovedReason(actualNode));
          break visit;
        }
        // force actual to be same/modified
        if (actualNode === PLACEHOLDER_FOR_SAME || actualNode === PLACEHOLDER_FOR_MODIFIED) {
          visitSolo(expectNode, actualNode);
          break visit;
        }
        // force expect to be same/modified
        if (expectNode === PLACEHOLDER_FOR_SAME || expectNode === PLACEHOLDER_FOR_MODIFIED) {
          visitSolo(actualNode, expectNode);
          break visit;
        }

        // not same category
        onSelfDiff("should_be_".concat(expect.category));
        // primitive expect
        if (expectNode.category === "primitive" && actualNode.category === "composite") {
          const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
          if (actualAsPrimitiveNode) {
            subcompareDuo(actualAsPrimitiveNode, expectNode);
            actualAsPrimitiveNode.ignore = true;
            visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
            break visit;
          }
        }
        // composite expect
        else if (expectNode.category === "composite" && actualNode.category === "primitive") {
          const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
          if (expectAsPrimitiveNode) {
            subcompareDuo(actualNode, expectAsPrimitiveNode);
            expectAsPrimitiveNode.ignore = true;
            visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
            break visit;
          }
        }
        visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
        visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
      }
      const {
        self,
        inside,
        overall
      } = comparison.reasons;
      appendReasons(self.any, self.modified, self.removed, self.added);
      appendReasons(inside.any, inside.modified, inside.removed, inside.added);
      appendReasons(overall.removed, self.removed, inside.removed);
      appendReasons(overall.added, self.added, inside.added);
      appendReasons(overall.modified, self.modified, inside.modified);
      appendReasons(overall.any, self.any, inside.any);
      comparison.selfHasRemoval = self.removed.size > 0;
      comparison.selfHasAddition = self.added.size > 0;
      comparison.selfHasModification = self.modified.size > 0;
      comparison.hasAnyDiff = overall.any.size > 0;
      comparison.done = true;
      const updateNodeDiffType = (node, otherNode) => {
        if (node.diffType !== "") {
          return;
        }
        let diffType = "";
        if (otherNode === PLACEHOLDER_FOR_NOTHING) {
          diffType = "modified";
        } else if (otherNode === PLACEHOLDER_FOR_MODIFIED) {
          diffType = "modified";
        } else if (otherNode === PLACEHOLDER_FOR_SAME) {
          diffType = "same";
        } else if (otherNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
          diffType = "solo";
        } else if (comparison.selfHasModification) {
          diffType = "modified";
        } else {
          diffType = "same";
        }
        node.diffType = diffType;
        if (isNot) {
          node.color = node.context.colorWhenSame;
        } else {
          node.color = {
            solo: node.context.colorWhenSolo,
            modified: node.context.colorWhenModified,
            same: node.context.colorWhenSame
          }[diffType];
        }
      };
      updateNodeDiffType(actualNode, expectNode);
      updateNodeDiffType(expectNode, actualNode);
      if (comparison.reasons.overall.any.size === 0) {
        if (actualNode.isHiddenWhenSame) {
          actualNode.isHidden = true;
        }
        if (expectNode.isHiddenWhenSame) {
          expectNode.isHidden = true;
        }
      }
      if (actualNode.subgroup === "line_entries" && expectNode.subgroup === "line_entries") {
        const actualIsMultiline = actualNode.childNodeMap.size > 1;
        const expectIsMultiline = expectNode.childNodeMap.size > 1;
        if (actualIsMultiline && !expectIsMultiline) {
          enableMultilineDiff(expectNode);
        } else if (!actualIsMultiline && expectIsMultiline) {
          enableMultilineDiff(actualNode);
        } else if (!actualIsMultiline && !expectIsMultiline) {
          forceSameQuotes(actualNode, expectNode);
        }
      }
      if (actualNode.subgroup === "url_parts" && expectNode.subgroup === "url_parts") {
        forceSameQuotes(actualNode, expectNode);
      }
      return comparison;
    };
    const rootComparison = compare(actualRootNode, expectRootNode);
    if (!rootComparison.hasAnyDiff) {
      return;
    }
    let diff = "";
    const infos = [];
    let actualStartNode;
    let expectStartNode;
    start_on_max_depth: {
      if (rootComparison.selfHasModification) {
        actualStartNode = actualRootNode;
        expectStartNode = expectRootNode;
        break start_on_max_depth;
      }
      const getStartNode = rootNode => {
        let topMostNodeWithDiff = null;
        for (const comparisonWithDiff of causeSet) {
          const node = comparisonWithDiff[rootNode.context.name === "actual" ? "actualNode" : "expectNode"];
          if (!topMostNodeWithDiff || node.depth < topMostNodeWithDiff.depth) {
            topMostNodeWithDiff = node;
          }
        }
        if (topMostNodeWithDiff.depth < MAX_DEPTH) {
          return rootNode;
        }
        let currentNode = topMostNodeWithDiff;
        let startDepth = topMostNodeWithDiff.depth - MAX_DEPTH;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const parentNode = currentNode.parent;
          if (!parentNode) {
            return rootNode;
          }
          if (!parentNode.isContainer && parentNode.depth === startDepth) {
            return parentNode;
          }
          currentNode = parentNode;
        }
      };
      actualStartNode = getStartNode(actualRootNode);
      expectStartNode = getStartNode(expectRootNode);
      if (actualStartNode !== actualRootNode && expectStartNode !== expectRootNode) {
        const actualStartNodePath = actualStartNode.path.toString();
        const expectStartNodePath = expectStartNode.path.toString();
        if (actualStartNodePath === expectStartNodePath) {
          infos.push("diff starts at ".concat(setColor(actualStartNodePath, ANSI.YELLOW)));
        } else {
          infos.push("actual diff starts at ".concat(setColor(actualStartNodePath, ANSI.YELLOW)));
          infos.push("expect diff starts at ".concat(setColor(expectStartNodePath, ANSI.YELLOW)));
        }
      } else if (actualStartNode !== actualRootNode) {
        infos.push("actual diff starts at ".concat(setColor(actualStartNode.path, ANSI.YELLOW)));
      } else if (expectStartNode !== expectRootNode) {
        infos.push("expect diff starts at ".concat(setColor(expectStartNode.path, ANSI.YELLOW)));
      }
    }
    if (infos.length) {
      for (const info of infos) {
        diff += "".concat(UNICODE.INFO, " ").concat(info);
        diff += "\n";
      }
      diff += "\n";
    }
    diff += setColor("actual:", sameColor);
    diff += " ";
    diff += actualStartNode.render({
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_DIFF_INSIDE_VALUE,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS,
      columnsRemaining: MAX_COLUMNS - "actual: ".length,
      startNode: actualStartNode
    });
    diff += "\n";
    diff += setColor("expect:", sameColor);
    diff += " ";
    diff += expectStartNode.render({
      MAX_DEPTH,
      MAX_DEPTH_INSIDE_DIFF,
      MAX_DIFF_INSIDE_VALUE,
      MAX_CONTEXT_BEFORE_DIFF,
      MAX_CONTEXT_AFTER_DIFF,
      MAX_COLUMNS,
      columnsRemaining: MAX_COLUMNS - "expect: ".length,
      startNode: expectStartNode
    });
    if (details) {
      diff += "\n";
      diff += "--- details ---";
      diff += "\n";
      diff += JSON.stringify(details);
      diff += "\n";
      diff += "---------------";
    }
    let errorMessage = "";
    if (message) {
      errorMessage += message;
      errorMessage += "\n";
      errorMessage += diff;
    } else {
      errorMessage += "\n";
      errorMessage += diff;
    }
    const assertionError = assert.createAssertionError(errorMessage);
    Object.defineProperty(assertionError, "diff", {
      configurable: true,
      writable: true,
      value: diff
    });
    if (Error.captureStackTrace) {
      Error.captureStackTrace(assertionError, assert);
    }
    throw assertionError;
  };
  assert.colors = colors;
  assert.createAssertionError = message => {
    const error = new Error(message);
    error.name = "AssertionError";
    return error;
  };
  assert.isAssertionError = value => {
    if (!value) return false;
    if (typeof value !== "object") return false;
    if (value.name === "AssertionError") return true;
    if (value.name.includes("AssertionError")) return true;
    return false;
  };
  assert.belowOrEquals = (value, options) => {
    if (typeof value !== "number") {
      throw new TypeError("assert.belowOrEquals 1st argument must be number, received ".concat(value));
    }
    return createAssertMethodCustomExpectation("belowOrEquals", [{
      value,
      customCompare: createValueCustomCompare(actualNode => {
        if (!actualNode.isNumber) {
          return "should_be_a_number";
        }
        if (actualNode.value > value) {
          return "should_be_below_or_equals_to_".concat(value);
        }
        return null;
      })
    }], options);
  };
  assert.aboveOrEquals = (value, options) => {
    if (typeof value !== "number") {
      throw new TypeError("assert.aboveOrEquals 1st argument must be number, received ".concat(value));
    }
    return createAssertMethodCustomExpectation("aboveOrEquals", [{
      value,
      customCompare: createValueCustomCompare(actualNode => {
        if (!actualNode.isNumber) {
          return "should_be_a_number";
        }
        if (actualNode.value < value) {
          return "should_be_greater_or_equals_to_".concat(value);
        }
        return null;
      })
    }], options);
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
    return createAssertMethodCustomExpectation("between", [{
      value: assert.aboveOrEquals(minValue, {
        renderOnlyArgs: true
      })
    }, {
      value: assert.belowOrEquals(maxValue, {
        renderOnlyArgs: true,
        isRecomparison: true
      })
    }]);
  };
  assert.not = value => {
    return createAssertMethodCustomExpectation("not", [{
      value
    }], {
      customCompare: createAssertMethodCustomCompare((actualNode, expectFirsArgValueNode, {
        subcompareDuo,
        onSelfDiff
      }) => {
        const expectFirstArgComparison = subcompareDuo(actualNode, expectFirsArgValueNode, {
          revertNot: true
        });
        if (expectFirstArgComparison.hasAnyDiff) {
          // we should also "revert" side effects of all diff inside expectAsNode
          // - adding to causeSet
          // - colors (should be done during comparison)
          return PLACEHOLDER_FOR_SAME;
        }
        onSelfDiff("sould_have_diff");
        return PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
      })
    });
  };
  assert.any = constructor => {
    if (typeof constructor !== "function") {
      throw new TypeError("assert.any 1st argument must be a function, received ".concat(constructor));
    }
    const constructorName = constructor.name;
    return createAssertMethodCustomExpectation("any", [{
      value: constructor,
      customCompare: createValueCustomCompare(constructorName ? actualNode => {
        for (const proto of objectPrototypeChainGenerator(actualNode.value)) {
          const protoConstructor = proto.constructor;
          if (protoConstructor.name === constructorName) {
            return null;
          }
        }
        return "should_have_constructor_".concat(constructorName);
      } : actualNode => {
        for (const proto of objectPrototypeChainGenerator(actualNode.value)) {
          const protoConstructor = proto.constructor;
          if (protoConstructor === constructor) {
            return null;
          }
        }
        return "should_have_constructor_".concat(constructor.toString());
      })
    }]);
  };
  assert.startsWith = string => {
    if (typeof string !== "string") {
      throw new TypeError("assert.startsWith 1st argument must be a string, received ".concat(string));
    }
    return createAssertMethodCustomExpectation("startsWith", [{
      value: string,
      customCompare: createValueCustomCompare(actualNode => {
        if (!actualNode.isString) {
          return "should_be_a_string";
        }
        const actual = actualNode.value;
        if (!actual.startsWith(string)) {
          return "should_start_with_".concat(string);
        }
        return null;
      })
    }]);
  };
  assert.closeTo = (float, precision = 2) => {
    if (typeof float !== "number") {
      throw new TypeError("assert.closeTo 1st argument must be a number, received ".concat(float));
    }
    return createAssertMethodCustomExpectation("closeTo", [{
      value: float,
      customCompare: createValueCustomCompare(actualNode => {
        if (!actualNode.isNumber) {
          return "should_be_a_number";
        }
        const actual = actualNode.value;
        if (actual === Infinity && float === Infinity) {
          return null;
        }
        if (actual === -Infinity && float === -Infinity) {
          return null;
        }
        const expectedDiff = Math.pow(10, -precision) / 2;
        const receivedDiff = Math.abs(float - actual);
        if (receivedDiff > expectedDiff) {
          return "should_be_close_to_".concat(float);
        }
        return null;
      })
    }]);
  };
  assert.matches = regexp => {
    if (typeof regexp !== "object") {
      throw new TypeError("assert.matches 1st argument must be a regex, received ".concat(regexp));
    }
    return createAssertMethodCustomExpectation("matches", [{
      value: regexp,
      customCompare: createValueCustomCompare(actualNode => {
        if (!actualNode.isString) {
          return "should_be_a_string";
        }
        const actual = actualNode.value;
        if (!regexp.test(actual)) {
          return "should_match_".concat(regexp);
        }
        return null;
      })
    }]);
  };
  return assert;
};
const comparerDefault = (actualNode, expectNode) => {
  if (actualNode.category === "primitive" || actualNode.category === "line_parts" || actualNode.category === "date_parts" || actualNode.category === "url_parts" || actualNode.category === "header_value_parts") {
    if (actualNode.value === expectNode.value && actualNode.isNegativeZero === expectNode.isNegativeZero) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME
      };
    }
    if (actualNode.category === "primitive") {
      return {
        result: "failure",
        reason: "primitive_value",
        // Some primitive have children to render (like numbers)
        // when comparison a boolean and a number for instance
        // all number children will be colored in yellow because
        // they have no counterparts as boolean node
        // What we want instead is to color the number children in red/green
        propagate: typeof actualNode.value === typeof expectNode.value ? null : PLACEHOLDER_FOR_MODIFIED
      };
    }
    return {
      result: ""
    };
  }
  if (actualNode.category === "composite") {
    if (actualNode.value === expectNode.value) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME
      };
    }
    return {
      result: ""
    };
  }
  if (actualNode.category === "reference") {
    const actualRefPathString = actualNode.value.pop().toString();
    const expectRefPathString = expectNode.value.pop().toString();
    if (actualRefPathString !== expectRefPathString) {
      return {
        result: "failure",
        reason: "ref_path",
        propagate: PLACEHOLDER_FOR_MODIFIED
      };
    }
    return {
      result: "success",
      propagate: PLACEHOLDER_FOR_SAME
    };
  }
  if (actualNode.category === "entries") {
    if (actualNode.multilineDiff && expectNode.multilineDiff && actualNode.multilineDiff.hasMarkersWhenEmpty !== expectNode.multilineDiff.hasMarkersWhenEmpty) {
      actualNode.multilineDiff.hasMarkersWhenEmpty = expectNode.multilineDiff.hasMarkersWhenEmpty = true;
    }
    if (actualNode.onelineDiff && expectNode.onelineDiff && actualNode.onelineDiff.hasMarkersWhenEmpty !== expectNode.onelineDiff.hasMarkersWhenEmpty) {
      actualNode.onelineDiff.hasMarkersWhenEmpty = expectNode.onelineDiff.hasMarkersWhenEmpty = true;
    }
    return {
      result: ""
    };
  }
  return {
    result: ""
  };
};
const customExpectationSymbol = Symbol.for("jsenv_assert_custom_expectation");
const createCustomExpectation = (name, props) => {
  return {
    [Symbol.toStringTag]: name,
    [customExpectationSymbol]: true,
    group: "custom_expectation",
    subgroup: name,
    ...props
  };
};
const createAssertMethodCustomExpectation = (methodName, args, {
  isRecomparison,
  customCompare = createAssertMethodCustomCompare((actualNode, expectArgValueNode, {
    subcompareDuo
  }) => {
    const expectArgComparison = subcompareDuo(actualNode, expectArgValueNode, {
      isRecomparison
    });
    if (expectArgComparison.hasAnyDiff) {
      return PLACEHOLDER_FOR_MODIFIED;
    }
    return PLACEHOLDER_FOR_SAME;
  }),
  renderOnlyArgs
} = {}) => {
  return createCustomExpectation("assert.".concat(methodName), {
    parse: node => {
      node.childGenerator = () => {
        node.appendChild("assert_method_call", createMethodCallNode(node, {
          objectName: "assert",
          methodName,
          args,
          renderOnlyArgs
        }));
      };
    },
    customCompare,
    render: (node, props) => {
      let diff = "";
      const assertMethodCallNode = node.childNodeMap.get("assert_method_call");
      if (renderOnlyArgs) {
        const argEntriesNode = assertMethodCallNode.childNodeMap.get("args");
        argEntriesNode.startMarker = "";
        argEntriesNode.endMarker = "";
        diff += argEntriesNode.render(props);
      } else {
        diff += assertMethodCallNode.render(props);
      }
      return diff;
    }
  });
};
const createValueCustomCompare = customComparer => {
  return (actualNode, expectNode, {
    onSelfDiff,
    subcompareChildrenSolo
  }) => {
    const selfDiff = customComparer(actualNode, expectNode);
    if (selfDiff) {
      onSelfDiff(selfDiff);
      subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_MODIFIED);
      return;
    }
    subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
  };
};
const createAssertMethodCustomCompare = (customComparer, {
  argsCanBeComparedInParallel
} = {}) => {
  return (actualNode, expectNode, options) => {
    // prettier-ignore
    const assertMethod = expectNode.childNodeMap.get("assert_method_call");
    const argEntriesNode = assertMethod.childNodeMap.get("args");
    const childNodeKeys = Array.from(argEntriesNode.childNodeMap.keys());
    if (childNodeKeys.length === 0) {
      return;
    }
    if (childNodeKeys.length === 1) {
      const expectFirsArgValueNode = argEntriesNode.childNodeMap.get(0);
      expectFirsArgValueNode.ignore = true;
      const customComparerResult = customComparer(actualNode, expectFirsArgValueNode, options);
      options.subcompareSolo(expectNode, customComparerResult);
      return;
    }
    const argIterator = argEntriesNode.childNodeMap[Symbol.iterator]();
    function* argValueGenerator() {
      let argIteratorResult;
      while (argIteratorResult = argIterator.next()) {
        if (argIteratorResult.done) {
          break;
        }
        yield argIteratorResult.value[1];
      }
    }
    let result = PLACEHOLDER_FOR_SAME;
    for (const argValueNode of argValueGenerator()) {
      argValueNode.ignore = true;
      const customComparerResult = customComparer(actualNode, argValueNode, options);
      if (customComparerResult === PLACEHOLDER_FOR_SAME) {
        continue;
      }
      result = customComparerResult;
      if (argsCanBeComparedInParallel) {
        continue;
      }
      for (const remainingArgValueNode of argValueGenerator()) {
        remainingArgValueNode.ignore = true;
        options.subcompareSolo(customComparerResult, remainingArgValueNode);
      }
      break;
    }
    options.subcompareSolo(expectNode, result);
    return;
  };
};
let createRootNode;
/*
 * Node represent any js value.
 * These js value are compared and converted to a readable string
 * Node art part of a tree structure (parent/children) and contains many
 * information about the value such as
 * - Is it a primitive or a composite?
 * - Where does the value come from?
 *   - property key
 *   - property value
 *   - prototype value returned by Object.getPrototypeOf()
 *   - a map entry key
 * - And finally info useful to render the js value into a readable string
 */
{
  createRootNode = ({
    context,
    value,
    render
  }) => {
    /*
     * Il est possible pour actual de ref des valeurs de expect et inversement tel que
     * - Object.prototype
     * - Un ancetre commun
     * - Peu importe en fait
     * Il est aussi possible de découvrir une ref dans l'un plus tot que dans l'autre
     * (l'ordre des prop des object n'est pas garanti nottament)
     * Pour cette raison il y a un referenceMap par arbre (actual/expect)
     * Au final on regardera juste le path ou se trouve une ref pour savoir si elle sont les meme
     *
     * Une ref peut etre découverte apres
     * - ordre des props
     * - caché par maxColumns
     * - caché par MAX_ENTRY_BEFORE_MULTILINE_DIFF
     * - ...
     * Et que la découverte lazy des child (childGenerator) ne garantie pas de trouver la ref
     * des le départ
     * ALORS
     * On ne peut pas utiliser la notation suivante:
     * actual: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     * expect: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     *
     * on va lui préférer:
     * actual: {
     *   a: { toto: true },
     *   b: actual.a,
     * }
     * expect: {
     *   a: { toto: true },
     *   b: expect.a,
     * }
     */

    const referenceMap = new Map();
    let nodeId = 1;
    const rootNode = createNode({
      context,
      id: nodeId,
      group: "root",
      value,
      parent: null,
      depth: 0,
      path: createValuePath([{
        type: "identifier",
        value: context.name
      }]),
      render,
      referenceMap,
      nextId: () => {
        nodeId++;
        return nodeId;
      }
    });
    return rootNode;
  };
  const createNode = ({
    context,
    group,
    subgroup = group,
    category = group,
    value,
    key,
    parent,
    referenceMap,
    nextId,
    depth,
    path,
    childGenerator,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    isRegexpSource = false,
    isStringForUrl = false,
    isStringForDate = false,
    isBody = false,
    customCompare,
    render,
    isHidden = false,
    isHiddenWhenSame = false,
    isHiddenWhenSolo = false,
    focusedChildIndex,
    startMarker = "",
    endMarker = "",
    quoteMarkerRef,
    separatorMarker = "",
    separatorMarkerDisabled = false,
    separatorMarkerWhenTruncated,
    hasLeftSpacingDisabled = false,
    hasRightSpacingDisabled = false,
    quotesDisabled = false,
    quotesBacktickDisabled = false,
    numericSeparatorsDisabled = false,
    lineNumbersDisabled = false,
    urlStringDetectionDisabled = false,
    dateStringDetectionDisabled = false,
    preserveLineBreaks = false,
    renderOptions = renderOptionsDefault,
    onelineDiff = null,
    multilineDiff = null,
    stringDiffPrecision = "per_line_and_per_char"
  }) => {
    const node = {
      context,
      value,
      key,
      group,
      subgroup,
      category,
      childGenerator,
      childNodeMap: null,
      appendChild: (childKey, params) => appendChildNodeGeneric(node, childKey, params),
      wrappedNodeGetter: () => {},
      parent,
      reference: null,
      referenceMap,
      nextId,
      depth,
      path,
      isSourceCode,
      isClassPrototype,
      isRegexpSource,
      isStringForUrl,
      isStringForDate,
      isBody,
      // info
      isCustomExpectation: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isNumber: false,
      isNegativeZero: false,
      isInfinity: false,
      isNaN: false,
      isBigInt: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      objectTag: "",
      isArray: false,
      isTypedArray: false,
      isMap: false,
      isSet: false,
      isURL: false,
      isURLSearchParams: false,
      isHeaders: false,
      isDate: false,
      isError: false,
      isRegExp: false,
      isPromise: false,
      isRequest: false,
      isResponse: false,
      isAbortController: false,
      isAbortSignal: false,
      isStringObject: false,
      referenceFromOthersSet: referenceFromOthersSetDefault,
      // render info
      render: props => render(node, props),
      isHidden,
      isHiddenWhenSame,
      isHiddenWhenSolo,
      focusedChildIndex,
      beforeRender: null,
      // START will be set by comparison
      customCompare,
      ignore: false,
      comparison: null,
      childComparisonDiffMap: null,
      childrenKeys: null,
      childrenRenderRange: null,
      firstChildWithDiffKey: undefined,
      rangeToDisplay: null,
      displayedRange: null,
      diffType: "",
      otherNode: null,
      // END will be set by comparison
      startMarker,
      endMarker,
      quoteMarkerRef,
      separatorMarker,
      separatorMarkerDisabled,
      separatorMarkerWhenTruncated,
      hasLeftSpacingDisabled,
      hasRightSpacingDisabled,
      renderOptions,
      onelineDiff,
      multilineDiff,
      color: ""
    };
    {
      const childNodeMap = new Map();
      let childrenGenerated = false;
      const generateChildren = () => {
        if (childrenGenerated) {
          return;
        }
        childrenGenerated = true;
        if (!node.childGenerator) {
          return;
        }
        node.childGenerator(node);
        node.childGenerator = null;
      };
      node.childNodeMap = new Proxy(childNodeMap, {
        has: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          let value = Reflect.has(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
        get: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          if (prop === "size") {
            return target[prop];
          }
          let value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    }
    Object.preventExtensions(node);
    if (value && value[customExpectationSymbol]) {
      const {
        parse,
        render,
        customCompare,
        group,
        subgroup
      } = value;
      node.isCustomExpectation = true;
      if (parse) {
        parse(node);
      }
      node.customCompare = customCompare;
      node.render = props => render(node, props);
      node.group = group;
      node.subgroup = subgroup;
      return node;
    }
    if (category === "reference") {
      return node;
    }
    if (value === SOURCE_CODE_ENTRY_KEY || value === VALUE_OF_RETURN_VALUE_ENTRY_KEY || value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (group === "entries") {
      return node;
    }
    if (group === "entry") {
      return node;
    }
    // if (group === "part") {
    //   return node;
    // }
    if (subgroup === "array_entry_key" || subgroup === "arg_entry_key") {
      node.category = "primitive";
      node.isNumber = true;
      return node;
    }
    if (subgroup === "char_entry_value") {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (subgroup === "url_search_entry") {
      node.category = "composite";
      return node;
    }
    if (value === null) {
      node.category = "primitive";
      return node;
    }
    if (value === undefined) {
      node.category = "primitive";
      node.isUndefined = true;
      return node;
    }
    const typeofResult = typeof value;
    if (typeofResult === "number") {
      node.category = "primitive";
      node.isNumber = true;
      if (getIsNegativeZero(value)) {
        node.isNegativeZero = true;
      }
      // eslint-disable-next-line no-self-compare
      if (value !== value) {
        node.isNaN = true;
      }
      if (value === Infinity || value === -Infinity) {
        node.isInfinity = true;
      }
      node.childGenerator = () => {
        const numberCompositionNode = node.appendChild("composition", {
          value,
          render: renderChildren,
          onelineDiff: {},
          startMarker: node.startMarker,
          endMarker: node.endMarker,
          group: "entries",
          subgroup: "number_composition",
          childGenerator: () => {
            if (node.isNaN) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "NaN"
              });
              return;
            }
            if (node.isNegativeZero || Math.sign(value) === -1) {
              numberCompositionNode.appendChild("sign", {
                ...getGrammarProps(),
                group: "number_sign",
                value: "-"
              });
            }
            if (node.isNegativeZero) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "0"
              });
              return;
            }
            if (node.isInfinity) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "Infinity"
              });
              return;
            }
            // integer
            if (value % 1 === 0) {
              const {
                integer
              } = tokenizeInteger(Math.abs(value));
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: numericSeparatorsDisabled ? integer : groupDigits(integer)
              });
              return;
            }
            // float
            const {
              integer,
              decimalSeparator,
              decimal
            } = tokenizeFloat(Math.abs(value));
            numberCompositionNode.appendChild("integer", {
              ...getGrammarProps(),
              group: "integer",
              value: numericSeparatorsDisabled ? integer : groupDigits(integer),
              separatorMarker: decimalSeparator
            });
            numberCompositionNode.appendChild("decimal", {
              ...getGrammarProps(),
              group: "decimal",
              value: numericSeparatorsDisabled ? decimal : groupDigits(decimal)
            });
          }
        });
      };
      return node;
    }
    if (typeofResult === "bigint") {
      node.category = "primitive";
      node.isBigInt = true;
      return node;
    }
    if (typeofResult === "string") {
      node.category = "primitive";
      node.isString = true;
      if (!quoteMarkerRef && !quotesDisabled) {
        node.quoteMarkerRef = quoteMarkerRef = {
          current: pickBestQuote(value, {
            quotesBacktickDisabled
          })
        };
      }
      if (!isStringForUrl && !urlStringDetectionDisabled && canParseUrl(value)) {
        node.isStringForUrl = isStringForUrl = true;
      }
      if (isStringForUrl) {
        node.childGenerator = () => {
          const urlObject = new URL(value);
          const urlPartsNode = node.appendChild("parts", {
            value,
            category: "url_parts",
            group: "entries",
            subgroup: "url_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…"
              }
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator() {
              const {
                protocol,
                username,
                password,
                hostname,
                port,
                pathname,
                search,
                hash
              } = urlObject;
              const appendUrlPartNode = (name, value, params) => {
                urlPartsNode.appendChild(name, {
                  value,
                  render: renderValue,
                  urlStringDetectionDisabled: true,
                  preserveLineBreaks: true,
                  quoteMarkerRef,
                  quotesDisabled: true,
                  group: "url_part",
                  subgroup: "url_".concat(name),
                  ...params
                });
              };
              appendUrlPartNode("protocol", protocol, {
                endMarker: "//"
              });
              if (username) {
                appendUrlPartNode("username", decodeURIComponent(username), {
                  endMarker: password ? ":" : "@"
                });
                if (password) {
                  appendUrlPartNode("password", decodeURIComponent(password), {
                    endMarker: "@"
                  });
                }
              }
              appendUrlPartNode("hostname", decodeURIComponent(hostname));
              if (port) {
                appendUrlPartNode("port", parseInt(port), {
                  startMarker: ":",
                  numericSeparatorsDisabled: true
                });
              }
              if (pathname) {
                appendUrlPartNode("pathname", decodeURIComponent(pathname));
              }
              if (search) {
                const urlSearchNode = urlPartsNode.appendChild("search", {
                  value: null,
                  render: renderChildren,
                  startMarker: "?",
                  onelineDiff: {
                    hasTrailingSeparator: true
                  },
                  group: "entries",
                  subgroup: "url_search",
                  childGenerator() {
                    const searchParamsMap = tokenizeUrlSearch(search);
                    let searchEntryIndex = 0;
                    for (const [key, values] of searchParamsMap) {
                      const urlSearchEntryNode = urlSearchNode.appendChild(key, {
                        key: searchEntryIndex,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        path: node.path.append(key),
                        group: "entries",
                        subgroup: "url_search_entry",
                        childGenerator() {
                          let valueIndex = 0;
                          const isMultiValue = values.length > 1;
                          while (valueIndex < values.length) {
                            const urlSearchEntryPartNode = urlSearchEntryNode.appendChild(valueIndex, {
                              key,
                              render: renderChildren,
                              onelineDiff: {
                                hasTrailingSeparator: true
                              },
                              group: "entry",
                              subgroup: "url_search_value_entry",
                              path: isMultiValue ? urlSearchEntryNode.path.append(valueIndex, {
                                isIndexedEntry: true
                              }) : undefined
                            });
                            urlSearchEntryPartNode.appendChild("entry_key", {
                              value: key,
                              render: renderString,
                              stringDiffPrecision: "none",
                              startMarker: urlSearchEntryNode.key === 0 && valueIndex === 0 ? "" : "&",
                              separatorMarker: "=",
                              separatorMarkerWhenTruncated: "",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              urlStringDetectionDisabled: true,
                              dateStringDetectionDisabled: true,
                              preserveLineBreaks: true,
                              group: "entry_key",
                              subgroup: "url_search_entry_key"
                            });
                            urlSearchEntryPartNode.appendChild("entry_value", {
                              value: values[valueIndex],
                              render: renderString,
                              stringDiffPrecision: "none",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              urlStringDetectionDisabled: true,
                              dateStringDetectionDisabled: true,
                              preserveLineBreaks: true,
                              group: "entry_value",
                              subgroup: "url_search_entry_value"
                            });
                            valueIndex++;
                          }
                        }
                      });
                      searchEntryIndex++;
                    }
                  }
                });
              }
              if (hash) {
                appendUrlPartNode("hash", decodeURIComponent(hash));
              }
            }
          });
        };
        return node;
      }
      if (!isStringForDate && !dateStringDetectionDisabled && canParseDate(value)) {
        node.isStringForDate = isStringForDate = true;
      }
      if (isStringForDate) {
        node.childGenerator = () => {
          const dateString = value;
          const dateTimestamp = Date.parse(dateString);
          const dateObject = new Date(dateTimestamp + node.context.assert.localTimezoneOffset);
          const datePartsNode = node.appendChild("parts", {
            value,
            category: "date_parts",
            group: "entries",
            subgroup: "date_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…"
              }
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator: () => {
              const appendDatePartNode = (name, value, params) => {
                datePartsNode.appendChild(name, {
                  value,
                  render: renderValue,
                  quoteMarkerRef,
                  quotesDisabled: true,
                  dateStringDetectionDisabled: true,
                  numericSeparatorsDisabled: true,
                  preserveLineBreaks: true,
                  group: "date_part",
                  subgroup: "date_".concat(name),
                  ...params
                });
              };
              appendDatePartNode("year", dateObject.getFullYear());
              appendDatePartNode("month", String(dateObject.getMonth() + 1).padStart(2, "0"), {
                startMarker: "-"
              });
              appendDatePartNode("day", String(dateObject.getDate()).padStart(2, "0"), {
                startMarker: "-"
              });
              const timePartsNode = datePartsNode.appendChild("time", {
                render: renderChildren,
                onelineDiff: {},
                group: "entries",
                subgroup: "date_time",
                isHiddenWhenSame: true,
                childGenerator: () => {
                  const appendTimePartNode = (name, value, params) => {
                    timePartsNode.appendChild(name, {
                      value,
                      render: renderString,
                      stringDiffPrecision: "none",
                      quoteMarkerRef,
                      quotesDisabled: true,
                      dateStringDetectionDisabled: true,
                      numericSeparatorsDisabled: true,
                      preserveLineBreaks: true,
                      group: "time_prop",
                      subgroup: "time_".concat(name),
                      ...params
                    });
                  };
                  appendTimePartNode("hours", String(dateObject.getHours()).padStart(2, "0"), {
                    startMarker: " "
                  });
                  appendTimePartNode("minutes", String(dateObject.getMinutes()).padStart(2, "0"), {
                    startMarker: ":"
                  });
                  appendTimePartNode("seconds", String(dateObject.getSeconds()).padStart(2, "0"), {
                    startMarker: ":"
                  });
                  appendTimePartNode("milliseconds", String(dateObject.getMilliseconds()).padStart(3, "0"), {
                    startMarker: ".",
                    endMarker: "Z",
                    isHiddenWhenSame: true
                  });
                }
              });
            }
          });
        };
        return node;
      }
      if (stringDiffPrecision === "per_line_and_per_char") {
        node.childGenerator = () => {
          const lineEntriesNode = node.appendChild("parts", {
            value,
            category: "line_parts",
            group: "entries",
            subgroup: "line_entries",
            render: renderChildrenMultiline,
            multilineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: ["↑ 1 line ↑", "↑ {x} lines ↑"],
                between: ["↕ 1 line ↕", "↕ {x} lines ↕"],
                end: ["↓ 1 line ↓", "↓ {x} lines ↓"]
              },
              maxDiffType: "line",
              lineNumbersDisabled
            },
            startMarker: node.startMarker,
            endMarker: node.endMarker,
            quoteMarkerRef,
            childGenerator: () => {
              let isMultiline = node.context.forceMultilineDiff;
              const appendLineEntry = lineIndex => {
                const lineNode = lineEntriesNode.appendChild(lineIndex, {
                  value: "",
                  key: lineIndex,
                  render: renderChildren,
                  onelineDiff: {
                    focusedChildWhenSame: "first",
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    },
                    skippedMarkersPlacement: isMultiline ? "inside" : "outside",
                    childrenVisitMethod: "all_before_then_all_after"
                  },
                  // When multiline string appear as property value
                  // 1. It becomes hard to see if "," is part of the string or the separator
                  // 2. "," would appear twice if multiline string ends with ","
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,,
                  //   bar: true,
                  // }
                  // Fortunately the line break already helps to split properties (foo and bar)
                  // so the following is readable
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,
                  //   bar: true,
                  // }
                  // -> The separator is not present for multiline
                  group: "entries",
                  subgroup: "line_entry_value"
                });
                const appendCharNode = (charIndex, char) => {
                  lineNode.value += char; // just for debug purposes
                  lineNode.appendChild(charIndex, {
                    value: char,
                    render: renderChar,
                    renderOptions: isRegexpSource ? {
                      stringCharMapping: null
                    } : undefined,
                    quoteMarkerRef,
                    group: "entry_value",
                    subgroup: "char_entry_value"
                  });
                };
                return {
                  node: lineNode,
                  appendCharNode
                };
              };
              const chars = node.context.tokenizeString(value);
              let currentLineEntry = appendLineEntry(0);
              let lineIndex = 0;
              let charIndex = 0;
              for (const char of chars) {
                if (preserveLineBreaks || char !== "\n") {
                  currentLineEntry.appendCharNode(charIndex, char);
                  charIndex++;
                  continue;
                }
                isMultiline = true;
                lineIndex++;
                charIndex = 0;
                currentLineEntry = appendLineEntry(lineIndex);
              }
              if (isMultiline) {
                enableMultilineDiff(lineEntriesNode);
              } else {
                const firstLineNode = currentLineEntry.node;
                if (!quotesDisabled && quoteMarkerRef.current) {
                  firstLineNode.onelineDiff.hasMarkersWhenEmpty = true;
                  firstLineNode.startMarker = firstLineNode.endMarker = quoteMarkerRef.current;
                }
              }
            }
          });
        };
        return node;
      }
      if (!quotesDisabled) {
        node.startMarker = quoteMarkerRef.current;
        node.endMarker = quoteMarkerRef.current;
      }
      return node;
    }
    if (typeofResult === "symbol") {
      node.category = "primitive";
      node.isSymbol = true;
      node.childGenerator = () => {
        const wellKnownPath = node.context.getWellKnownValuePath(value);
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value
                });
                index++;
              }
            }
          });
          return;
        }
        const symbolKey = Symbol.keyFor(value);
        if (symbolKey) {
          node.appendChild("symbol_construct", createMethodCallNode(node, {
            objectName: "Symbol",
            methodName: "for",
            args: [{
              value: symbolKey
            }]
          }));
          return;
        }
        const description = symbolToDescription(value);
        node.appendChild("symbol_construct", createMethodCallNode(node, {
          objectName: "Symbol",
          args: description ? [{
            value: symbolToDescription(value)
          }] : []
        }));
      };
      return node;
    }
    const isObject = typeofResult === "object";
    const isFunction = typeofResult === "function";
    if (isObject || isFunction) {
      node.category = "composite";
      node.referenceFromOthersSet = new Set();
      const reference = node.referenceMap.get(value);
      if (reference) {
        node.reference = reference;
        reference.referenceFromOthersSet.add(node);
      } else {
        node.referenceMap.set(value, node);
      }
      if (isFunction) {
        node.isFunction = true;
        node.functionAnalysis = tokenizeFunction(value);
      }
      for (const proto of objectPrototypeChainGenerator(value)) {
        const parentConstructor = proto.constructor;
        if (!parentConstructor) {
          continue;
        }
        if (parentConstructor.name === "Map") {
          node.isMap = true;
          continue;
        }
        if (parentConstructor.name === "Array") {
          node.isArray = true;
          continue;
        }
        if (parentConstructor.name === "Set") {
          node.isSet = true;
          continue;
        }
        if (parentConstructor.name === "URL") {
          node.isURL = true;
          continue;
        }
        if (parentConstructor.name === "URLSearchParams") {
          node.isURLSearchParams = true;
          continue;
        }
        if (parentConstructor.name === "Headers") {
          node.isHeaders = true;
          continue;
        }
        if (parentConstructor.name === "Date") {
          node.isDate = true;
          continue;
        }
        if (parentConstructor.name === "RegExp") {
          node.isRegExp = true;
          continue;
        }
        if (parentConstructor.name === "Promise") {
          node.isPromise = true;
          continue;
        }
        if (parentConstructor.name === "Request") {
          node.isRequest = true;
          continue;
        }
        if (parentConstructor.name === "Response") {
          node.isResponse = true;
          continue;
        }
        if (parentConstructor.name === "AbortController") {
          node.isAbortController = true;
          continue;
        }
        if (parentConstructor.name === "AbortSignal") {
          node.isAbortSignal = true;
          continue;
        }
        if (parentConstructor.name === "String") {
          node.isStringObject = true;
          continue;
        }
        if (
        // "Int8Array",
        // "Uint8Array",
        // "Uint8ClampedArray",
        // "Int16Array",
        // "Uint16Array",
        // "Int32Array",
        // "Uint32Array",
        // "Float32Array",
        // "Float64Array",
        // "BigInt64Array",
        // "BigUint64Array",
        parentConstructor.name === "TypedArray") {
          node.isTypedArray = true;
          continue;
        }
        if (parentConstructor.name === "Error") {
          node.isError = true;
          continue;
        }
      }
      let isFrozen = false;
      let isSealed = false;
      let isExtensible = true;
      if (Object.isFrozen(value)) {
        isFrozen = true;
      } else if (Object.isSealed(value)) {
        isSealed = true;
      } else if (!Object.isExtensible(value)) {
        isExtensible = false;
      }
      const wellKnownPath = node.context.getWellKnownValuePath(value);
      if (node.reference || wellKnownPath || node.isFunction || isFunctionPrototype) ; else {
        node.objectTag = getObjectTag(value);
      }
      node.childGenerator = function () {
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value
                });
                index++;
              }
            }
          });
          return;
        }
        if (node.reference) {
          const referenceNode = node.appendChild("reference", {
            value: node.reference.path,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "reference",
            group: "entries",
            subgroup: "reference",
            childGenerator() {
              let index = 0;
              for (const path of node.reference.path) {
                referenceNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: path.value
                });
                index++;
              }
            }
          });
          return;
        }
        const compositePartsNode = node.appendChild("parts", {
          category: "composite_parts",
          render: renderChildren,
          onelineDiff: {
            hasSpacingBetweenEachChild: true,
            hasTrailingSeparator: true
          },
          childGenerator: () => {
            const ownPropertyNameToIgnoreSet = new Set();
            const ownPropertSymbolToIgnoreSet = new Set();
            const propertyLikeCallbackSet = new Set();
            const propertyConverterMap = new Map();
            const objectIntegrityMethodName = isFrozen ? "freeze" : isSealed ? "seal" : isExtensible ? "" : "preventExtensions";
            if (objectIntegrityMethodName) {
              const objectIntegrityNode = compositePartsNode.appendChild("object_integrity", {
                value: null,
                render: renderChildren,
                onelineDiff: {
                  hasTrailingSeparator: true
                },
                hasRightSpacingDisabled: true,
                group: "entries",
                subgroup: "object_integrity",
                childGenerator: () => {
                  objectIntegrityNode.appendChild("object_name", {
                    ...getGrammarProps(),
                    value: "Object",
                    separatorMarker: "."
                  });
                  objectIntegrityNode.appendChild("method_name", {
                    ...getGrammarProps(),
                    value: objectIntegrityMethodName,
                    separatorMarker: "("
                  });
                }
              });
            }
            let objectConstructNode = null;
            let objectConstructArgs = null;
            construct: {
              if (node.isFunction) {
                ownPropertyNameToIgnoreSet.add("length");
                ownPropertyNameToIgnoreSet.add("name");
                const functionConstructNode = compositePartsNode.appendChild("construct", {
                  value: null,
                  render: renderChildren,
                  onelineDiff: {
                    hasSpacingBetweenEachChild: true
                  },
                  group: "entries",
                  subgroup: "function_construct",
                  childGenerator() {
                    if (node.functionAnalysis.type === "class") {
                      functionConstructNode.appendChild("class_keyword", {
                        ...getGrammarProps(),
                        group: "class_keyword",
                        value: "class"
                      });
                      if (node.functionAnalysis.name) {
                        functionConstructNode.appendChild("function_name", {
                          ...getGrammarProps(),
                          group: "function_name",
                          value: node.functionAnalysis.name
                        });
                      }
                      const extendedClassName = node.functionAnalysis.extendedClassName;
                      if (extendedClassName) {
                        functionConstructNode.appendChild("class_extends_keyword", {
                          ...getGrammarProps(),
                          group: "class_extends_keyword",
                          value: "extends"
                        });
                        functionConstructNode.appendChild("class_extended_name", {
                          ...getGrammarProps(),
                          group: "class_extended_name",
                          value: extendedClassName
                        });
                      }
                      return;
                    }
                    if (node.functionAnalysis.isAsync) {
                      functionConstructNode.appendChild("function_async_keyword", {
                        ...getGrammarProps(),
                        group: "function_async_keyword",
                        value: "async"
                      });
                    }
                    if (node.functionAnalysis.type === "classic") {
                      functionConstructNode.appendChild("function_keyword", {
                        ...getGrammarProps(),
                        group: "function_keyword",
                        value: node.functionAnalysis.isGenerator ? "function*" : "function"
                      });
                    }
                    if (node.functionAnalysis.name) {
                      functionConstructNode.appendChild("function_name", {
                        ...getGrammarProps(),
                        group: "function_name",
                        value: node.functionAnalysis.name
                      });
                    }
                    {
                      const appendFunctionBodyPrefix = prefix => {
                        functionConstructNode.appendChild("function_body_prefix", {
                          ...getGrammarProps(),
                          group: "function_body_prefix",
                          value: prefix
                        });
                      };
                      if (node.functionAnalysis.type === "arrow") {
                        appendFunctionBodyPrefix("() =>");
                      } else if (node.functionAnalysis.type === "method") {
                        let methodName;
                        if (node.subgroup === "property_descriptor_value") {
                          methodName = node.parent.parent.key;
                        } else {
                          methodName = key;
                        }
                        if (node.functionAnalysis.getterName) {
                          appendFunctionBodyPrefix("get ".concat(methodName, "()"));
                        } else if (node.functionAnalysis.setterName) {
                          appendFunctionBodyPrefix("set ".concat(methodName, "()"));
                        } else {
                          appendFunctionBodyPrefix("".concat(methodName, "()"));
                        }
                      } else if (node.functionAnalysis.type === "classic") {
                        appendFunctionBodyPrefix("()");
                      }
                    }
                  }
                });
                break construct;
              }
              if (isFunctionPrototype) {
                break construct;
              }
              if (node.isError) {
                ownPropertyNameToIgnoreSet.add("stack");
                const messageOwnPropertyDescriptor = Object.getOwnPropertyDescriptor(value, "message");
                if (messageOwnPropertyDescriptor) {
                  ownPropertyNameToIgnoreSet.add("message");
                }
                const errorConstructNode = compositePartsNode.appendChild("construct", {
                  value: null,
                  render: renderChildren,
                  onelineDiff: {},
                  group: "entries",
                  subgroup: "error_construct",
                  childGenerator: () => {
                    errorConstructNode.appendChild("error_constructor", {
                      ...getGrammarProps(),
                      value: node.objectTag,
                      separatorMarker: ": "
                    });
                    if (messageOwnPropertyDescriptor) {
                      const errorMessage = messageOwnPropertyDescriptor.value;
                      errorConstructNode.appendChild("error_message", {
                        render: renderString,
                        group: "error_message",
                        value: errorMessage,
                        lineNumbersDisabled: true,
                        quotesDisabled: true
                      });
                    }
                  }
                });
                break construct;
              }
              if (node.isRegExp) {
                let regexpSource = value.source;
                if (regexpSource === "(?:)") {
                  regexpSource = "";
                }
                regexpSource = "/".concat(regexpSource, "/").concat(value.flags);
                compositePartsNode.appendChild("construct", {
                  value: regexpSource,
                  render: renderValue,
                  isRegexpSource: true,
                  quotesDisabled: true,
                  group: "regexp_source",
                  subgroup: "regexp_source"
                });
                break construct;
              }
              if (node.objectTag && node.objectTag !== "Object" && node.objectTag !== "Array") {
                objectConstructNode = compositePartsNode.appendChild("construct", {
                  group: "entries",
                  subgroup: "object_construct",
                  value: null,
                  render: renderChildren,
                  onelineDiff: {
                    hasSpacingBetweenEachChild: true
                  },
                  childGenerator() {
                    if (objectConstructArgs) {
                      objectConstructNode.appendChild("call", createMethodCallNode(objectConstructNode, {
                        objectName: node.objectTag,
                        args: objectConstructArgs
                      }));
                    } else {
                      objectConstructNode.appendChild("object_tag", {
                        ...getGrammarProps(),
                        group: "object_tag",
                        path: node.path.append("[[ObjectTag]]"),
                        value: node.objectTag
                      });
                    }
                  }
                });
                break construct;
              }
            }
            wrapped_value: {
              // toString()
              if (node.isURL) {
                objectConstructArgs = [{
                  value: value.href,
                  key: "toString()",
                  isStringForUrl: true
                }];
                break wrapped_value;
              }
              if (node.isDate) {
                objectConstructArgs = [{
                  value: value.toString(),
                  key: "toString()",
                  isStringForDate: true
                }];
                break wrapped_value;
              }
              if (node.isRequest) {
                const requestDefaultValues = {
                  body: null,
                  bodyUsed: false,
                  cache: "default",
                  credentials: "same-origin",
                  destination: "",
                  headers: undefined,
                  method: "GET",
                  mode: "cors",
                  priority: undefined,
                  redirect: "follow",
                  referrerPolicy: "",
                  referrer: "about:client",
                  signal: null
                };
                const requestInitOptions = {};
                let hasCustomInit = false;
                for (const requestInternalPropertyName of Object.keys(requestDefaultValues)) {
                  const requestInternalPropertyValue = value[requestInternalPropertyName];
                  if (requestInternalPropertyName === "headers") {
                    let headersAreEmpty = true;
                    // eslint-disable-next-line no-unused-vars
                    for (const entry of requestInternalPropertyValue) {
                      headersAreEmpty = false;
                      break;
                    }
                    if (headersAreEmpty) {
                      continue;
                    }
                  } else if (requestInternalPropertyName === "signal") {
                    if (!requestInternalPropertyValue.aborted) {
                      continue;
                    }
                  } else {
                    const requestInternalPropertyDefaultValue = requestDefaultValues[requestInternalPropertyName];
                    if (requestInternalPropertyValue === requestInternalPropertyDefaultValue) {
                      continue;
                    }
                  }
                  hasCustomInit = true;
                  requestInitOptions[requestInternalPropertyName] = requestInternalPropertyValue;
                }
                objectConstructArgs = [{
                  value: value.url,
                  key: "url"
                }, ...(hasCustomInit ? [{
                  value: requestInitOptions
                }] : [])];
                break wrapped_value;
              }
              if (node.isResponse) {
                const responseInitOptions = {};
                const bodyUsed = value.bodyUsed;
                if (bodyUsed) {
                  responseInitOptions.bodyUsed = true;
                }
                const headers = value.headers;
                let headersAreEmpty = true;
                // eslint-disable-next-line no-unused-vars
                for (const entry of headers) {
                  headersAreEmpty = false;
                  break;
                }
                if (!headersAreEmpty) {
                  responseInitOptions.headers = headers;
                }
                const status = value.status;
                responseInitOptions.status = status;
                const statusText = value.statusText;
                if (statusText !== "") {
                  responseInitOptions.statusText = statusText;
                }
                const url = value.url;
                if (url) {
                  responseInitOptions.url = url;
                }
                const type = value.type;
                if (type !== "default") {
                  responseInitOptions.type = type;
                }
                const redirected = value.redirected;
                if (redirected) {
                  responseInitOptions.redirected = redirected;
                }
                objectConstructArgs = [{
                  value: value.body,
                  key: "body",
                  isBody: true
                }, ...(Object.keys(responseInitOptions).length ? [{
                  value: responseInitOptions
                }] : [])];
                break wrapped_value;
              }
              // valueOf()
              const valueOf = value.valueOf;
              if (typeof valueOf === "function" && valueOf !== Object.prototype.valueOf) {
                if (objectConstructNode) {
                  ownPropertyNameToIgnoreSet.add("valueOf");
                  objectConstructArgs = [{
                    value: valueOf.call(value),
                    key: "valueOf()"
                  }];
                  break wrapped_value;
                }
                if (Object.hasOwn(value, "valueOf")) {
                  propertyConverterMap.set("valueOf", () => {
                    return [VALUE_OF_RETURN_VALUE_ENTRY_KEY, valueOf.call(value)];
                  });
                } else {
                  propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                    appendPropertyEntryNode(VALUE_OF_RETURN_VALUE_ENTRY_KEY, valueOf.call(value));
                  });
                }
                break wrapped_value;
              }
            }
            symbol_to_primitive: {
              const toPrimitive = value[Symbol.toPrimitive];
              if (typeof toPrimitive !== "function") {
                break symbol_to_primitive;
              }
              if (node.isDate && toPrimitive === Date.prototype[Symbol.toPrimitive]) {
                break symbol_to_primitive;
              }
              if (objectConstructNode && !objectConstructArgs) {
                ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
                objectConstructArgs = [{
                  value: toPrimitive.call(value, "string"),
                  key: "toPrimitive()"
                }];
              } else if (Object.hasOwn(value, Symbol.toPrimitive)) {
                propertyConverterMap.set(Symbol.toPrimitive, () => {
                  return [SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY, toPrimitive.call(value, "string")];
                });
              } else {
                propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                  appendPropertyEntryNode(SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY, toPrimitive.call(value, "string"));
                });
              }
            }
            internal_entries: {
              const internalEntriesParams = {
                render: renderChildrenMultilineWhenDiff,
                startMarker: "(",
                endMarker: ")",
                onelineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasSpacingBetweenEachChild: true
                },
                multilineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasTrailingSeparator: true,
                  hasNewLineAroundChildren: true,
                  hasIndentBeforeEachChild: true,
                  skippedMarkers: {
                    start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                    between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                    end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                  },
                  maxDiffType: "prop"
                },
                hasLeftSpacingDisabled: true,
                group: "entries"
              };
              if (node.isMap) {
                const mapEntriesNode = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "map_entries",
                  childGenerator: () => {
                    const objectTagCounterMap = new Map();
                    for (const [mapEntryKey, mapEntryValue] of value) {
                      let pathPart;
                      if (isComposite(mapEntryKey)) {
                        const keyObjectTag = getObjectTag(mapEntryKey);
                        if (objectTagCounterMap.has(keyObjectTag)) {
                          const objectTagCount = objectTagCounterMap.get(keyObjectTag) + 1;
                          objectTagCounterMap.set(keyObjectTag, objectTagCount);
                          pathPart = "".concat(keyObjectTag, "#").concat(objectTagCount);
                        } else {
                          objectTagCounterMap.set(keyObjectTag, 1);
                          pathPart = "".concat(keyObjectTag, "#1");
                        }
                      } else {
                        pathPart = String(mapEntryKey);
                      }
                      const mapEntryNode = mapEntriesNode.appendChild(mapEntryKey, {
                        key: mapEntryKey,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "map_entry",
                        path: node.path.append(pathPart)
                      });
                      mapEntryNode.appendChild("entry_key", {
                        value: mapEntryKey,
                        render: renderValue,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "map_entry_key"
                      });
                      mapEntryNode.appendChild("entry_value", {
                        value: mapEntryValue,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "map_entry_value"
                      });
                    }
                    objectTagCounterMap.clear();
                  }
                });
                break internal_entries;
              }
              if (node.isSet) {
                const setEntriesNode = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "set_entries",
                  childGenerator: () => {
                    let index = 0;
                    for (const [setValue] of value) {
                      setEntriesNode.appendChild(index, {
                        value: setValue,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "set_entry",
                        path: setEntriesNode.path.append(index, {
                          isIndexedEntry: true
                        })
                      });
                      index++;
                    }
                  }
                });
                break internal_entries;
              }
              if (node.isURLSearchParams) {
                const searchParamsMap = new Map();
                for (let [urlSearchParamKey, urlSearchParamValue] of value) {
                  const existingUrlSearchParamValue = searchParamsMap.get(urlSearchParamKey);
                  if (existingUrlSearchParamValue) {
                    urlSearchParamValue = [...existingUrlSearchParamValue, urlSearchParamValue];
                  } else {
                    urlSearchParamValue = [urlSearchParamValue];
                  }
                  searchParamsMap.set(urlSearchParamKey, urlSearchParamValue);
                }
                const urlSearchParamEntries = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "url_search_params_entries",
                  childGenerator: () => {
                    for (const [key, values] of searchParamsMap) {
                      const urlSearchParamEntryNode = urlSearchParamEntries.appendChild(key, {
                        key,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "url_search_param_entry",
                        path: node.path.append(key)
                      });
                      urlSearchParamEntryNode.appendChild("entry_key", {
                        value: key,
                        render: renderValue,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "url_search_param_entry_key"
                      });
                      urlSearchParamEntryNode.appendChild("entry_value", {
                        value: values,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "url_search_param_entry_value"
                      });
                    }
                  }
                });
                break internal_entries;
              }
              if (node.isHeaders) {
                const headerEntriesNode = compositePartsNode.appendChild("header_entries", {
                  ...internalEntriesParams,
                  subgroup: "header_entries",
                  childGenerator: () => {
                    for (const [headerName, headerValueRaw] of value) {
                      const headerNode = headerEntriesNode.appendChild(key, {
                        key: headerName,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "header_entry",
                        path: node.path.append(headerName)
                      });
                      headerNode.appendChild("entry_key", {
                        value: headerName,
                        render: renderString,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "header_entry_key"
                      });
                      const quoteMarkerRef = {
                        current: pickBestQuote(headerValueRaw)
                      };
                      if (["access-control-max-age", "age", "content-length"].includes(headerName)) {
                        headerNode.appendChild("entry_value", {
                          group: "entry_value",
                          subgroup: "header_entry_value",
                          value: isNaN(headerValueRaw) ? headerValueRaw : parseInt(headerValueRaw),
                          render: renderValue,
                          startMarker: "\"",
                          endMarker: '"',
                          numericSeparatorsDisabled: true
                        });
                        return;
                      }
                      let attributeHandlers = null;
                      if (headerName === "set-cookie") {
                        attributeHandlers = {};
                      } else if (headerName === "accept" || headerName === "accept-encoding" || headerName === "accept-language") {
                        attributeHandlers = {
                          q: attributeValue => {
                            return isNaN(attributeValue) ? attributeValue : parseFloat(attributeValue);
                          }
                        };
                      } else if (headerName === "server-timing") {
                        attributeHandlers = {
                          dur: attributeValue => {
                            return isNaN(attributeValue) ? attributeValue : parseFloat(attributeValue);
                          }
                        };
                      }
                      if (attributeHandlers) {
                        const headerValueNode = headerNode.appendChild("entry_value", {
                          category: "header_value_parts",
                          group: "entries",
                          subgroup: "header_value",
                          value: headerValueRaw,
                          render: renderChildren,
                          onelineDiff: {
                            skippedMarkers: {
                              start: "…",
                              between: "…",
                              end: "…"
                            }
                          },
                          startMarker: quoteMarkerRef.current,
                          endMarker: quoteMarkerRef.current,
                          childGenerator: () => {
                            generateHeaderValueParts(headerValueRaw, {
                              headerValueNode,
                              quoteMarkerRef
                            });
                          }
                        });
                        return;
                      }
                      const headerValueArray = headerValueRaw.split(",");
                      const headerValueNode = headerNode.appendChild("entry_value", {
                        value: headerValueArray,
                        render: renderChildren,
                        onelineDiff: {
                          skippedMarkers: {
                            start: "…",
                            between: "…",
                            end: "…"
                          }
                        },
                        startMarker: quoteMarkerRef.current,
                        endMarker: quoteMarkerRef.current,
                        separatorMarker: ",",
                        childGenerator: () => {
                          let index = 0;
                          for (const headerValue of headerValueArray) {
                            headerValueNode.appendChild(index, {
                              value: headerValue,
                              render: renderString,
                              stringDiffPrecision: "none",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              preserveLineBreaks: true,
                              separatorMarker: ",",
                              group: "part",
                              subgroup: "header_value_part"
                            });
                            index++;
                          }
                        },
                        group: "entries",
                        subgroup: "header_value_entries"
                      });
                    }
                  }
                });
                break internal_entries;
              }
            }
            indexed_entries: {
              if (node.isArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const arrayEntriesNode = compositePartsNode.appendChild("indexed_entries", {
                  render: renderChildrenMultilineWhenDiff,
                  startMarker: "[",
                  endMarker: "]",
                  onelineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasSpacingBetweenEachChild: true,
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    }
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                    },
                    maxDiffType: "prop"
                  },
                  group: "entries",
                  subgroup: "array_entries"
                });
                const arrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    const hasOwnIndex = Object.hasOwn(value, index);
                    arrayEntriesNode.appendChild(index, {
                      value: hasOwnIndex ? value[index] : ARRAY_EMPTY_VALUE,
                      render: hasOwnIndex ? renderValue : renderEmptyValue,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "array_entry_value",
                      path: arrayEntriesNode.path.append(index, {
                        isIndexedEntry: true
                      })
                    });
                    index++;
                  }
                };
                arrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isTypedArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const typedEntriesNode = compositePartsNode.appendChild("indexed_entries", {
                  render: renderChildrenMultilineWhenDiff,
                  startMarker: "[",
                  endMarker: "]",
                  onelineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasSpacingBetweenEachChild: true,
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    }
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                    },
                    maxDiffType: "prop"
                  },
                  group: "entries",
                  subgroup: "typed_array_entries"
                });
                const typedArrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    typedEntriesNode.appendChild(index, {
                      value: value[index],
                      render: renderNumber,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "typed_array_entry_value",
                      path: typedEntriesNode.path.append(index, {
                        isIndexedEntry: true
                      })
                    });
                    index++;
                  }
                };
                typedArrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isStringObject) {
                ownPropertyNameToIgnoreSet.add("length");
                let index = 0;
                while (index < value.length) {
                  ownPropertyNameToIgnoreSet.add(String(index));
                  index++;
                }
                break indexed_entries;
              }
            }
            prototype: {
              if (node.objectTag !== "Object") {
                // - [] means Array.prototype
                // - Map("a" => true) means Map.prototype
                // - User {} means User.prototype (each application will "known" what "User" refers to)
                //   This means if 2 proto got the same name
                //   assert will consider they are equal even if that might not be the case
                //   It's a known limitation that could be addressed later
                //   as it's unlikely to happen or be important
                break prototype;
              }
              if (node.isFunction) {
                // prototype can be infered by construct notation
                // -> no need to display it
                // actual: () => {}
                // expect: function () {}
                break prototype;
              }
              if (node.isFunction && node.functionAnalysis.extendedClassName) {
                // prototype property can be infered thanks to the usage of extends
                break prototype;
              }
              const protoValue = Object.getPrototypeOf(value);
              if (protoValue === undefined) {
                break prototype;
              }
              if (protoValue === Object.prototype) {
                // - {} means Object.prototype
                break prototype;
              }
              propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                appendPropertyEntryNode("__proto__", protoValue);
              });
            }
            own_properties: {
              const allOwnPropertySymbols = Object.getOwnPropertySymbols(value);
              const allOwnPropertyNames = Object.getOwnPropertyNames(value);
              const ownPropertySymbols = [];
              const ownPropertyNames = [];
              for (const ownPropertySymbol of allOwnPropertySymbols) {
                if (ownPropertSymbolToIgnoreSet.has(ownPropertySymbol)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertySymbol(node, ownPropertySymbol)) {
                  continue;
                }
                ownPropertySymbols.push(ownPropertySymbol);
              }
              for (const ownPropertyName of allOwnPropertyNames) {
                if (ownPropertyNameToIgnoreSet.has(ownPropertyName)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertyName(node, ownPropertyName)) {
                  continue;
                }
                ownPropertyNames.push(ownPropertyName);
              }
              if (node.isAbortSignal) {
                const aborted = value.aborted;
                if (aborted) {
                  propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                    appendPropertyEntryNode("aborted", true);
                  });
                  const reason = value.reason;
                  if (reason !== undefined) {
                    propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                      appendPropertyEntryNode("reason", reason);
                    });
                  }
                }
              }
              // the idea here is that when an object does not have any property
              // we skip entirely the creation of own_properties node so that
              // if that value is compared to an object
              // {} is not even displayed even if empty
              // as a result an array without own property would be displayed as follow:
              // "[]"
              // and not
              // "[] {}"
              // the goal is to enable this for every well known object tag
              // one of the easiest way to achieve this would be to added something like
              // hasWellKnownPrototype: boolean
              // -> to be added when comparing prototypes
              const canSkipOwnProperties = node.isArray || node.isTypedArray || node.isMap || node.isSet || node.isURL || node.isURLSearchParams || node.isRequest || node.isResponse || node.isAbortController || node.isAbortSignal || node.isError || node.isRegExp;
              const skipOwnProperties = canSkipOwnProperties && ownPropertySymbols.length === 0 && ownPropertyNames.length === 0 && propertyLikeCallbackSet.size === 0;
              if (skipOwnProperties) {
                break own_properties;
              }
              const hasMarkersWhenEmpty = !objectConstructNode && !canSkipOwnProperties;
              const ownPropertiesNode = compositePartsNode.appendChild("own_properties", {
                render: renderChildrenMultilineWhenDiff,
                group: "entries",
                subgroup: "own_properties",
                ...(node.isClassPrototype ? {
                  onelineDiff: {
                    hasMarkersWhenEmpty,
                    separatorBetweenEachChildDisabled: true
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty,
                    separatorBetweenEachChildDisabled: true
                  }
                } : {
                  startMarker: "{",
                  endMarker: "}",
                  onelineDiff: {
                    hasMarkersWhenEmpty,
                    hasSpacingAroundChildren: true,
                    hasSpacingBetweenEachChild: true
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 prop ↑", "↑ {x} props ↑"],
                      between: ["↕ 1 prop ↕", "↕ {x} props ↕"],
                      end: ["↓ 1 prop ↓", "↓ {x} props ↓"]
                    },
                    maxDiffType: "prop"
                  }
                }),
                childGenerator: () => {
                  const appendPropertyNode = (propertyKey, propertyDescriptor, {
                    isSourceCode,
                    isFunctionPrototype,
                    isClassPrototype,
                    isHiddenWhenSame,
                    isHiddenWhenSolo,
                    isBody
                  }) => {
                    const propertyConverter = propertyConverterMap.get(propertyKey);
                    if (propertyConverter) {
                      const converterResult = propertyConverter();
                      propertyKey = converterResult[0];
                      propertyDescriptor = {
                        value: converterResult[1]
                      };
                    }
                    const ownPropertyNode = ownPropertiesNode.appendChild(propertyKey, {
                      key: propertyKey,
                      render: renderChildrenMultilineWhenDiff,
                      multilineDiff: {
                        hasIndentBetweenEachChild: true
                      },
                      onelineDiff: {
                        hasTrailingSeparator: true,
                        hasSpacingBetweenEachChild: true
                      },
                      focusedChildIndex: 0,
                      isFunctionPrototype,
                      isClassPrototype,
                      isHiddenWhenSame,
                      isHiddenWhenSolo,
                      childGenerator: () => {
                        let isMethod = false;
                        if (propertyDescriptor.value) {
                          isMethod = typeof propertyDescriptor.value === "function" && tokenizeFunction(propertyDescriptor.value).type === "method";
                        }
                        for (const descriptorName of Object.keys(propertyDescriptor)) {
                          const descriptorValue = propertyDescriptor[descriptorName];
                          if (shouldIgnoreOwnPropertyDescriptor(node, descriptorName, descriptorValue, {
                            isFrozen,
                            isSealed,
                            propertyKey
                          })) {
                            continue;
                          }
                          const descriptorNode = ownPropertyNode.appendChild(descriptorName, {
                            render: renderChildren,
                            onelineDiff: {
                              hasTrailingSeparator: true
                            },
                            focusedChildIndex: 0,
                            group: "entries",
                            subgroup: "property_descriptor",
                            isHiddenWhenSame: descriptorName === "configurable" || descriptorName === "writable" || descriptorName === "enumerable"
                          });
                          if (descriptorName === "configurable" || descriptorName === "writable" || descriptorName === "enumerable") {
                            descriptorNode.appendChild("descriptor_name", {
                              ...getGrammarProps(),
                              group: "property_descriptor_name",
                              value: descriptorName,
                              separatorMarker: " "
                            });
                          }
                          if (node.functionAnalysis.type === "class" && !isClassPrototype) {
                            descriptorNode.appendChild("static_keyword", {
                              ...getGrammarProps(),
                              group: "static_keyword",
                              value: "static",
                              separatorMarker: " ",
                              isHidden: isSourceCode || isMethod
                            });
                          }
                          if (descriptorName !== "get" && descriptorName !== "set") {
                            descriptorNode.appendChild("entry_key", {
                              value: propertyKey,
                              render: renderPrimitive,
                              quotesDisabled: typeof propertyKey === "string" && isValidPropertyIdentifier(propertyKey),
                              quotesBacktickDisabled: true,
                              separatorMarker: node.isClassPrototype ? "" : node.functionAnalysis.type === "class" ? " = " : ": ",
                              separatorMarkerWhenTruncated: node.isClassPrototype ? "" : node.functionAnalysis.type === "class" ? ";" : ",",
                              group: "entry_key",
                              subgroup: "property_key",
                              isHidden: isSourceCode || isMethod || isClassPrototype
                            });
                          }
                          descriptorNode.appendChild("entry_value", {
                            key: descriptorName,
                            value: descriptorValue,
                            render: renderValue,
                            separatorMarker: node.functionAnalysis.type === "class" ? ";" : ",",
                            group: "entry_value",
                            subgroup: "property_descriptor_value",
                            isSourceCode,
                            isBody,
                            isFunctionPrototype,
                            isClassPrototype
                          });
                        }
                      },
                      group: "entry",
                      subgroup: "property_entry",
                      path: node.path.append(propertyKey)
                    });
                    return ownPropertyNode;
                  };
                  const appendPropertyNodeSimplified = (propertyKey, propertyValue, params = {}) => {
                    return appendPropertyNode(propertyKey, {
                      // enumerable: true,
                      // /* eslint-disable no-unneeded-ternary */
                      // configurable: isFrozen || isSealed ? false : true,
                      // writable: isFrozen ? false : true,
                      // /* eslint-enable no-unneeded-ternary */
                      value: propertyValue
                    }, params);
                  };
                  if (node.isFunction) {
                    appendPropertyNodeSimplified(SOURCE_CODE_ENTRY_KEY, node.functionAnalysis.argsAndBodySource, {
                      isSourceCode: true
                    });
                  }
                  for (const propertyLikeCallback of propertyLikeCallbackSet) {
                    propertyLikeCallback(appendPropertyNodeSimplified);
                  }
                  for (const ownPropertySymbol of ownPropertySymbols) {
                    const ownPropertySymbolDescriptor = Object.getOwnPropertyDescriptor(value, ownPropertySymbol);
                    appendPropertyNode(ownPropertySymbol, ownPropertySymbolDescriptor, {
                      isHiddenWhenSame: true
                    });
                  }
                  for (let ownPropertyName of ownPropertyNames) {
                    const ownPropertyNameDescriptor = Object.getOwnPropertyDescriptor(value, ownPropertyName);
                    appendPropertyNode(ownPropertyName, ownPropertyNameDescriptor, {
                      isFunctionPrototype: ownPropertyName === "prototype" && node.isFunction,
                      isClassPrototype: ownPropertyName === "prototype" && node.functionAnalysis.type === "class",
                      isHiddenWhenSame: ownPropertyName === "lastIndex" && node.isRegExp || ownPropertyName === "headers" && node.subgroup === "arg_entry_value",
                      isHiddenWhenSolo: ownPropertyName === "lastIndex" && node.isRegExp
                    });
                  }
                }
              });
            }
            if (objectIntegrityMethodName) {
              compositePartsNode.appendChild("object_integrity_call_close_parenthesis", {
                ...getGrammarProps(),
                group: "grammar",
                value: ")",
                hasLeftSpacingDisabled: true
              });
            }
          },
          group: "entries",
          subgroup: "composite_parts"
        });
      };
      node.wrappedNodeGetter = () => {
        const compositePartsNode = node.childNodeMap.get("parts");
        if (!compositePartsNode) {
          return null;
        }
        const constructNode = compositePartsNode.childNodeMap.get("construct");
        if (constructNode) {
          const constructCallNode = constructNode.childNodeMap.get("call");
          if (constructCallNode) {
            const argEntriesNode = constructCallNode.childNodeMap.get("args");
            const firstArgNode = argEntriesNode.childNodeMap.get(0);
            return firstArgNode;
          }
        }
        const ownPropertiesNode = compositePartsNode.childNodeMap.get("own_properties");
        if (ownPropertiesNode) {
          const symbolToPrimitiveReturnValuePropertyNode = ownPropertiesNode.childNodeMap.get(SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY);
          if (symbolToPrimitiveReturnValuePropertyNode) {
            return getPropertyValueNode(symbolToPrimitiveReturnValuePropertyNode);
          }
          const valueOfReturnValuePropertyNode = ownPropertiesNode.childNodeMap.get(VALUE_OF_RETURN_VALUE_ENTRY_KEY);
          if (valueOfReturnValuePropertyNode) {
            return getPropertyValueNode(valueOfReturnValuePropertyNode);
          }
        }
        return null;
      };
      return node;
    }
    node.category = "primitive";
    return node;
  };
  const renderOptionsDefault = {};
  const referenceFromOthersSetDefault = new Set();
  const appendChildNodeGeneric = (node, childKey, params) => {
    const childNode = createNode({
      id: node.nextId(),
      context: node.context,
      parent: node,
      path: node.path,
      referenceMap: node.referenceMap,
      nextId: node.nextId,
      depth: params.group === "entries" || params.group === "entry" || params.isClassPrototype || node.parent?.isClassPrototype ? node.depth : node.depth + 1,
      ...params
    });
    node.childNodeMap.set(childKey, childNode);
    return childNode;
  };
}
const renderValue = (node, props) => {
  if (node.category === "primitive") {
    return renderPrimitive(node, props);
  }
  return renderComposite(node, props);
};
const renderPrimitive = (node, props) => {
  if (props.columnsRemaining < 1) {
    return node.context.setColor("…", node.color);
  }
  if (node.isSourceCode) {
    return truncateAndApplyColor("[source code]", node, props);
  }
  if (node.isUndefined) {
    return truncateAndApplyColor("undefined", node, props);
  }
  if (node.isString) {
    return renderString(node, props);
  }
  if (node.isSymbol) {
    return renderSymbol(node, props);
  }
  if (node.isNumber) {
    return renderNumber(node, props);
  }
  if (node.isBigInt) {
    return truncateAndApplyColor("".concat(node.value, "n"), node, props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderString = (node, props) => {
  if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("valueOf()", node, props);
  }
  if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("[Symbol.toPrimitive()]", node, props);
  }
  const stringPartsNode = node.childNodeMap.get("parts");
  if (stringPartsNode) {
    return stringPartsNode.render(props);
  }
  const {
    quoteMarkerRef,
    value
  } = node;
  let diff = "";
  if (quoteMarkerRef) {
    const quoteToEscape = quoteMarkerRef.current;
    for (const char of value) {
      if (char === quoteToEscape) {
        diff += "\\".concat(char);
      } else {
        diff += char;
      }
    }
  } else {
    diff += value;
  }
  return truncateAndApplyColor(diff, node, props);
};
// - no quote escaping
// - no line splitting
const getGrammarProps = () => {
  return {
    quotesDisabled: true,
    urlStringDetectionDisabled: false,
    dateStringDetectionDisabled: false,
    stringDiffPrecision: "none",
    render: renderString
  };
};
const renderEmptyValue = (node, props) => {
  return truncateAndApplyColor("empty", node, props);
};
const renderChar = (node, props) => {
  let char = node.value;
  const {
    quoteMarkerRef
  } = node;
  if (quoteMarkerRef && char === quoteMarkerRef.current) {
    return truncateAndApplyColor("\\".concat(char), node, props);
  }
  const {
    stringCharMapping = stringCharMappingDefault
  } = node.renderOptions;
  if (stringCharMapping && stringCharMapping.has(char)) {
    char = stringCharMapping.get(char);
  }
  return truncateAndApplyColor(char, node, props);
};
const renderNumber = (node, props) => {
  const numberCompositionNode = node.childNodeMap.get("composition");
  if (numberCompositionNode) {
    return numberCompositionNode.render(props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderSymbol = (node, props) => {
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  const symbolConstructNode = node.childNodeMap.get("symbol_construct");
  return symbolConstructNode.render(props);
};
const truncateAndApplyColor = (valueDiff, node, props) => {
  const {
    columnsRemaining
  } = props;
  if (columnsRemaining < 1) {
    return props.endSkippedMarkerDisabled ? "" : node.context.setColor("…", node.color);
  }
  let columnsRemainingForValue = columnsRemaining;
  let {
    startMarker,
    endMarker
  } = node;
  if (startMarker) {
    columnsRemainingForValue -= startMarker.length;
  }
  if (endMarker) {
    columnsRemainingForValue -= endMarker.length;
  }
  if (columnsRemainingForValue < 1) {
    return props.endSkippedMarkerDisabled ? "" : node.context.setColor("…", node.color);
  }
  if (valueDiff.length > columnsRemainingForValue) {
    if (props.endSkippedMarkerDisabled) {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue);
    } else {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue - "…".length);
      valueDiff += "…";
    }
  }
  let diff = "";
  if (startMarker) {
    diff += startMarker;
  }
  diff += valueDiff;
  if (endMarker) {
    diff += endMarker;
  }
  diff = node.context.setColor(diff, node.color);
  return diff;
};
const renderComposite = (node, props) => {
  // it's here that at some point we'll compare more than just own properties
  // because composite also got a prototype
  // and a constructor that might differ
  let diff = "";
  if (props.columnsRemaining < 2) {
    diff = node.context.setColor("…", node.color);
    return diff;
  }
  const referenceNode = node.childNodeMap.get("reference");
  if (referenceNode) {
    return referenceNode.render(props);
  }
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  let maxDepthReached = false;
  if (node.diffType === "same") {
    maxDepthReached = node.depth > props.MAX_DEPTH;
  } else if (typeof props.firstDiffDepth === "number") {
    maxDepthReached = node.depth + props.firstDiffDepth > props.MAX_DEPTH_INSIDE_DIFF;
  } else {
    props.firstDiffDepth = node.depth;
    maxDepthReached = node.depth > props.MAX_DEPTH_INSIDE_DIFF;
  }
  const compositePartsNode = node.childNodeMap.get("parts");
  if (maxDepthReached) {
    node.startMarker = node.endMarker = "";
    if (node.isStringObject) {
      const length = node.value.length;
      return truncateAndApplyColor("".concat(node.objectTag, "(").concat(length, ")"), node, props);
    }
    const indexedEntriesNode = compositePartsNode.childNodeMap.get("indexed_entries");
    if (indexedEntriesNode) {
      const length = indexedEntriesNode.childNodeMap.size;
      return truncateAndApplyColor("".concat(node.objectTag, "(").concat(length, ")"), node, props);
    }
    const ownPropertiesNode = compositePartsNode.childNodeMap.get("own_properties");
    const ownPropertyCount = ownPropertiesNode.childNodeMap.size;
    return truncateAndApplyColor("".concat(node.objectTag, "(").concat(ownPropertyCount, ")"), node, props);
  }
  return compositePartsNode.render(props);
};
const renderChildren = (node, props) => {
  const {
    hasMarkersWhenEmpty,
    focusedChildWhenSame = "first",
    separatorBetweenEachChildDisabled,
    hasSeparatorOnSingleChild,
    hasTrailingSeparator,
    hasSpacingAroundChildren,
    hasSpacingBetweenEachChild,
    skippedMarkers,
    skippedMarkersPlacement = "inside",
    childrenVisitMethod = "pick_around_starting_before"
  } = node.onelineDiff;
  let startSkippedMarker = "";
  let endSkippedMarker = "";
  if (skippedMarkers) {
    startSkippedMarker = skippedMarkers.start;
    endSkippedMarker = skippedMarkers.end;
    if (props.startSkippedMarkerDisabled) {
      startSkippedMarker = "";
    }
    if (props.endSkippedMarkerDisabled) {
      endSkippedMarker = "";
    }
  }
  const renderSkippedSection = (fromIndex, toIndex) => {
    let skippedMarker = fromIndex === 0 ? startSkippedMarker : endSkippedMarker;
    if (!skippedMarker) {
      return "";
    }
    // to pick the color we'll check each child
    let skippedChildIndex = fromIndex;
    let color = node.color;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        color = skippedChild.color;
        break;
      }
      if (skippedChild.diffType === "solo") {
        color = skippedChild.color;
      }
    }
    let diff = "";
    if (fromIndex > 0 && hasSpacingBetweenEachChild) {
      diff += " ";
    }
    diff += node.context.setColor(skippedMarker, color);
    return diff;
  };
  const childrenKeys = node.childrenKeys;
  let columnsRemainingForChildren = props.columnsRemaining;
  if (columnsRemainingForChildren < 1) {
    return renderSkippedSection(0, childrenKeys.length - 1);
  }
  const {
    startMarker,
    endMarker
  } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let minIndex = -1;
  let maxIndex = Infinity;
  let {
    focusedChildIndex
  } = node;
  {
    const {
      rangeToDisplay
    } = node;
    if (rangeToDisplay) {
      if (rangeToDisplay.min !== 0) {
        minIndex = rangeToDisplay.min;
      }
      // maxIndex = rangeToDisplay.end;
      focusedChildIndex = rangeToDisplay.start;
    } else if (focusedChildIndex === undefined) {
      const {
        firstChildWithDiffKey
      } = node;
      if (firstChildWithDiffKey === undefined) {
        // added/removed
        if (node.childComparisonDiffMap.size > 0) {
          focusedChildIndex = childrenKeys.length - 1;
          const {
            otherNode
          } = node;
          if (otherNode.placeholder) ; else if (otherNode.displayedRange) {
            minIndex = otherNode.displayedRange.min;
          } else {
            otherNode.render(props);
            minIndex = otherNode.displayedRange.min;
          }
        }
        // same
        else if (focusedChildWhenSame === "first") {
          focusedChildIndex = 0;
        } else if (focusedChildWhenSame === "last") {
          focusedChildIndex = childrenKeys.length - 1;
        } else {
          focusedChildIndex = Math.floor(childrenKeys.length / 2);
        }
      } else {
        focusedChildIndex = childrenKeys.indexOf(firstChildWithDiffKey);
      }
    }
  }
  let hasSomeChildSkippedAtStart = focusedChildIndex > 0;
  let hasSomeChildSkippedAtEnd = focusedChildIndex < childrenKeys.length - 1;
  const startSkippedMarkerWidth = startSkippedMarker.length;
  const endSkippedMarkerWidth = endSkippedMarker.length;
  const {
    separatorMarker,
    separatorMarkerWhenTruncated
  } = node;
  let boilerplate = "";
  {
    if (hasSomeChildSkippedAtStart) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate = "".concat(startMarker, " ").concat(startSkippedMarker);
        } else {
          boilerplate = "".concat(startMarker).concat(startSkippedMarker);
        }
      } else {
        boilerplate = "".concat(startSkippedMarker).concat(startMarker);
      }
    } else {
      boilerplate = startMarker;
    }
    if (hasSomeChildSkippedAtEnd) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate += "".concat(endSkippedMarker, " ").concat(endMarker);
        } else {
          boilerplate += "".concat(endSkippedMarker).concat(endMarker);
        }
      } else {
        boilerplate += "".concat(endMarker).concat(endSkippedMarker);
      }
    } else {
      boilerplate += endMarker;
    }
    if (separatorMarker) {
      boilerplate += separatorMarker;
    }
    const columnsRemainingForChildrenConsideringBoilerplate = columnsRemainingForChildren - boilerplate.length;
    if (columnsRemainingForChildrenConsideringBoilerplate < 0) {
      return renderSkippedSection(0, childrenKeys.length - 1);
    }
    if (columnsRemainingForChildrenConsideringBoilerplate === 0) {
      return skippedMarkersPlacement === "inside" ? node.context.setColor(boilerplate, node.color) : renderSkippedSection(0, childrenKeys.length - 1);
    }
  }
  let childrenDiff = "";
  let tryToSwapSkipMarkerWithChild = false;
  let columnsNeededBySkipMarkers = 0;
  let isFirstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (isFirstAppend) {
      isFirstAppend = false;
      minIndexDisplayed = maxIndexDisplayed = childIndex;
      return childDiff;
    }
    if (childIndex < minIndexDisplayed) {
      minIndexDisplayed = childIndex;
    } else if (childIndex > maxIndexDisplayed) {
      maxIndexDisplayed = childIndex;
    }
    const isPrevious = childIndex < focusedChildIndex;
    if (isPrevious) {
      if (childrenDiff) {
        return "".concat(childDiff).concat(childrenDiff);
      }
      return childDiff;
    }
    if (childrenDiff) {
      return "".concat(childrenDiff).concat(childDiff);
    }
    return childDiff;
  };
  if (hasSpacingAroundChildren) {
    columnsRemainingForChildren -= "".concat(startMarker, "  ").concat(endMarker).concat(separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker).length;
  } else {
    columnsRemainingForChildren -= "".concat(startMarker).concat(endMarker).concat(separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker).length;
  }
  let minIndexDisplayed = Infinity;
  let maxIndexDisplayed = -1;
  for (const childIndex of generateChildIndexes(childrenKeys, {
    startIndex: focusedChildIndex,
    minIndex,
    maxIndex,
    childrenVisitMethod
  })) {
    if (columnsRemainingForChildren <= 0) {
      break;
    }
    const childKey = childrenKeys[childIndex];
    const childNode = node.childNodeMap.get(childKey);
    if (!childNode) {
      // happens when forcing a specific range to be rendered
      continue;
    }
    const minIndexDisplayedCandidate = childIndex < minIndexDisplayed ? childIndex : minIndexDisplayed;
    const maxIndexDisplayedCandidate = childIndex > maxIndexDisplayed ? childIndex : maxIndexDisplayed;
    const hasSomeChildSkippedAtStartCandidate = minIndexDisplayedCandidate !== 0;
    const hasSomeChildSkippedAtEndCandidate = maxIndexDisplayedCandidate !== childrenKeys.length - 1;
    columnsNeededBySkipMarkers = 0;
    if (hasSomeChildSkippedAtStartCandidate) {
      columnsNeededBySkipMarkers += startSkippedMarkerWidth;
    }
    if (hasSomeChildSkippedAtEndCandidate) {
      if (hasSpacingBetweenEachChild) {
        columnsNeededBySkipMarkers += " ".length;
      }
      columnsNeededBySkipMarkers += endSkippedMarkerWidth;
    }
    let columnsRemainingForThisChild;
    if (tryToSwapSkipMarkerWithChild) {
      // "ab" makes more sense than "a…"
      // So if next child is the last and not too large
      // it will be allowed to fully replace the skip marker
      // But we must allow next child to take as much space as it needs
      // (hence we reset columnsRemainingForThisChild)
      // Otherwise it will be truncated and we'll think it take exactly the skip marker width
      // (That would lead to "http://example.com/dir/file.js" becoming "http://example/" instead of "http://example…")
      columnsRemainingForThisChild = props.columnsRemaining;
    } else {
      columnsRemainingForThisChild = columnsRemainingForChildren;
    }
    columnsRemainingForThisChild -= columnsNeededBySkipMarkers;
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled
    } = childNode;
    if (separatorMarkerDisabled) ; else if (separatorBetweenEachChildDisabled || shouldDisableSeparator(childIndex, childrenKeys, {
      hasSeparatorOnSingleChild,
      hasTrailingSeparator
    })) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarkerDisabled ? 0 : separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    const canSkipMarkers = node.subgroup === "url_parts" || node.subgroup === "date_parts" || node.subgroup === "array_entries";
    let childDiff = childNode.render({
      ...props,
      columnsRemaining: columnsRemainingForThisChild,
      startSkippedMarkerDisabled: canSkipMarkers && hasSomeChildSkippedAtStart && startSkippedMarkerWidth,
      endSkippedMarkerDisabled: canSkipMarkers && hasSomeChildSkippedAtEnd && endSkippedMarkerWidth,
      separatorMarker,
      forceDisableSeparatorMarker: () => {
        separatorMarkerDisabled = true;
      }
    });
    if (childDiff === "" && childNode.subgroup !== "own_properties") {
      // child has been truncated (well we can't tell 100% this is the reason)
      // but for now let's consider this to be true
      break;
    }
    let childDiffWidth;
    const newLineIndex = childDiff.indexOf("\n");
    if (newLineIndex === -1) {
      childDiffWidth = node.context.measureStringWidth(childDiff);
    } else {
      const newLineLastIndex = childDiff.lastIndexOf("\n");
      if (newLineLastIndex === newLineIndex) {
        const line = childDiff.slice(0, newLineIndex + "\n".length);
        childDiffWidth = node.context.measureStringWidth(line);
      } else {
        const lastLine = childDiff.slice(newLineLastIndex + "\n".length);
        childDiffWidth = node.context.measureStringWidth(lastLine);
      }
    }
    let separatorMarkerToAppend;
    let separatorWhenTruncatedUsed = false;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForChildren - childDiffWidth;
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
        separatorWhenTruncatedUsed = true;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += node.context.setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += node.context.setColor(separatorMarkerToAppend, node.color);
      }
    }
    if (!isFirstAppend && hasSpacingBetweenEachChild && childDiff) {
      if (childIndex < focusedChildIndex) {
        if ((childIndex > 0 || focusedChildIndex > 0) && childrenDiff && !childNode.hasRightSpacingDisabled) {
          let shouldInjectSpacing = true;
          const nextChildIndex = childIndex + 1;
          const nextChildKey = childrenKeys[nextChildIndex];
          if (nextChildKey !== undefined) {
            const nextChildNode = node.childNodeMap.get(nextChildKey);
            if (nextChildNode.hasLeftSpacingDisabled) {
              shouldInjectSpacing = false;
            }
          }
          if (shouldInjectSpacing) {
            childDiffWidth += " ".length;
            childDiff = "".concat(childDiff, " ");
          }
        }
      } else if (!childNode.hasLeftSpacingDisabled) {
        let shouldInjectSpacing = true;
        const previousChildIndex = childIndex - 1;
        const previousChildKey = childrenKeys[previousChildIndex];
        if (previousChildKey !== undefined) {
          const previousChildNode = node.childNodeMap.get(previousChildKey);
          if (previousChildNode.hasRightSpacingDisabled) {
            shouldInjectSpacing = false;
          }
        }
        if (shouldInjectSpacing) {
          childDiffWidth += " ".length;
          childDiff = " ".concat(childDiff);
        }
      }
    }
    if (childDiffWidth > columnsRemainingForChildren) {
      break;
    }
    if (childDiffWidth + columnsNeededBySkipMarkers > columnsRemainingForChildren) {
      break;
    }
    hasSomeChildSkippedAtStart = hasSomeChildSkippedAtStartCandidate;
    hasSomeChildSkippedAtEnd = hasSomeChildSkippedAtEndCandidate;
    columnsRemainingForChildren -= childDiffWidth;
    childrenDiff = appendChildDiff(childDiff, childIndex);
    if (separatorWhenTruncatedUsed) {
      break;
    }
    // if I had to stop there, I would put some markers
    // so I need to reserve that space
    // if I have exactly the spot I can still try to replace
    // skip marker by the actual next/prev child
    // ONLY if it can replace the marker (it's the first/last child)
    // AND it does take less or same width as marker
    if (columnsNeededBySkipMarkers > 0 && columnsNeededBySkipMarkers === columnsRemainingForChildren) {
      if (tryToSwapSkipMarkerWithChild) {
        // can we try again?
        break;
      }
      tryToSwapSkipMarkerWithChild = true;
    }
  }
  node.displayedRange = {
    min: minIndexDisplayed,
    start: focusedChildIndex,
    max: maxIndexDisplayed
  };
  if (minIndexDisplayed === Infinity || maxIndexDisplayed === -1) {
    return skippedMarkersPlacement === "inside" ? node.context.setColor(boilerplate, node.color) : renderSkippedSection(0, childrenKeys.length - 1);
  }
  let diff = "";
  if (hasSomeChildSkippedAtStart) {
    if (skippedMarkersPlacement === "inside") {
      if (startMarker) {
        diff += node.context.setColor(startMarker, node.color);
      }
      diff += renderSkippedSection(0, minIndexDisplayed);
    } else {
      diff += renderSkippedSection(0, minIndexDisplayed);
      if (startMarker) {
        diff += node.context.setColor(startMarker, node.color);
      }
    }
  } else if (startMarker) {
    diff += node.context.setColor(startMarker, node.color);
  }
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  diff += childrenDiff;
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  if (hasSomeChildSkippedAtEnd) {
    if (skippedMarkersPlacement === "inside") {
      diff += renderSkippedSection(maxIndexDisplayed + 1, childrenKeys.length - 1);
      if (endMarker) {
        diff += node.context.setColor(endMarker, node.color);
      }
    } else {
      if (endMarker) {
        diff += node.context.setColor(endMarker, node.color);
      }
      diff += renderSkippedSection(maxIndexDisplayed + 1, childrenKeys.length - 1);
    }
  } else if (endMarker) {
    diff += node.context.setColor(endMarker, node.color);
  }
  return diff;
};
function* generateChildIndexes(childrenKeys, {
  startIndex,
  minIndex,
  maxIndex,
  // "pick_around_starting_before"
  // "pick_around_starting_after"
  // "all_before_then_all_after"
  // "all_after_then_all_before"
  childrenVisitMethod
}) {
  yield startIndex;
  if (childrenVisitMethod === "all_before_then_all_after") {
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    return;
  }
  if (childrenVisitMethod === "all_after_then_all_before") {
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    return;
  }
  let previousAttempt = 0;
  let nextAttempt = 0;
  let tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
  while (true) {
    const previousChildIndex = startIndex - previousAttempt - 1;
    const hasPreviousChild = previousChildIndex === minIndex - 1 ? false : previousChildIndex >= 0;
    const nextChildIndex = startIndex + nextAttempt + 1;
    const hasNextChild = nextChildIndex === maxIndex - 1 ? false : nextChildIndex < childrenKeys.length;
    if (!hasPreviousChild && !hasNextChild) {
      break;
    }
    if (hasPreviousChild && hasNextChild) {
      if (tryBeforeFirst) {
        previousAttempt++;
        yield previousChildIndex;
        nextAttempt++;
        yield nextChildIndex;
      } else {
        nextAttempt++;
        yield nextChildIndex;
        previousAttempt++;
        yield previousChildIndex;
      }
    } else if (hasPreviousChild) {
      previousAttempt++;
      yield previousChildIndex;
      tryBeforeFirst = false;
    } else {
      nextAttempt++;
      yield nextChildIndex;
      tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
    }
  }
}
const renderChildrenMultilineWhenDiff = (node, props) => {
  if (node.diffType === "solo") {
    return renderChildrenMultiline(node, props);
  }
  if (node.childComparisonDiffMap.size > 0) {
    return renderChildrenMultiline(node, props);
  }
  return renderChildren(node, props);
};
/*
Rewrite "renderChildrenMultiline" so that:
- We start to render from the first child with a diff
and we discover around
then if we need to skip we append skipp stuff

the goal is that for lines we will first render the first line with a diff
as this line will impose to the surrounding lines where the focus will be
*/
const renderChildrenMultiline = (node, props) => {
  const childrenKeys = node.childrenKeys;
  const {
    separatorBetweenEachChildDisabled = false,
    hasSeparatorOnSingleChild = true,
    hasTrailingSeparator,
    hasNewLineAroundChildren,
    hasIndentBeforeEachChild,
    hasIndentBetweenEachChild,
    hasMarkersWhenEmpty,
    maxDiffType = "prop"
  } = node.multilineDiff;
  const {
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF
  } = props;
  const maxDiff = typeof MAX_DIFF_INSIDE_VALUE === "number" ? MAX_DIFF_INSIDE_VALUE : MAX_DIFF_INSIDE_VALUE[maxDiffType];
  const maxChildBeforeDiff = typeof MAX_CONTEXT_BEFORE_DIFF === "number" ? MAX_CONTEXT_BEFORE_DIFF : MAX_CONTEXT_BEFORE_DIFF[maxDiffType];
  const maxChildAfterDiff = typeof MAX_CONTEXT_AFTER_DIFF === "number" ? MAX_CONTEXT_AFTER_DIFF : MAX_CONTEXT_AFTER_DIFF[maxDiffType];
  let focusedChildIndex = 0;
  const childIndexToDisplayArray = [];
  index_to_display: {
    if (childrenKeys.length === 0) {
      break index_to_display;
    }
    if (maxDiff === Infinity) {
      let index = 0;
      // eslint-disable-next-line no-unused-vars
      for (const key of childrenKeys) {
        childIndexToDisplayArray.push(index);
        index++;
      }
      break index_to_display;
    }
    let diffCount = 0;
    const visitChild = childIndex => {
      const childKey = childrenKeys[childIndex];
      const childNode = node.childNodeMap.get(childKey);
      if (!childNode.comparison.hasAnyDiff) {
        return false;
      }
      if (isSourceCodeProperty(childNode)) ; else {
        diffCount++;
      }
      return true;
    };
    if (node.firstChildWithDiffKey === undefined) {
      focusedChildIndex = 0;
    } else {
      focusedChildIndex = childrenKeys.indexOf(node.firstChildWithDiffKey);
    }
    let childIndex = focusedChildIndex;
    while (
    // eslint-disable-next-line no-unmodified-loop-condition
    diffCount < maxDiff) {
      let currentChildHasDiff = visitChild(childIndex);
      if (currentChildHasDiff) {
        before: {
          const beforeDiffRemainingCount = maxChildBeforeDiff;
          if (beforeDiffRemainingCount < 1) {
            break before;
          }
          let fromIndex = childIndex - beforeDiffRemainingCount;
          let toIndex = childIndex;
          if (fromIndex < 0) {
            fromIndex = 0;
          } else {
            if (childIndexToDisplayArray.length) {
              const previousChildIndexToDisplay = childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
              if (previousChildIndexToDisplay + 1 === fromIndex) {
                // prevent skip length of 1
                childIndexToDisplayArray.push(previousChildIndexToDisplay + 1);
              }
            }
            if (fromIndex > 0) {
              fromIndex++;
            }
          }
          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) ; else {
              visitChild(index);
              childIndexToDisplayArray.push(index);
            }
            index++;
          }
        }
        childIndexToDisplayArray.push(childIndex);
        after: {
          const afterDiffRemainingCount = maxChildAfterDiff;
          if (afterDiffRemainingCount < 1) {
            break after;
          }
          let fromIndex = childIndex + 1;
          let toIndex = childIndex + 1 + afterDiffRemainingCount;
          if (toIndex > childrenKeys.length) {
            toIndex = childrenKeys.length;
          } else if (toIndex !== childrenKeys.length) {
            toIndex--;
          }
          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) ; else {
              currentChildHasDiff = visitChild(index);
              childIndexToDisplayArray.push(index);
              childIndex = index;
            }
            index++;
          }
        }
      } else if (childIndex === focusedChildIndex) {
        childIndexToDisplayArray.push(focusedChildIndex);
      }
      if (childIndex === childrenKeys.length - 1) {
        break;
      }
      childIndex++;
      continue;
    }
  }
  if (node.beforeRender) {
    node.beforeRender(props, {
      focusedChildIndex,
      childIndexToDisplayArray
    });
  }
  const {
    startMarker,
    endMarker
  } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let childrenDiff = "";
  const renderedRange = {
    start: Infinity,
    end: -1
  };
  let firstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (firstAppend) {
      firstAppend = false;
      renderedRange.start = renderedRange.end = childIndex;
      return childDiff;
    }
    if (childIndex < renderedRange.start) {
      renderedRange.start = childIndex;
      return "".concat(childDiff, "\n").concat(childrenDiff);
    }
    renderedRange.end = childIndex;
    return "".concat(childrenDiff, "\n").concat(childDiff);
  };
  const appendSkippedSection = (fromIndex, toIndex) => {
    const skippedMarkers = node.multilineDiff.skippedMarkers || {
      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
    };
    const skippedCount = toIndex - fromIndex;
    let skippedChildIndex = fromIndex;
    let modifiedCount = 0;
    let soloCount = 0;
    let modifiedColor;
    let soloColor;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        modifiedCount++;
        modifiedColor = skippedChild.color;
      }
      if (skippedChild.diffType === "solo") {
        soloCount++;
        soloColor = skippedChild.color;
      }
    }
    const allModified = modifiedCount === skippedCount;
    const allSolo = soloCount === skippedCount;
    let skippedDiff = "";
    if (hasIndentBeforeEachChild) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    let skippedMarker;
    if (fromIndex < renderedRange.start) {
      skippedMarker = skippedMarkers.start;
    } else {
      if (hasIndentBetweenEachChild) {
        skippedDiff += " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      }
      if (toIndex < childrenKeys.length - 1) {
        skippedMarker = skippedMarkers.between;
      } else {
        skippedMarker = skippedMarkers.end;
      }
    }
    if (skippedCount === 1) {
      skippedDiff += node.context.setColor(skippedMarker[0], allModified ? modifiedColor : allSolo ? soloColor : node.color);
    } else {
      skippedDiff += node.context.setColor(skippedMarker[1].replace("{x}", skippedCount), allModified ? modifiedColor : allSolo ? soloColor : node.color);
    }
    const details = [];
    if (modifiedCount && modifiedCount !== skippedCount) {
      details.push(node.context.setColor("".concat(modifiedCount, " modified"), modifiedColor));
    }
    if (soloCount && soloCount !== skippedCount) {
      details.push(node.context.name === "actual" ? node.context.setColor("".concat(soloCount, " added"), soloColor) : node.context.setColor("".concat(soloCount, " removed"), soloColor));
    }
    if (details.length) {
      skippedDiff += " ";
      skippedDiff += node.context.setColor("(", node.color);
      skippedDiff += details.join(", ");
      skippedDiff += node.context.setColor(")", node.color);
    }
    childrenDiff = appendChildDiff(skippedDiff, toIndex === childrenKeys.length - 1 ? toIndex : fromIndex);
  };
  const renderChildDiff = (childNode, childIndex) => {
    let childDiff = "";
    let columnsRemainingForThisChild = childIndex > 0 || hasNewLineAroundChildren ? props.MAX_COLUMNS : props.columnsRemaining;
    if (hasIndentBeforeEachChild) {
      const indent = "  ".repeat(getNodeDepth(node, props) + 1);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    if (hasIndentBetweenEachChild && childIndex !== 0) {
      const indent = " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled
    } = childNode;
    if (separatorMarkerDisabled) ; else if (separatorBetweenEachChildDisabled || shouldDisableSeparator(childIndex, childrenKeys, {
      hasTrailingSeparator,
      hasSeparatorOnSingleChild
    })) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    } else if (childNode.subgroup === "property_entry") {
      enableSeparatorOnSingleProperty(childNode);
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    if (childNode.subgroup === "line_entry_value") {
      if (childIndex === focusedChildIndex) {
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild
        });
      } else {
        childNode.rangeToDisplay = focusedChildNode.displayedRange;
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild
        });
      }
    } else {
      childDiff += childNode.render({
        ...props,
        columnsRemaining: columnsRemainingForThisChild
      });
    }
    let separatorMarkerToAppend;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForThisChild - node.context.measureStringWidth(childDiff);
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiff += node.context.setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiff += node.context.setColor(separatorMarkerToAppend, node.color);
      }
    }
    return childDiff;
  };
  const focusedChildKey = childrenKeys[focusedChildIndex];
  const focusedChildNode = node.childNodeMap.get(focusedChildKey);
  const focusedChildDiff = renderChildDiff(focusedChildNode, focusedChildIndex);
  const [firstChildIndexToDisplay] = childIndexToDisplayArray;
  if (firstChildIndexToDisplay > 0) {
    appendSkippedSection(0, firstChildIndexToDisplay);
  }
  let previousChildIndexDisplayed;
  for (const childIndexToDisplay of childIndexToDisplayArray) {
    if (previousChildIndexDisplayed !== undefined && childIndexToDisplay !== previousChildIndexDisplayed + 1) {
      appendSkippedSection(previousChildIndexDisplayed, childIndexToDisplay - 1);
    }
    if (childIndexToDisplay === focusedChildIndex) {
      childrenDiff = appendChildDiff(focusedChildDiff, childIndexToDisplay);
    } else {
      const childKey = childrenKeys[childIndexToDisplay];
      const childNode = node.childNodeMap.get(childKey);
      const childDiff = renderChildDiff(childNode, childIndexToDisplay);
      childrenDiff = appendChildDiff(childDiff, childIndexToDisplay);
    }
    previousChildIndexDisplayed = childIndexToDisplay;
  }
  if (childrenKeys.length > 1 && previousChildIndexDisplayed !== childrenKeys.length - 1) {
    appendSkippedSection(previousChildIndexDisplayed, childrenKeys.length - 1);
  }
  let diff = "";
  diff += node.context.setColor(startMarker, node.color);
  if (hasNewLineAroundChildren) {
    diff += "\n";
  }
  diff += childrenDiff;
  if (hasNewLineAroundChildren) {
    diff += "\n";
    diff += "  ".repeat(getNodeDepth(node, props));
  }
  diff += node.context.setColor(endMarker, node.color);
  return diff;
};
const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};
const enableMultilineDiff = lineEntriesNode => {
  lineEntriesNode.multilineDiff.hasIndentBetweenEachChild = !lineEntriesNode.multilineDiff.lineNumbersDisabled;
  lineEntriesNode.beforeRender = (props, {
    childIndexToDisplayArray
  }) => {
    if (props.forceDisableSeparatorMarker) {
      props.columnsRemaining += props.separatorMarker.length;
      props.forceDisableSeparatorMarker();
    }
    const biggestDisplayedLineIndex = childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
    for (const lineIndexToDisplay of childIndexToDisplayArray) {
      const lineNode = lineEntriesNode.childNodeMap.get(lineIndexToDisplay);
      lineNode.onelineDiff.hasMarkersWhenEmpty = true;
      if (!lineEntriesNode.multilineDiff.lineNumbersDisabled) {
        lineNode.startMarker = renderLineStartMarker(lineNode, biggestDisplayedLineIndex);
      }
    }
  };
  const firstLineNode = lineEntriesNode.childNodeMap.get(0);
  firstLineNode.onelineDiff.hasMarkersWhenEmpty = false;
  firstLineNode.onelineDiff.skippedMarkersPlacement = "inside";
  firstLineNode.startMarker = firstLineNode.endMarker = "";
};
const forceSameQuotes = (actualNode, expectNode) => {
  const actualQuoteMarkerRef = actualNode.quoteMarkerRef;
  const expectQuoteMarkerRef = expectNode.quoteMarkerRef;
  const actualQuote = actualQuoteMarkerRef ? actualQuoteMarkerRef.current : "";
  const expectQuote = expectQuoteMarkerRef ? expectQuoteMarkerRef.current : "";
  if (actualQuote === '"' && expectQuote !== '"') {
    actualQuoteMarkerRef.current = expectQuote;
    actualNode.startMarker = actualNode.endMarker = expectQuote;
  } else if (actualQuote !== expectQuote) {
    expectQuoteMarkerRef.current = actualQuote;
    expectNode.startMarker = expectNode.endMarker = actualQuote;
  }
};
const renderLineStartMarker = (lineNode, biggestDisplayedLineIndex) => {
  const lineNumberString = String(lineNode.key + 1);
  const biggestDisplayedLineNumberString = String(biggestDisplayedLineIndex + 1);
  if (biggestDisplayedLineNumberString.length > lineNumberString.length) {
    return " ".concat(lineNumberString, "| ");
  }
  return "".concat(lineNumberString, "| ");
};
const createMethodCallNode = (node, {
  objectName,
  methodName,
  args,
  renderOnlyArgs
}) => {
  return {
    render: renderChildren,
    onelineDiff: {
      hasTrailingSeparator: true
    },
    group: "entries",
    subgroup: "method_call",
    childGenerator: methodCallNode => {
      methodCallNode.appendChild("object_name", {
        ...getGrammarProps(),
        group: "object_name",
        value: objectName
      });
      if (methodName) {
        methodCallNode.appendChild("method_dot", {
          ...getGrammarProps(),
          group: "method_dot",
          value: "."
        });
        methodCallNode.appendChild("method_name", {
          ...getGrammarProps(),
          group: "method_name",
          value: methodName
        });
      }
      methodCallNode.appendChild("args", createArgEntriesNode(methodCallNode, {
        renderOnlyArgs,
        args
      }));
    }
  };
};
const createArgEntriesNode = (node, {
  args,
  renderOnlyArgs
}) => {
  return {
    render: renderChildren,
    startMarker: "(",
    endMarker: ")",
    onelineDiff: {
      hasMarkersWhenEmpty: true,
      hasSpacingBetweenEachChild: true
    },
    ...(renderOnlyArgs ? {} : {}),
    group: "entries",
    subgroup: "arg_entries",
    childGenerator: callNode => {
      const appendArgEntry = (argIndex, argValue, {
        key,
        ...valueParams
      }) => {
        callNode.appendChild(argIndex, {
          group: "entry_value",
          subgroup: "arg_entry_value",
          value: argValue,
          render: renderValue,
          separatorMarker: ",",
          path: node.path.append(key || argIndex),
          depth: node.depth,
          ...valueParams
        });
      };
      let argIndex = 0;
      for (const {
        value,
        ...argParams
      } of args) {
        appendArgEntry(argIndex, value, argParams);
        argIndex++;
      }
    }
  };
};
const DOUBLE_QUOTE = "\"";
const SINGLE_QUOTE = "'";
const BACKTICK = "`";
const getAddedOrRemovedReason = node => {
  if (node.group === "url_part") {
    return node.subgroup;
  }
  if (node.group === "date_part") {
    return node.subgroup;
  }
  if (node.group === "time_part") {
    return node.subgroup;
  }
  if (node.category === "entry") {
    return node.key;
  }
  if (node.category === "entry_key") {
    return node.value;
  }
  if (node.category === "entry_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  return "unknown";
};
const getWrappedNode = (node, predicate) => {
  const wrappedNode = node.wrappedNodeGetter();
  if (!wrappedNode) {
    return null;
  }
  if (predicate(wrappedNode)) {
    return wrappedNode;
  }
  // can happen for
  // valueOf: () => {
  //   return { valueOf: () => 10 }
  // }
  const nested = getWrappedNode(wrappedNode, predicate);
  if (nested) {
    return nested;
  }
  return null;
};
// const asCompositeNode = (node) =>
//   getWrappedNode(
//     node,
//     (wrappedNodeCandidate) => wrappedNodeCandidate.group === "composite",
//   );
const asPrimitiveNode = node => getWrappedNode(node, wrappedNodeCandidate => wrappedNodeCandidate.category === "primitive");
const getPropertyValueNode = node => {
  if (node.subgroup !== "property_entry") {
    return null;
  }
  const valueDescriptorNode = node.childNodeMap.get("value");
  if (!valueDescriptorNode) {
    return null;
  }
  return valueDescriptorNode.childNodeMap.get("entry_value");
};
const isSourceCodeProperty = node => {
  const propertyValueNode = getPropertyValueNode(node);
  return propertyValueNode && propertyValueNode.isSourceCode;
};
const disableSeparatorOnProperty = node => {
  for (const [, descriptorNode] of node.childNodeMap) {
    const propertyDescriptorValueNode = descriptorNode.childNodeMap.get("entry_value");
    propertyDescriptorValueNode.separatorMarkerDisabled = true;
  }
};
const enableSeparatorOnSingleProperty = node => {
  for (const [, descriptorNode] of node.childNodeMap) {
    if (descriptorNode.onelineDiff) {
      descriptorNode.onelineDiff.hasSeparatorOnSingleChild = true;
    }
  }
};
const shouldIgnoreOwnPropertyName = (node, ownPropertyName) => {
  if (ownPropertyName === "prototype") {
    // ignore prototype if it's the default prototype
    // created by the runtime
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(node.value, ownPropertyName);
    if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
      return false;
    }
    const prototypeValue = ownPropertyDescriptor.value;
    if (node.isArrowFunction) {
      return prototypeValue === undefined;
    }
    if (node.isAsyncFunction && !node.isGeneratorFunction) {
      return prototypeValue === undefined;
    }
    if (!isComposite(prototypeValue)) {
      return false;
    }
    const constructorDescriptor = Object.getOwnPropertyDescriptor(prototypeValue, "constructor");
    if (!constructorDescriptor) {
      return false;
    }
    // the default prototype.constructor is
    // configurable, writable, non enumerable and got a value
    if (!constructorDescriptor.configurable || !constructorDescriptor.writable || constructorDescriptor.enumerable || constructorDescriptor.set || constructorDescriptor.get) {
      return false;
    }
    const constructorValue = constructorDescriptor.value;
    if (constructorValue !== node.value) {
      return false;
    }
    const propertyNames = Object.getOwnPropertyNames(prototypeValue);
    return propertyNames.length === 1;
  }
  if (ownPropertyName === "constructor") {
    // if (
    //   node.parent.key === "prototype" &&
    //   node.parent.parent.isFunction &&
    //   Object.hasOwn(ownPropertyDescriptor, "value") &&
    //   ownPropertyDescriptor.value === node.parent.parent.value
    // ) {
    return true;
    //  }
    //  break ignore;
  }
  return false;
};
const shouldIgnoreOwnPropertySymbol = (node, ownPropertySymbol) => {
  if (ownPropertySymbol === Symbol.toStringTag) {
    const propertySymbolDescriptor = Object.getOwnPropertyDescriptor(node.value, Symbol.toStringTag);
    if (Object.hasOwn(propertySymbolDescriptor, "value")) {
      // toStringTag is already reflected on subtype
      return true;
    }
    return false;
  }
  const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
  const symbolDescription = symbolToDescription(ownPropertySymbol);
  if (node.isPromise) {
    if (keyForSymbol) {
      return false;
    }
    if (symbolDescription === "async_id_symbol") {
      // nodejs runtime puts a custom Symbol on promise
      return true;
    }
    return false;
  }
  if (node.isHeaders) {
    if (keyForSymbol) {
      return false;
    }
    // nodejs runtime put custom symbols on Headers
    if (["guard", "headers list", "realm"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isAbortSignal) {
    if (keyForSymbol) {
      return false;
    }
    if (["realm", "kAborted", "kReason", "kEvents", "events.maxEventTargetListeners", "events.maxEventTargetListenersWarned", "kHandlers", "kComposite"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isRequest) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    // nodejs runtime put custom symbols on Request
    if (["state", "signal", "abortController", "headers"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isResponse) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    if (["state", "headers"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.objectTag === "ReadableStream") {
    const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
    if (keyForSymbol && keyForSymbol.startsWith("nodejs.webstream.")) {
      return true;
    }
    if (["kType", "kState"].includes(symbolDescription)) {
      return true;
    }
  }
  return false;
};
const shouldIgnoreOwnPropertyDescriptor = (node, descriptorName, descriptorValue, {
  isFrozen,
  isSealed,
  propertyKey
}) => {
  /* eslint-disable no-unneeded-ternary */
  if (descriptorName === "writable") {
    if (isFrozen) {
      return true;
    }
    if (propertyKey === "prototype" && node.functionAnalysis.type === "class") {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "configurable") {
    if (isFrozen) {
      return true;
    }
    if (isSealed) {
      return true;
    }
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "enumerable") {
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    if (propertyKey === "message" && node.isError) {
      return descriptorValue === false;
    }
    if (node.isClassPrototype) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  /* eslint-enable no-unneeded-ternary */
  if (descriptorName === "get") {
    return descriptorValue === undefined;
  }
  if (descriptorName === "set") {
    return descriptorValue === undefined;
  }
  return false;
};
// const shouldIgnorePropertyDescriptor = (
//   node,
//   propertyKey,
//   descriptorKey,
//   descriptorValue,
// ) => {
//   /* eslint-disable no-unneeded-ternary */
//   if (descriptorKey === "writable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     const writableDefaultValue =
//       propertyKey === "prototype" && node.isClass ? false : true;
//     return descriptorValue === writableDefaultValue;
//   }
//   if (descriptorKey === "configurable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     if (node.propsSealed) {
//       return true;
//     }
//     const configurableDefaultValue =
//       propertyKey === "prototype" && node.isFunction ? false : true;
//     return descriptorValue === configurableDefaultValue;
//   }
//   if (descriptorKey === "enumerable") {
//     const enumerableDefaultValue =
//       (propertyKey === "prototype" && node.isFunction) ||
//       (propertyKey === "message" && node.isError) ||
//       node.isClassPrototype
//         ? false
//         : true;
//     return descriptorValue === enumerableDefaultValue;
//   }
//   /* eslint-enable no-unneeded-ternary */
//   if (descriptorKey === "get") {
//     return descriptorValue === undefined;
//   }
//   if (descriptorKey === "set") {
//     return descriptorValue === undefined;
//   }
//   return false;
// };

const createReasons = () => {
  const overall = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  const self = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  const inside = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  return {
    overall,
    self,
    inside
  };
};
const appendReasons = (reasonSet, ...otherReasonSets) => {
  for (const otherReasonSet of otherReasonSets) {
    for (const reason of otherReasonSet) {
      reasonSet.add(reason);
    }
  }
};
const appendReasonGroup = (reasonGroup, otherReasonGroup) => {
  appendReasons(reasonGroup.any, otherReasonGroup.any);
  appendReasons(reasonGroup.removed, otherReasonGroup.removed);
  appendReasons(reasonGroup.added, otherReasonGroup.added);
  appendReasons(reasonGroup.modified, otherReasonGroup.modified);
};
const CHAR_TO_ESCAPE = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "\\": "\\\\",
  "\x00": "\\x00",
  "\x01": "\\x01",
  "\x02": "\\x02",
  "\x03": "\\x03",
  "\x04": "\\x04",
  "\x05": "\\x05",
  "\x06": "\\x06",
  "\x07": "\\x07",
  "\x0B": "\\x0B",
  "\x0E": "\\x0E",
  "\x0F": "\\x0F",
  "\x10": "\\x10",
  "\x11": "\\x11",
  "\x12": "\\x12",
  "\x13": "\\x13",
  "\x14": "\\x14",
  "\x15": "\\x15",
  "\x16": "\\x16",
  "\x17": "\\x17",
  "\x18": "\\x18",
  "\x19": "\\x19",
  "\x1A": "\\x1A",
  "\x1B": "\\x1B",
  "\x1C": "\\x1C",
  "\x1D": "\\x1D",
  "\x1E": "\\x1E",
  "\x1F": "\\x1F",
  "\x7F": "\\x7F",
  "\x83": "\\x83",
  "\x85": "\\x85",
  "\x86": "\\x86",
  "\x87": "\\x87",
  "\x88": "\\x88",
  "\x89": "\\x89",
  "\x8A": "\\x8A",
  "\x8B": "\\x8B",
  "\x8C": "\\x8C",
  "\x8D": "\\x8D",
  "\x8E": "\\x8E",
  "\x8F": "\\x8F",
  "\x90": "\\x90",
  "\x91": "\\x91",
  "\x92": "\\x92",
  "\x93": "\\x93",
  "\x94": "\\x94",
  "\x95": "\\x95",
  "\x96": "\\x96",
  "\x97": "\\x97",
  "\x98": "\\x98",
  "\x99": "\\x99",
  "\x9A": "\\x9A",
  "\x9B": "\\x9B",
  "\x9C": "\\x9C",
  "\x9D": "\\x9D",
  "\x9E": "\\x9E",
  "\x9F": "\\x9F"
};
const stringCharMappingDefault = new Map(Object.entries(CHAR_TO_ESCAPE));
const shouldDisableSeparator = (childIndex, childrenKeys, {
  hasSeparatorOnSingleChild,
  hasTrailingSeparator
}) => {
  if (childrenKeys.length === 1) {
    return !hasSeparatorOnSingleChild;
  }
  if (childIndex === childrenKeys.length - 1) {
    return !hasTrailingSeparator;
  }
  return false;
};
const canParseUrl = URL.canParse || (() => {
  try {
    // eslint-disable-next-line no-new, no-undef
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
});
const symbolToDescription = symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  // return symbol.description // does not work on node
};

// const regExpSpecialCharSet = new Set([
//   "/",
//   "^",
//   "\\",
//   "[",
//   "]",
//   "(",
//   ")",
//   "{",
//   "}",
//   "?",
//   "+",
//   "*",
//   ".",
//   "|",
//   "$",
// ]);

const pickBestQuote = (string, {
  quotesBacktickDisabled
} = {}) => {
  let backslashCount = 0;
  let doubleQuoteCount = 0;
  let singleQuoteCount = 0;
  let backtickCount = 0;
  for (const char of string) {
    if (char === "\\") {
      backslashCount++;
    } else {
      if (backslashCount % 2 > 0) ; else if (char === DOUBLE_QUOTE) {
        doubleQuoteCount++;
      } else if (char === SINGLE_QUOTE) {
        singleQuoteCount++;
      } else if (char === BACKTICK) {
        backtickCount++;
      }
      backslashCount = 0;
    }
  }
  if (doubleQuoteCount === 0) {
    return DOUBLE_QUOTE;
  }
  if (singleQuoteCount === 0) {
    return SINGLE_QUOTE;
  }
  if (backtickCount === 0 && !quotesBacktickDisabled) {
    return BACKTICK;
  }
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return DOUBLE_QUOTE;
};
const generateHeaderValueParts = (headerValue, {
  headerValueNode,
  quoteMarkerRef
}) => {
  let partIndex = 0;
  let partRaw;
  let part;
  let attribute;
  let attributeMap = null;
  let attributeNameStarted = false;
  let attributeValueStarted = false;
  let attributeName = "";
  let attributeValue = "";
  const startHeaderValuePart = () => {
    if (part) {
      part.end();
      part = null;
    }
    part = {
      end: () => {
        if (!attributeMap) {
          return;
        }
        if (attribute) {
          attribute.end();
          attribute = null;
        }
        if (attributeMap.size === 0) {
          attributeMap = null;
          part = null;
          return;
        }
        const headerValuePartNode = headerValueNode.appendChild(partIndex, {
          group: "entries",
          subgroup: "header_part",
          value: partRaw,
          render: renderChildren,
          onelineDiff: {},
          startMarker: partIndex === 0 ? "" : ",",
          path: headerValueNode.path.append(partIndex, {
            isIndexedEntry: true
          })
        });
        let isFirstAttribute = true;
        for (const [attributeName, attributeValue] of attributeMap) {
          const attributeNameNormalized = attributeName.trim();
          const headerAttributeNode = headerValuePartNode.appendChild(attributeNameNormalized, {
            group: "entry",
            subgroup: "header_attribute",
            render: renderChildren,
            onelineDiff: {},
            path: headerValuePartNode.path.append(attributeNameNormalized)
          });
          if (attributeValue === true) {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";"
            });
          } else {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";",
              endMarker: "="
            });
            headerAttributeNode.appendChild("entry_value", {
              subgroup: "header_attribute_value",
              key: attributeName,
              value: attributeValue,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef
            });
          }
          isFirstAttribute = false;
        }
        partIndex++;
        attributeMap = null;
        part = null;
      }
    };
    partRaw = "";
    attributeMap = new Map();
    startAttributeName();
  };
  const startAttributeName = () => {
    if (attribute) {
      attribute.end();
      attribute = null;
    }
    attributeNameStarted = true;
    attribute = {
      end: () => {
        if (!attributeNameStarted && !attributeValueStarted) {
          return;
        }
        if (!attributeValue) {
          if (!attributeName) {
            // trailing ";" (or trailing ",")
            attributeNameStarted = false;
            return;
          }
          attributeMap.set(attributeName, true);
          attributeNameStarted = false;
          attributeName = "";
          attributeValueStarted = false;
          return;
        }
        attributeMap.set(attributeName, attributeValue);
        attributeNameStarted = false;
        attributeName = "";
        attributeValueStarted = false;
        attributeValue = "";
      }
    };
  };
  const startAttributeValue = () => {
    attributeNameStarted = false;
    attributeValueStarted = true;
  };
  startHeaderValuePart();
  let charIndex = 0;
  while (charIndex < headerValue.length) {
    const char = headerValue[charIndex];
    partRaw += char;
    if (char === ",") {
      startHeaderValuePart();
      charIndex++;
      continue;
    }
    if (char === ";") {
      startAttributeName();
      charIndex++;
      continue;
    }
    if (char === "=") {
      startAttributeValue();
      charIndex++;
      continue;
    }
    if (attributeValueStarted) {
      attributeValue += char;
      charIndex++;
      continue;
    }
    if (attributeNameStarted) {
      attributeName += char;
      charIndex++;
      continue;
    }
    throw new Error("wtf");
  }
  part.end();
};

// see https://github.com/sindresorhus/string-width/issues/50
let restore = () => {};
if (typeof window.Intl.Segmenter !== "function") {
  window.Intl.Segmenter = function () {
    const segment = string => {
      return string.split("").map(char => {
        return {
          segment: char
        };
      });
    };
    return {
      segment
    };
  };
  restore = () => {
    window.Intl.Segmenter = undefined;
  };
}
const cleanup = () => {
  restore();
};

// Generated code.

function isAmbiguous(x) {
  return x === 0xA1 || x === 0xA4 || x === 0xA7 || x === 0xA8 || x === 0xAA || x === 0xAD || x === 0xAE || x >= 0xB0 && x <= 0xB4 || x >= 0xB6 && x <= 0xBA || x >= 0xBC && x <= 0xBF || x === 0xC6 || x === 0xD0 || x === 0xD7 || x === 0xD8 || x >= 0xDE && x <= 0xE1 || x === 0xE6 || x >= 0xE8 && x <= 0xEA || x === 0xEC || x === 0xED || x === 0xF0 || x === 0xF2 || x === 0xF3 || x >= 0xF7 && x <= 0xFA || x === 0xFC || x === 0xFE || x === 0x101 || x === 0x111 || x === 0x113 || x === 0x11B || x === 0x126 || x === 0x127 || x === 0x12B || x >= 0x131 && x <= 0x133 || x === 0x138 || x >= 0x13F && x <= 0x142 || x === 0x144 || x >= 0x148 && x <= 0x14B || x === 0x14D || x === 0x152 || x === 0x153 || x === 0x166 || x === 0x167 || x === 0x16B || x === 0x1CE || x === 0x1D0 || x === 0x1D2 || x === 0x1D4 || x === 0x1D6 || x === 0x1D8 || x === 0x1DA || x === 0x1DC || x === 0x251 || x === 0x261 || x === 0x2C4 || x === 0x2C7 || x >= 0x2C9 && x <= 0x2CB || x === 0x2CD || x === 0x2D0 || x >= 0x2D8 && x <= 0x2DB || x === 0x2DD || x === 0x2DF || x >= 0x300 && x <= 0x36F || x >= 0x391 && x <= 0x3A1 || x >= 0x3A3 && x <= 0x3A9 || x >= 0x3B1 && x <= 0x3C1 || x >= 0x3C3 && x <= 0x3C9 || x === 0x401 || x >= 0x410 && x <= 0x44F || x === 0x451 || x === 0x2010 || x >= 0x2013 && x <= 0x2016 || x === 0x2018 || x === 0x2019 || x === 0x201C || x === 0x201D || x >= 0x2020 && x <= 0x2022 || x >= 0x2024 && x <= 0x2027 || x === 0x2030 || x === 0x2032 || x === 0x2033 || x === 0x2035 || x === 0x203B || x === 0x203E || x === 0x2074 || x === 0x207F || x >= 0x2081 && x <= 0x2084 || x === 0x20AC || x === 0x2103 || x === 0x2105 || x === 0x2109 || x === 0x2113 || x === 0x2116 || x === 0x2121 || x === 0x2122 || x === 0x2126 || x === 0x212B || x === 0x2153 || x === 0x2154 || x >= 0x215B && x <= 0x215E || x >= 0x2160 && x <= 0x216B || x >= 0x2170 && x <= 0x2179 || x === 0x2189 || x >= 0x2190 && x <= 0x2199 || x === 0x21B8 || x === 0x21B9 || x === 0x21D2 || x === 0x21D4 || x === 0x21E7 || x === 0x2200 || x === 0x2202 || x === 0x2203 || x === 0x2207 || x === 0x2208 || x === 0x220B || x === 0x220F || x === 0x2211 || x === 0x2215 || x === 0x221A || x >= 0x221D && x <= 0x2220 || x === 0x2223 || x === 0x2225 || x >= 0x2227 && x <= 0x222C || x === 0x222E || x >= 0x2234 && x <= 0x2237 || x === 0x223C || x === 0x223D || x === 0x2248 || x === 0x224C || x === 0x2252 || x === 0x2260 || x === 0x2261 || x >= 0x2264 && x <= 0x2267 || x === 0x226A || x === 0x226B || x === 0x226E || x === 0x226F || x === 0x2282 || x === 0x2283 || x === 0x2286 || x === 0x2287 || x === 0x2295 || x === 0x2299 || x === 0x22A5 || x === 0x22BF || x === 0x2312 || x >= 0x2460 && x <= 0x24E9 || x >= 0x24EB && x <= 0x254B || x >= 0x2550 && x <= 0x2573 || x >= 0x2580 && x <= 0x258F || x >= 0x2592 && x <= 0x2595 || x === 0x25A0 || x === 0x25A1 || x >= 0x25A3 && x <= 0x25A9 || x === 0x25B2 || x === 0x25B3 || x === 0x25B6 || x === 0x25B7 || x === 0x25BC || x === 0x25BD || x === 0x25C0 || x === 0x25C1 || x >= 0x25C6 && x <= 0x25C8 || x === 0x25CB || x >= 0x25CE && x <= 0x25D1 || x >= 0x25E2 && x <= 0x25E5 || x === 0x25EF || x === 0x2605 || x === 0x2606 || x === 0x2609 || x === 0x260E || x === 0x260F || x === 0x261C || x === 0x261E || x === 0x2640 || x === 0x2642 || x === 0x2660 || x === 0x2661 || x >= 0x2663 && x <= 0x2665 || x >= 0x2667 && x <= 0x266A || x === 0x266C || x === 0x266D || x === 0x266F || x === 0x269E || x === 0x269F || x === 0x26BF || x >= 0x26C6 && x <= 0x26CD || x >= 0x26CF && x <= 0x26D3 || x >= 0x26D5 && x <= 0x26E1 || x === 0x26E3 || x === 0x26E8 || x === 0x26E9 || x >= 0x26EB && x <= 0x26F1 || x === 0x26F4 || x >= 0x26F6 && x <= 0x26F9 || x === 0x26FB || x === 0x26FC || x === 0x26FE || x === 0x26FF || x === 0x273D || x >= 0x2776 && x <= 0x277F || x >= 0x2B56 && x <= 0x2B59 || x >= 0x3248 && x <= 0x324F || x >= 0xE000 && x <= 0xF8FF || x >= 0xFE00 && x <= 0xFE0F || x === 0xFFFD || x >= 0x1F100 && x <= 0x1F10A || x >= 0x1F110 && x <= 0x1F12D || x >= 0x1F130 && x <= 0x1F169 || x >= 0x1F170 && x <= 0x1F18D || x === 0x1F18F || x === 0x1F190 || x >= 0x1F19B && x <= 0x1F1AC || x >= 0xE0100 && x <= 0xE01EF || x >= 0xF0000 && x <= 0xFFFFD || x >= 0x100000 && x <= 0x10FFFD;
}
function isFullWidth(x) {
  return x === 0x3000 || x >= 0xFF01 && x <= 0xFF60 || x >= 0xFFE0 && x <= 0xFFE6;
}
function isWide(x) {
  return x >= 0x1100 && x <= 0x115F || x === 0x231A || x === 0x231B || x === 0x2329 || x === 0x232A || x >= 0x23E9 && x <= 0x23EC || x === 0x23F0 || x === 0x23F3 || x === 0x25FD || x === 0x25FE || x === 0x2614 || x === 0x2615 || x >= 0x2648 && x <= 0x2653 || x === 0x267F || x === 0x2693 || x === 0x26A1 || x === 0x26AA || x === 0x26AB || x === 0x26BD || x === 0x26BE || x === 0x26C4 || x === 0x26C5 || x === 0x26CE || x === 0x26D4 || x === 0x26EA || x === 0x26F2 || x === 0x26F3 || x === 0x26F5 || x === 0x26FA || x === 0x26FD || x === 0x2705 || x === 0x270A || x === 0x270B || x === 0x2728 || x === 0x274C || x === 0x274E || x >= 0x2753 && x <= 0x2755 || x === 0x2757 || x >= 0x2795 && x <= 0x2797 || x === 0x27B0 || x === 0x27BF || x === 0x2B1B || x === 0x2B1C || x === 0x2B50 || x === 0x2B55 || x >= 0x2E80 && x <= 0x2E99 || x >= 0x2E9B && x <= 0x2EF3 || x >= 0x2F00 && x <= 0x2FD5 || x >= 0x2FF0 && x <= 0x2FFF || x >= 0x3001 && x <= 0x303E || x >= 0x3041 && x <= 0x3096 || x >= 0x3099 && x <= 0x30FF || x >= 0x3105 && x <= 0x312F || x >= 0x3131 && x <= 0x318E || x >= 0x3190 && x <= 0x31E3 || x >= 0x31EF && x <= 0x321E || x >= 0x3220 && x <= 0x3247 || x >= 0x3250 && x <= 0x4DBF || x >= 0x4E00 && x <= 0xA48C || x >= 0xA490 && x <= 0xA4C6 || x >= 0xA960 && x <= 0xA97C || x >= 0xAC00 && x <= 0xD7A3 || x >= 0xF900 && x <= 0xFAFF || x >= 0xFE10 && x <= 0xFE19 || x >= 0xFE30 && x <= 0xFE52 || x >= 0xFE54 && x <= 0xFE66 || x >= 0xFE68 && x <= 0xFE6B || x >= 0x16FE0 && x <= 0x16FE4 || x === 0x16FF0 || x === 0x16FF1 || x >= 0x17000 && x <= 0x187F7 || x >= 0x18800 && x <= 0x18CD5 || x >= 0x18D00 && x <= 0x18D08 || x >= 0x1AFF0 && x <= 0x1AFF3 || x >= 0x1AFF5 && x <= 0x1AFFB || x === 0x1AFFD || x === 0x1AFFE || x >= 0x1B000 && x <= 0x1B122 || x === 0x1B132 || x >= 0x1B150 && x <= 0x1B152 || x === 0x1B155 || x >= 0x1B164 && x <= 0x1B167 || x >= 0x1B170 && x <= 0x1B2FB || x === 0x1F004 || x === 0x1F0CF || x === 0x1F18E || x >= 0x1F191 && x <= 0x1F19A || x >= 0x1F200 && x <= 0x1F202 || x >= 0x1F210 && x <= 0x1F23B || x >= 0x1F240 && x <= 0x1F248 || x === 0x1F250 || x === 0x1F251 || x >= 0x1F260 && x <= 0x1F265 || x >= 0x1F300 && x <= 0x1F320 || x >= 0x1F32D && x <= 0x1F335 || x >= 0x1F337 && x <= 0x1F37C || x >= 0x1F37E && x <= 0x1F393 || x >= 0x1F3A0 && x <= 0x1F3CA || x >= 0x1F3CF && x <= 0x1F3D3 || x >= 0x1F3E0 && x <= 0x1F3F0 || x === 0x1F3F4 || x >= 0x1F3F8 && x <= 0x1F43E || x === 0x1F440 || x >= 0x1F442 && x <= 0x1F4FC || x >= 0x1F4FF && x <= 0x1F53D || x >= 0x1F54B && x <= 0x1F54E || x >= 0x1F550 && x <= 0x1F567 || x === 0x1F57A || x === 0x1F595 || x === 0x1F596 || x === 0x1F5A4 || x >= 0x1F5FB && x <= 0x1F64F || x >= 0x1F680 && x <= 0x1F6C5 || x === 0x1F6CC || x >= 0x1F6D0 && x <= 0x1F6D2 || x >= 0x1F6D5 && x <= 0x1F6D7 || x >= 0x1F6DC && x <= 0x1F6DF || x === 0x1F6EB || x === 0x1F6EC || x >= 0x1F6F4 && x <= 0x1F6FC || x >= 0x1F7E0 && x <= 0x1F7EB || x === 0x1F7F0 || x >= 0x1F90C && x <= 0x1F93A || x >= 0x1F93C && x <= 0x1F945 || x >= 0x1F947 && x <= 0x1F9FF || x >= 0x1FA70 && x <= 0x1FA7C || x >= 0x1FA80 && x <= 0x1FA88 || x >= 0x1FA90 && x <= 0x1FABD || x >= 0x1FABF && x <= 0x1FAC5 || x >= 0x1FACE && x <= 0x1FADB || x >= 0x1FAE0 && x <= 0x1FAE8 || x >= 0x1FAF0 && x <= 0x1FAF8 || x >= 0x20000 && x <= 0x2FFFD || x >= 0x30000 && x <= 0x3FFFD;
}

function validate(codePoint) {
  if (!Number.isSafeInteger(codePoint)) {
    throw new TypeError("Expected a code point, got `".concat(typeof codePoint, "`."));
  }
}
function eastAsianWidth(codePoint, {
  ambiguousAsWide = false
} = {}) {
  validate(codePoint);
  if (isFullWidth(codePoint) || isWide(codePoint) || ambiguousAsWide && isAmbiguous(codePoint)) {
    return 2;
  }
  return 1;
}

const emojiRegex = (() => {
  // https://mths.be/emoji
  return /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC2\uDECE-\uDEDB\uDEE0-\uDEE8]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g;
});

const segmenter = new Intl.Segmenter();
const defaultIgnorableCodePointRegex = /^(?:[\xAD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|[\uDB40-\uDB43][\uDC00-\uDFFF])$/;
function stringWidth(string, options = {}) {
  if (typeof string !== 'string' || string.length === 0) {
    return 0;
  }
  const {
    ambiguousIsNarrow = true,
    countAnsiEscapeCodes = false
  } = options;
  if (!countAnsiEscapeCodes) {
    string = stripAnsi(string);
  }
  if (string.length === 0) {
    return 0;
  }
  let width = 0;
  const eastAsianWidthOptions = {
    ambiguousAsWide: !ambiguousIsNarrow
  };
  for (const {
    segment: character
  } of segmenter.segment(string)) {
    const codePoint = character.codePointAt(0);

    // Ignore control characters
    if (codePoint <= 0x1F || codePoint >= 0x7F && codePoint <= 0x9F) {
      continue;
    }

    // Ignore zero-width characters
    if (codePoint >= 0x200B && codePoint <= 0x200F // Zero-width space, non-joiner, joiner, left-to-right mark, right-to-left mark
    || codePoint === 0xFEFF // Zero-width no-break space
    ) {
      continue;
    }

    // Ignore combining characters
    if (codePoint >= 0x300 && codePoint <= 0x36F // Combining diacritical marks
    || codePoint >= 0x1AB0 && codePoint <= 0x1AFF // Combining diacritical marks extended
    || codePoint >= 0x1DC0 && codePoint <= 0x1DFF // Combining diacritical marks supplement
    || codePoint >= 0x20D0 && codePoint <= 0x20FF // Combining diacritical marks for symbols
    || codePoint >= 0xFE20 && codePoint <= 0xFE2F // Combining half marks
    ) {
      continue;
    }

    // Ignore surrogate pairs
    if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
      continue;
    }

    // Ignore variation selectors
    if (codePoint >= 0xFE00 && codePoint <= 0xFE0F) {
      continue;
    }

    // This covers some of the above cases, but we still keep them for performance reasons.
    if (defaultIgnorableCodePointRegex.test(character)) {
      continue;
    }

    // TODO: Use `/\p{RGI_Emoji}/v` when targeting Node.js 20.
    if (emojiRegex().test(character)) {
      width += 2;
      continue;
    }
    width += eastAsianWidth(codePoint, eastAsianWidthOptions);
  }
  return width;
}

cleanup();
const measureStringWidth = stringWidth;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const createGetWellKnownValuePath = globalObject => {
  const wellKnownWeakMap = new WeakMap();
  const numberWellKnownMap = new Map();
  const symbolWellKnownMap = new Map();
  const getWellKnownValuePath = value => {
    if (!wellKnownWeakMap.size) {
      visitValue(globalObject, createValuePath());
      visitValue(AsyncFunction, createValuePath([{
        type: "identifier",
        value: "AsyncFunction"
      }]));
      visitValue(GeneratorFunction, createValuePath([{
        type: "identifier",
        value: "GeneratorFunction"
      }]));
      visitValue(AsyncGeneratorFunction, createValuePath([{
        type: "identifier",
        value: "AsyncGeneratorFunction"
      }]));
      for (const numberOwnPropertyName of Object.getOwnPropertyNames(Number)) {
        if (numberOwnPropertyName === "MAX_VALUE" || numberOwnPropertyName === "MIN_VALUE" || numberOwnPropertyName === "MAX_SAFE_INTEGER" || numberOwnPropertyName === "MIN_SAFE_INTEGER" || numberOwnPropertyName === "EPSILON") {
          numberWellKnownMap.set(Number[numberOwnPropertyName], [{
            type: "identifier",
            value: "Number"
          }, {
            type: "property_dot",
            value: "."
          }, {
            type: "property_identifier",
            value: numberOwnPropertyName
          }]);
        }
      }
      for (const mathOwnPropertyName of Object.getOwnPropertyNames(Math)) {
        if (mathOwnPropertyName === "E" || mathOwnPropertyName === "LN2" || mathOwnPropertyName === "LN10" || mathOwnPropertyName === "LOG2E" || mathOwnPropertyName === "LOG10E" || mathOwnPropertyName === "PI" || mathOwnPropertyName === "SQRT1_2" || mathOwnPropertyName === "SQRT2") {
          numberWellKnownMap.set(Math[mathOwnPropertyName], [{
            type: "identifier",
            value: "Math"
          }, {
            type: "property_dot",
            value: "."
          }, {
            type: "property_identifier",
            value: mathOwnPropertyName
          }]);
        }
      }
    }
    if (typeof value === "symbol") {
      return symbolWellKnownMap.get(value);
    }
    if (typeof value === "number") {
      return numberWellKnownMap.get(value);
    }
    return wellKnownWeakMap.get(value);
  };
  const AsyncFunction = async function () {}.constructor;
  const GeneratorFunction = function* () {}.constructor;
  const AsyncGeneratorFunction = async function* () {}.constructor;
  const visitValue = (value, valuePath) => {
    if (typeof value === "symbol") {
      symbolWellKnownMap.set(value, valuePath);
      return;
    }
    if (!isComposite(value)) {
      return;
    }
    if (wellKnownWeakMap.has(value)) {
      // prevent infinite recursion on circular structures
      return;
    }
    wellKnownWeakMap.set(value, valuePath);
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
        visitValue(propertyValue, valuePath.append(property));
      }
    };
    for (const property of Object.getOwnPropertyNames(value)) {
      visitProperty(property);
    }
    for (const symbol of Object.getOwnPropertySymbols(value)) {
      visitProperty(symbol);
    }
    if (isComposite(value)) {
      const protoValue = Object.getPrototypeOf(value);
      if (protoValue && !wellKnownWeakMap.has(protoValue)) {
        visitValue(protoValue, valuePath.append("__proto__"));
      }
    }
  };
  return getWellKnownValuePath;
};

const assert = createAssert({
  measureStringWidth,
  getWellKnownValuePath: createGetWellKnownValuePath(window)
});

export { assert };
