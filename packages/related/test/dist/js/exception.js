/*
 * Link to things doing pattern matching:
 * https://git-scm.com/docs/gitignore
 * https://github.com/kaelzhang/node-ignore
 */

/** @module jsenv_url_meta **/
/**
 * An object representing the result of applying a pattern to an url
 * @typedef {Object} MatchResult
 * @property {boolean} matched Indicates if url matched pattern
 * @property {number} patternIndex Index where pattern stopped matching url, otherwise pattern.length
 * @property {number} urlIndex Index where url stopped matching pattern, otherwise url.length
 * @property {Array} matchGroups Array of strings captured during pattern matching
 */

/**
 * Apply a pattern to an url
 * @param {Object} applyPatternMatchingParams
 * @param {string} applyPatternMatchingParams.pattern "*", "**" and trailing slash have special meaning
 * @param {string} applyPatternMatchingParams.url a string representing an url
 * @return {MatchResult}
 */
const applyPattern = ({ url, pattern }) => {
  const { matched, patternIndex, index, groups } = applyMatching(pattern, url);
  const matchGroups = [];
  let groupIndex = 0;
  for (const group of groups) {
    if (group.name) {
      matchGroups[group.name] = group.string;
    } else {
      matchGroups[groupIndex] = group.string;
      groupIndex++;
    }
  }
  return {
    matched,
    patternIndex,
    urlIndex: index,
    matchGroups,
  };
};

const applyMatching = (pattern, string) => {
  const groups = [];
  let patternIndex = 0;
  let index = 0;
  let remainingPattern = pattern;
  let remainingString = string;
  let restoreIndexes = true;

  const consumePattern = (count) => {
    const subpattern = remainingPattern.slice(0, count);
    remainingPattern = remainingPattern.slice(count);
    patternIndex += count;
    return subpattern;
  };
  const consumeString = (count) => {
    const substring = remainingString.slice(0, count);
    remainingString = remainingString.slice(count);
    index += count;
    return substring;
  };
  const consumeRemainingString = () => {
    return consumeString(remainingString.length);
  };

  let matched;
  const iterate = () => {
    const patternIndexBefore = patternIndex;
    const indexBefore = index;
    matched = matchOne();
    if (matched === undefined) {
      consumePattern(1);
      consumeString(1);
      iterate();
      return;
    }
    if (matched === false && restoreIndexes) {
      patternIndex = patternIndexBefore;
      index = indexBefore;
    }
  };
  const matchOne = () => {
    // pattern consumed and string consumed
    if (remainingPattern === "" && remainingString === "") {
      return true; // string fully matched pattern
    }
    // pattern consumed, string not consumed
    if (remainingPattern === "" && remainingString !== "") {
      return false; // fails because string longer than expect
    }
    // -- from this point pattern is not consumed --
    // string consumed, pattern not consumed
    if (remainingString === "") {
      if (remainingPattern === "**") {
        // trailing "**" is optional
        consumePattern(2);
        return true;
      }
      if (remainingPattern === "*") {
        groups.push({ string: "" });
      }
      return false; // fail because string shorter than expect
    }
    // -- from this point pattern and string are not consumed --
    // fast path trailing slash
    if (remainingPattern === "/") {
      if (remainingString[0] === "/") {
        // trailing slash match remaining
        consumePattern(1);
        groups.push({ string: consumeRemainingString() });
        return true;
      }
      return false;
    }
    // fast path trailing '**'
    if (remainingPattern === "**") {
      consumePattern(2);
      consumeRemainingString();
      return true;
    }
    // pattern leading **
    if (remainingPattern.slice(0, 2) === "**") {
      consumePattern(2); // consumes "**"
      let skipAllowed = true;
      if (remainingPattern[0] === "/") {
        consumePattern(1); // consumes "/"
        // when remainingPattern was preceeded by "**/"
        // and remainingString have no "/"
        // then skip is not allowed, a regular match will be performed
        if (!remainingString.includes("/")) {
          skipAllowed = false;
        }
      }
      // pattern ending with "**" or "**/" match remaining string
      if (remainingPattern === "") {
        consumeRemainingString();
        return true;
      }
      if (skipAllowed) {
        const skipResult = skipUntilMatch({
          pattern: remainingPattern,
          string: remainingString,
          canSkipSlash: true,
        });
        groups.push(...skipResult.groups);
        consumePattern(skipResult.patternIndex);
        consumeRemainingString();
        restoreIndexes = false;
        return skipResult.matched;
      }
    }
    if (remainingPattern[0] === "*") {
      consumePattern(1); // consumes "*"
      if (remainingPattern === "") {
        // matches everything except "/"
        const slashIndex = remainingString.indexOf("/");
        if (slashIndex === -1) {
          groups.push({ string: consumeRemainingString() });
          return true;
        }
        groups.push({ string: consumeString(slashIndex) });
        return false;
      }
      // the next char must not the one expect by remainingPattern[0]
      // because * is greedy and expect to skip at least one char
      if (remainingPattern[0] === remainingString[0]) {
        groups.push({ string: "" });
        patternIndex = patternIndex - 1;
        return false;
      }
      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: false,
      });
      groups.push(skipResult.group, ...skipResult.groups);
      consumePattern(skipResult.patternIndex);
      consumeString(skipResult.index);
      restoreIndexes = false;
      return skipResult.matched;
    }
    if (remainingPattern[0] !== remainingString[0]) {
      return false;
    }
    return undefined;
  };
  iterate();

  return {
    matched,
    patternIndex,
    index,
    groups,
  };
};

const skipUntilMatch = ({ pattern, string, canSkipSlash }) => {
  let index = 0;
  let remainingString = string;
  let longestAttemptRange = null;
  let isLastAttempt = false;

  const failure = () => {
    return {
      matched: false,
      patternIndex: longestAttemptRange.patternIndex,
      index: longestAttemptRange.index + longestAttemptRange.length,
      groups: longestAttemptRange.groups,
      group: {
        string: string.slice(0, longestAttemptRange.index),
      },
    };
  };

  const tryToMatch = () => {
    const matchAttempt = applyMatching(pattern, remainingString);
    if (matchAttempt.matched) {
      return {
        matched: true,
        patternIndex: matchAttempt.patternIndex,
        index: index + matchAttempt.index,
        groups: matchAttempt.groups,
        group: {
          string:
            remainingString === ""
              ? string
              : string.slice(0, -remainingString.length),
        },
      };
    }
    const attemptIndex = matchAttempt.index;
    const attemptRange = {
      patternIndex: matchAttempt.patternIndex,
      index,
      length: attemptIndex,
      groups: matchAttempt.groups,
    };
    if (
      !longestAttemptRange ||
      longestAttemptRange.length < attemptRange.length
    ) {
      longestAttemptRange = attemptRange;
    }
    if (isLastAttempt) {
      return failure();
    }
    const nextIndex = attemptIndex + 1;
    if (nextIndex >= remainingString.length) {
      return failure();
    }
    if (remainingString[0] === "/") {
      if (!canSkipSlash) {
        return failure();
      }
      // when it's the last slash, the next attempt is the last
      if (remainingString.indexOf("/", 1) === -1) {
        isLastAttempt = true;
      }
    }
    // search against the next unattempted string
    index += nextIndex;
    remainingString = remainingString.slice(nextIndex);
    return tryToMatch();
  };
  return tryToMatch();
};

const applyPatternMatching = ({ url, pattern }) => {
  assertUrlLike(pattern, "pattern");
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url, "url");
  return applyPattern({ url, pattern });
};

const resolveAssociations = (associations, baseUrl) => {
  if (baseUrl && typeof baseUrl.href === "string") baseUrl = baseUrl.href;
  assertUrlLike(baseUrl, "baseUrl");

  const associationsResolved = {};
  for (const key of Object.keys(associations)) {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      for (const pattern of Object.keys(value)) {
        const valueAssociated = value[pattern];
        let patternResolved;
        try {
          patternResolved = String(new URL(pattern, baseUrl));
        } catch (e) {
          // it's not really an url, no need to perform url resolution nor encoding
          patternResolved = pattern;
        }

        valueMapResolved[patternResolved] = valueAssociated;
      }
      associationsResolved[key] = valueMapResolved;
    } else {
      associationsResolved[key] = value;
    }
  }
  return associationsResolved;
};

const asFlatAssociations = (associations) => {
  if (!isPlainObject(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    );
  }
  const flatAssociations = {};
  for (const associationName of Object.keys(associations)) {
    const associationValue = associations[associationName];
    if (!isPlainObject(associationValue)) {
      continue;
    }
    for (const pattern of Object.keys(associationValue)) {
      const patternValue = associationValue[pattern];
      const previousValue = flatAssociations[pattern];
      if (isPlainObject(previousValue)) {
        flatAssociations[pattern] = {
          ...previousValue,
          [associationName]: patternValue,
        };
      } else {
        flatAssociations[pattern] = {
          [associationName]: patternValue,
        };
      }
    }
  }
  return flatAssociations;
};

const applyAssociations = ({ url, associations }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url);
  const flatAssociations = asFlatAssociations(associations);
  let associatedValue = {};
  for (const pattern of Object.keys(flatAssociations)) {
    const { matched } = applyPatternMatching({
      pattern,
      url,
    });
    if (matched) {
      const value = flatAssociations[pattern];
      associatedValue = deepAssign(associatedValue, value);
    }
  }
  return associatedValue;
};

const deepAssign = (firstValue, secondValue) => {
  if (!isPlainObject(firstValue) || !isPlainObject(secondValue)) {
    return secondValue;
  }
  for (const key of Object.keys(secondValue)) {
    const leftValue = firstValue[key];
    const rightValue = secondValue[key];
    firstValue[key] = deepAssign(leftValue, rightValue);
  }
  return firstValue;
};

const urlChildMayMatch = ({ url, associations, predicate }) => {
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url, "url");
  // the function was meants to be used on url ending with '/'
  if (!url.endsWith("/")) {
    throw new Error(`url should end with /, got ${url}`);
  }
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }
  const flatAssociations = asFlatAssociations(associations);
  // for full match we must create an object to allow pattern to override previous ones
  let fullMatchMeta = {};
  let someFullMatch = false;
  // for partial match, any meta satisfying predicate will be valid because
  // we don't know for sure if pattern will still match for a file inside pathname
  const partialMatchMetaArray = [];
  for (const pattern of Object.keys(flatAssociations)) {
    const value = flatAssociations[pattern];
    const matchResult = applyPatternMatching({
      pattern,
      url,
    });
    if (matchResult.matched) {
      someFullMatch = true;
      if (isPlainObject(fullMatchMeta) && isPlainObject(value)) {
        fullMatchMeta = {
          ...fullMatchMeta,
          ...value,
        };
      } else {
        fullMatchMeta = value;
      }
    } else if (someFullMatch === false && matchResult.urlIndex >= url.length) {
      partialMatchMetaArray.push(value);
    }
  }
  if (someFullMatch) {
    return Boolean(predicate(fullMatchMeta));
  }
  return partialMatchMetaArray.some((partialMatchMeta) =>
    predicate(partialMatchMeta),
  );
};

const applyAliases = ({ url, aliases }) => {
  let aliasFullMatchResult;
  const aliasMatchingKey = Object.keys(aliases).find((key) => {
    const aliasMatchResult = applyPatternMatching({
      pattern: key,
      url,
    });
    if (aliasMatchResult.matched) {
      aliasFullMatchResult = aliasMatchResult;
      return true;
    }
    return false;
  });
  if (!aliasMatchingKey) {
    return url;
  }
  const { matchGroups } = aliasFullMatchResult;
  const alias = aliases[aliasMatchingKey];
  const parts = alias.split("*");
  let newUrl = "";
  let index = 0;
  for (const part of parts) {
    newUrl += `${part}`;
    if (index < parts.length - 1) {
      newUrl += matchGroups[index];
    }
    index++;
  }
  return newUrl;
};

const matches = (url, patterns) => {
  return Boolean(
    applyAssociations({
      url,
      associations: {
        yes: patterns,
      },
    }).yes,
  );
};

// const assertSpecifierMetaMap = (value, checkComposition = true) => {
//   if (!isPlainObject(value)) {
//     throw new TypeError(
//       `specifierMetaMap must be a plain object, got ${value}`,
//     );
//   }
//   if (checkComposition) {
//     const plainObject = value;
//     Object.keys(plainObject).forEach((key) => {
//       assertUrlLike(key, "specifierMetaMap key");
//       const value = plainObject[key];
//       if (value !== null && !isPlainObject(value)) {
//         throw new TypeError(
//           `specifierMetaMap value must be a plain object or null, got ${value} under key ${key}`,
//         );
//       }
//     });
//   }
// };
const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(
      `${name} must be a url but looks like a windows pathname, got ${value}`,
    );
  }
  if (!hasScheme(value)) {
    throw new TypeError(
      `${name} must be a url and no scheme found, got ${value}`,
    );
  }
};
const isPlainObject = (value) => {
  if (value === null) {
    return false;
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return false;
    }
    return true;
  }
  return false;
};
const isWindowsPathnameSpecifier = (specifier) => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/" || thirdChar === "\\";
};
const hasScheme = (specifier) => /^[a-zA-Z]+:/.test(specifier);

const URL_META = {
  resolveAssociations,
  applyAssociations,
  applyAliases,
  applyPatternMatching,
  urlChildMayMatch,
  matches,
};

function createRawFrame(raw) {
    return {
        column: -1,
        fileName: "",
        line: -1,
        name: "",
        raw: raw,
        sourceColumn: -1,
        sourceFileName: "",
        sourceLine: -1,
        type: "",
    };
}
var FIREFOX_WEBKIT = /([^@]+|^)@(.*):(\d+):(\d+)/;
var WEBKIT_ADDRESS_UNNAMED = /^(http(s)?:\/\/.*):(\d+):(\d+)$/;
var WEBKIT_NATIVE_UNNAMED = "[native code]";
function parsWebkit(str) {
    if (str.includes(WEBKIT_NATIVE_UNNAMED)) {
        return {
            line: -1,
            column: -1,
            type: "native",
            fileName: "",
            name: "",
            raw: str,
            sourceColumn: -1,
            sourceFileName: "",
            sourceLine: -1,
        };
    }
    var match = str.match(WEBKIT_ADDRESS_UNNAMED);
    if (match) {
        var line = match[3] ? +match[3] : -1;
        var column = match[4] ? +match[4] : -1;
        var fileName = match[1] ? match[1] : "";
        return {
            line: line,
            column: column,
            type: "",
            fileName: fileName,
            name: "",
            raw: str,
            sourceColumn: -1,
            sourceFileName: "",
            sourceLine: -1,
        };
    }
    return createRawFrame(str);
}
function parseFirefoxWebkit(lines) {
    return lines.map(function (str) {
        var match = str.match(FIREFOX_WEBKIT);
        if (!match) {
            return parsWebkit(str);
        }
        var line = match[3] ? +match[3] : -1;
        var column = match[4] ? +match[4] : -1;
        var fileName = match[2] ? match[2] : "";
        return {
            line: line,
            column: column,
            type: match[0] ? "" : "native",
            fileName: fileName,
            name: (match[1] || "").trim(),
            raw: str,
            sourceColumn: -1,
            sourceFileName: "",
            sourceLine: -1,
        };
    });
}
// foo.bar.js:123:39
// foo.bar.js:123:39 <- original.js:123:34
var CHROME_MAPPED = /(.*?):(\d+):(\d+)(\s<-\s(.+):(\d+):(\d+))?/;
function parseMapped(frame, maybeMapped) {
    var match = maybeMapped.match(CHROME_MAPPED);
    if (match) {
        frame.fileName = match[1];
        frame.line = +match[2];
        frame.column = +match[3];
        if (match[5])
            frame.sourceFileName = match[5];
        if (match[6])
            frame.sourceLine = +match[6];
        if (match[7])
            frame.sourceColumn = +match[7];
    }
}
// at <SomeFramework>
var CHROME_IE_NATIVE_NO_LINE = /^at\s(<.*>)$/;
// at <SomeFramework>:123:39
var CHROME_IE_NATIVE = /^\s*at\s(<.*>):(\d+):(\d+)$/;
// at foo.bar(bob) (foo.bar.js:123:39)
// at foo.bar(bob) (foo.bar.js:123:39 <- original.js:123:34)
var CHROME_IE_FUNCTION = /^at\s(.*)\s\((.*)\)$/;
// >= Chrome 88
// spy() at Component.Foo [as constructor] (original.js:123:34)
// spy() at Component.Foo [as constructor] (foo.bar.js:123:39 <- original.js:123:34)
var CHROME_IE_FUNCTION_WITH_CALL = /^([\w\W]*)\s\((.*)\)/;
var CHROME_IE_DETECTOR = /\s*at\s.+/;
// at about:blank:1:7
// >= Chrome 99
// at /projects/foo.test.js:689:1 <- /projects/foo.test.js:10:1
var CHROME_BLANK = /\s*at\s(.*):(\d+):(\d+)$/;
function parseChromeIe(lines) {
    // Many frameworks mess with error.stack. So we use this check
    // to find the first line of the actual stack
    var start = lines.findIndex(function (line) { return CHROME_IE_DETECTOR.test(line); });
    if (start === -1) {
        return [];
    }
    var frames = [];
    for (var i = start; i < lines.length; i++) {
        var str = lines[i].replace(/^\s+|\s+$/g, "");
        var frame = createRawFrame(lines[i]);
        var nativeNoLine = str.match(CHROME_IE_NATIVE_NO_LINE);
        if (nativeNoLine) {
            frame.fileName = nativeNoLine[1];
            frame.type = "native";
            frames.push(frame);
            continue;
        }
        var native = str.match(CHROME_IE_NATIVE);
        if (native) {
            frame.fileName = native[1];
            frame.type = "native";
            if (native[2])
                frame.line = +native[2];
            if (native[3])
                frame.column = +native[3];
            frames.push(frame);
            continue;
        }
        var withFn = str.match(CHROME_IE_FUNCTION);
        if (withFn) {
            frame.name = withFn[1];
            parseMapped(frame, withFn[2]);
            frames.push(frame);
            continue;
        }
        var blank = str.match(CHROME_BLANK);
        if (blank) {
            frame.fileName = blank[1];
            frame.line = +blank[2];
            frame.column = +blank[3];
            parseMapped(frame, blank[1] + ":" + blank[2] + ":" + blank[3]);
            frames.push(frame);
            continue;
        }
        var withFnCall = str.match(CHROME_IE_FUNCTION_WITH_CALL);
        if (withFnCall) {
            frame.name = withFnCall[1];
            parseMapped(frame, withFnCall[2]);
            frames.push(frame);
            continue;
        }
        frames.push(frame);
    }
    return frames;
}
function parseStackTrace(stack) {
    if (!stack)
        return [];
    var lines = stack.split("\n").filter(Boolean);
    // Libraries like node's "assert" module mess with the stack trace by
    // prepending custom data. So we need to do a precheck, to determine
    // which browser the trace is coming from.
    if (lines.some(function (line) { return CHROME_IE_DETECTOR.test(line); })) {
        return parseChromeIe(lines);
    }
    return parseFirefoxWebkit(lines);
}

/*
 * Exception are objects used to wrap a value that is thrown
 * Usually they wrap error but the value can be anything as
 * throw "toto" can be used in JS
 *
 * - provide a common API to interact with value that can be thrown
 * - enrich usual errors with a bit more information (line, column)
 * - normalize error properties
 *   - exception.stackTrace: only the stack trace as string (no error.name or error.message)
 *   - error.stack: error.name + error.message + error.stackTrace
 *
 * It is used mostly internally by jsenv but can also be found
 * value returned by "executeTestPlan" public export (for failed executions)
 * and value returned by "execute" public export (when execution fails)
 *
 * This file is responsible to wrap error hapenning in Node.js runtime
 * The browser part can be found in "supervisor.js"
 */


const isDev = process.execArgv.includes("--conditions=development");
const jsenvCoreDirectoryUrl = new URL("file:///Users/damien.maillard/dev/perso/jsenv-core/", import.meta.url);

const createException = (reason, { rootDirectoryUrl } = {}) => {
  const exception = {
    isException: true,
    isError: false,
    name: "",
    message: "",
    stack: "",
    stackTrace: "",
    stackFrames: undefined,
    site: null,
  };

  if (reason === undefined) {
    exception.message = "undefined";
    return exception;
  }
  if (reason === null) {
    exception.message = "null";
    return exception;
  }
  if (typeof reason === "string") {
    exception.message = reason;
    return exception;
  }
  if (typeof reason !== "object") {
    exception.message = JSON.stringify(reason);
    return exception;
  }
  if (reason.stackFrames === undefined && "stack" in reason) {
    let stackFrames;

    const { prepareStackTrace } = Error;
    Error.prepareStackTrace = (e, callSites) => {
      Error.prepareStackTrace = prepareStackTrace;

      stackFrames = [];
      for (const callSite of callSites) {
        const stackFrame = {
          raw: `  at ${String(callSite)}`,
          url: callSite.getFileName() || callSite.getScriptNameOrSourceURL(),
          line: callSite.getLineNumber(),
          column: callSite.getColumnNumber(),
          functionName: callSite.getFunctionName(),
          isNative: callSite.isNative(),
          isEval: callSite.isEval(),
          isConstructor: callSite.isConstructor(),
          isAsync: callSite.isAsync(),
          evalSite: null,
        };
        if (stackFrame.isEval) {
          const evalOrigin = stackFrame.getEvalOrigin();
          if (evalOrigin) {
            stackFrame.evalSite = getPropertiesFromEvalOrigin(evalOrigin);
          }
        }
        stackFrames.push(stackFrame);
      }
      return "";
    };
    exception.stack = reason.stack;
    if (stackFrames === undefined) {
      // Error.prepareStackTrace not trigerred
      // - reason is not an error
      // - reason.stack already get
      Error.prepareStackTrace = prepareStackTrace;

      const calls = parseStackTrace(reason.stack);
      stackFrames = [];
      for (const call of calls) {
        if (call.fileName === "") {
          continue;
        }
        stackFrames.push({
          raw: call.raw,
          functionName: call.name,
          url: call.fileName,
          line: call.line,
          column: call.column,
          native: call.type === "native",
        });
      }
    }

    const stackFramesNonNative = [];
    for (const stackFrame of stackFrames) {
      if (stackFrame.url.startsWith("node:")) {
        stackFrame.native = "node";
        continue;
      }
      if (stackFrame.url.startsWith("file:")) {
        if (rootDirectoryUrl && stackFrame.url.startsWith(rootDirectoryUrl)) {
          stackFramesNonNative.push(stackFrame);
          continue;
        }

        if (isDev) {
          // while developing jsenv itself we want to exclude any
          // - src/*
          // - packages/**/src/
          // for the users of jsenv it's easier, we want to exclude
          // - **/node_modules/@jsenv/**
          if (
            URL_META.matches(stackFrame.url, {
              [`${jsenvCoreDirectoryUrl}src/`]: true,
              [`${jsenvCoreDirectoryUrl}packages/**/src/`]: true,
            })
          ) {
            stackFrame.native = "jsenv";
            continue;
          }
        } else if (
          URL_META.matches(stackFrame.url, {
            "file:///**/node_modules/@jsenv/core/": true,
          })
        ) {
          stackFrame.native = "jsenv";
          continue;
        }
      }
      stackFramesNonNative.push(stackFrame);
    }
    if (stackFramesNonNative.length) {
      stackFrames = stackFramesNonNative;
    }

    reason.stackFrames = stackFrames;

    let stackTrace = "";
    for (const stackFrame of stackFrames) {
      if (stackTrace) stackTrace += "\n";
      stackTrace += stackFrame.raw;
    }
    reason.stackTrace = stackTrace;
    let stack = "";
    const name = getErrorName(reason);
    const message = reason.message || "";
    stack += `${name}: ${message}`;
    if (stackTrace) {
      stack += `\n${stackTrace}`;
    }
    reason.stack = stack;

    const [firstCallFrame] = stackFrames;
    if (firstCallFrame && (!reason.site || !reason.site.isInline)) {
      reason.site = firstCallFrame.url
        ? {
            url: firstCallFrame.url,
            line: firstCallFrame.line,
            column: firstCallFrame.column,
          }
        : firstCallFrame.evalSite;
    }
  }
  // getOwnPropertyNames to catch non enumerable properties on reason
  // (happens mostly when reason is instanceof Error)
  // like .stack, .message
  // some properties are even on the prototype like .name
  for (const ownPropertyName of Object.getOwnPropertyNames(reason)) {
    exception[ownPropertyName] = reason[ownPropertyName];
  }
  const isError = reason instanceof Error;
  exception.isError = isError;
  if (isError) {
    // getOwnPropertyNames is not enough to copy .name and .message
    // on error instances
    exception.name = getErrorName(reason);
    exception.message = reason.message;
  }
  return exception;
};

const getErrorName = (value) => {
  const { constructor } = value;
  if (constructor) {
    if (constructor.name !== "Object") {
      return constructor.name;
    }
  }
  return value.name || "Error";
};

const getPropertiesFromEvalOrigin = (origin) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(
    origin,
  );
  if (topLevelEvalMatch) {
    const source = topLevelEvalMatch[2];
    const line = Number(topLevelEvalMatch[3]);
    const column = topLevelEvalMatch[4] - 1;
    return {
      url: source,
      line,
      column,
    };
  }
  // Parse nested eval() calls using recursion
  const nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
  if (nestedEvalMatch) {
    return getPropertiesFromEvalOrigin(nestedEvalMatch[2]);
  }
  return null;
};

export { URL_META, createException };
