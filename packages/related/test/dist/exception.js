import { parseStackTrace } from "./jsenv_test_node_modules.js";
import { pathToFileURL } from "node:url";

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

/**
 * Core pattern matching function that processes patterns against strings
 * @param {string} pattern - The pattern with special syntax (*,**,/) to match against
 * @param {string} string - The string to test against the pattern
 * @returns {Object} Result containing match status and capture groups
 * @private
 */
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

  const matchOne = () => {
    // pattern consumed
    if (remainingPattern === "") {
      if (remainingString === "") {
        return true; // string fully matched pattern
      }
      if (remainingString[0] === "?") {
        // match search params
        consumeRemainingString();
        return true;
      }
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

    if (remainingPattern.slice(0, 4) === "/**/") {
      consumePattern(3); // consumes "/**/"
      const skipResult = skipUntilMatchIterative({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: true,
      });
      for (let i = 0; i < skipResult.groups.length; i++) {
        groups.push(skipResult.groups[i]);
      }
      consumePattern(skipResult.patternIndex);
      consumeRemainingString();
      restoreIndexes = false;
      return skipResult.matched;
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
        if (remainingString.includes("/")) {
          skipAllowed = false;
        }
      }
      // pattern ending with "**" or "**/" match remaining string
      if (remainingPattern === "") {
        consumeRemainingString();
        return true;
      }
      if (skipAllowed) {
        const skipResult = skipUntilMatchIterative({
          pattern: remainingPattern,
          string: remainingString,
          canSkipSlash: true,
        });
        for (let i = 0; i < skipResult.groups.length; i++) {
          groups.push(skipResult.groups[i]);
        }
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
      const skipResult = skipUntilMatchIterative({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: false,
      });
      groups.push(skipResult.group);
      for (let i = 0; i < skipResult.groups.length; i++) {
        groups.push(skipResult.groups[i]);
      }
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

  // Replace recursive iterate() with iterative approach
  let matched;
  let continueIteration = true;

  while (continueIteration) {
    const patternIndexBefore = patternIndex;
    const indexBefore = index;

    matched = matchOne();

    if (matched === undefined) {
      consumePattern(1);
      consumeString(1);
      // Continue the loop instead of recursion
      continue;
    }

    if (matched === false && restoreIndexes) {
      patternIndex = patternIndexBefore;
      index = indexBefore;
    }

    // End the loop
    continueIteration = false;
  }

  return {
    matched,
    patternIndex,
    index,
    groups,
  };
};

/**
 * Iterative version of skipUntilMatch that avoids recursion
 * @param {Object} params
 * @param {string} params.pattern - The pattern to match
 * @param {string} params.string - The string to test against
 * @param {boolean} params.canSkipSlash - Whether slash characters can be skipped
 * @returns {Object} Result of the matching attempt
 */
const skipUntilMatchIterative = ({ pattern, string, canSkipSlash }) => {
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

  // Loop until a match is found or all attempts fail
  while (true) {
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
  }
};

const applyPatternMatching = ({ url, pattern }) => {
  assertUrlLike(pattern, "pattern");
  if (url && typeof url.href === "string") url = url.href;
  assertUrlLike(url, "url");
  return applyPattern({ url, pattern });
};

const resolveAssociations = (associations, resolver) => {
  let resolve = () => {};
  if (typeof resolver === "function") {
    resolve = resolver;
  } else if (typeof resolver === "string") {
    const baseUrl = resolver;
    assertUrlLike(baseUrl, "baseUrl");
    resolve = (pattern) => new URL(pattern, baseUrl).href;
  } else if (resolver && typeof resolver.href === "string") {
    const baseUrl = resolver.href;
    assertUrlLike(baseUrl, "baseUrl");
    resolve = (pattern) => new URL(pattern, baseUrl).href;
  }

  const associationsResolved = {};
  for (const key of Object.keys(associations)) {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      for (const pattern of Object.keys(value)) {
        const valueAssociated = value[pattern];
        let patternResolved;
        try {
          patternResolved = resolve(pattern);
        } catch {
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
  if (!isPlainObject(firstValue)) {
    if (isPlainObject(secondValue)) {
      return deepAssign({}, secondValue);
    }
    return secondValue;
  }
  if (!isPlainObject(secondValue)) {
    return secondValue;
  }
  for (const key of Object.keys(secondValue)) {
    const leftPopertyValue = firstValue[key];
    const rightPropertyValue = secondValue[key];
    firstValue[key] = deepAssign(leftPopertyValue, rightPropertyValue);
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
  for (const key of Object.keys(aliases)) {
    const matchResult = applyPatternMatching({
      pattern: key,
      url,
    });
    if (!matchResult.matched) {
      continue;
    }
    const { matchGroups } = matchResult;
    const alias = aliases[key];
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
  }
  return url;
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

const createFilter = (patterns, url, map = (v) => v) => {
  const associations = resolveAssociations(
    {
      yes: patterns,
    },
    url,
  );
  return (url) => {
    const meta = applyAssociations({ url, associations });
    return Boolean(map(meta.yes));
  };
};

const URL_META = {
  resolveAssociations,
  applyAssociations,
  applyAliases,
  applyPatternMatching,
  urlChildMayMatch,
  matches,
  createFilter,
};

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


const isDev = process.execArgv.some(
  (arg) =>
    arg.includes("--conditions=development") ||
    arg.includes("--conditions=dev:"),
);

const createException = (
  reason,
  {
    jsenvCoreDirectoryUrl = new URL("../../../../../", import.meta.url),
    rootDirectoryUrl,
    errorTransform = () => {},
  } = {},
) => {
  const exception = {
    runtime: "node",
    originalRuntime: "node",
    isException: true,
    isError: false,
    name: "",
    message: "",
    stackTrace: "",
    stack: "",
    stackFrames: undefined,
    site: null,
    ownProps: {},
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
  errorTransform(reason);
  const isError = reason instanceof Error;
  if (reason.isException) {
    if (isError) {
      // see "normalizeRuntimeError" in run.js
      for (const key of Object.getOwnPropertyNames(reason)) {
        exception[key] = reason[key];
      }
    } else {
      Object.assign(exception, reason);
    }
    if (reason.runtime === "browser") {
      const { stackFrames, stackTrace, stack, site } = getStackInfo(reason, {
        name: reason.name,
        rootDirectoryUrl,
        jsenvCoreDirectoryUrl,
      });
      exception.stackFrames = stackFrames;
      exception.stackTrace = stackTrace;
      exception.stack = stack;
      exception.site = site;
      exception.runtime = "node";
      exception.originalRuntime = "browser";
    }
    return exception;
  }
  exception.isError = isError;
  const name = getErrorName(reason, isError);
  if ("stack" in reason) {
    const { stackFrames, stackTrace, stack, site } = getStackInfo(reason, {
      name: reason.name,
      rootDirectoryUrl,
      jsenvCoreDirectoryUrl,
    });
    exception.stackFrames = stackFrames;
    exception.stackTrace = stackTrace;
    exception.stack = stack;
    exception.site = site;
  }
  // getOwnPropertyNames to catch non enumerable properties on reason
  // (happens mostly when reason is instanceof Error)
  // like .stack, .message
  // some properties are even on the prototype like .name
  const ownKeySet = new Set(Object.keys(reason));
  if (isError) {
    // getOwnPropertyNames is not enough to copy .name and .message
    // on error instances
    exception.name = name;
    exception.message = reason.message;
    ownKeySet.delete("__INTERNAL_ERROR__");
    ownKeySet.delete("name");
    ownKeySet.delete("message");
    ownKeySet.delete("stack");
    if (reason.cause) {
      ownKeySet.delete("cause");
      const causeException = createException(reason.cause, {
        jsenvCoreDirectoryUrl,
        rootDirectoryUrl,
        errorTransform,
      });
      exception.ownProps["[cause]"] = causeException;
    }
  }
  for (const ownKey of ownKeySet) {
    exception.ownProps[ownKey] = reason[ownKey];
  }
  return exception;
};

const getStackInfo = (
  reason,
  { name, rootDirectoryUrl, jsenvCoreDirectoryUrl },
) => {
  let stack;
  let stackFrames;
  if (reason.isException) {
    stack = reason.stack;
  } else {
    const { prepareStackTrace } = Error;
    Error.prepareStackTrace = (e, callSites) => {
      Error.prepareStackTrace = prepareStackTrace;
      stackFrames = [];
      for (const callSite of callSites) {
        const isNative = callSite.isNative();
        const stackFrame = {
          raw: `  at ${String(callSite)}`,
          url: asFileUrl(
            callSite.getFileName() || callSite.getScriptNameOrSourceURL(),
            { isNative },
          ),
          line: callSite.getLineNumber(),
          column: callSite.getColumnNumber(),
          functionName: callSite.getFunctionName(),
          isNative,
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
    stack = reason.stack;
    if (stackFrames === undefined) {
      // Error.prepareStackTrace not trigerred
      // - reason is not an error
      // - reason.stack already get
      Error.prepareStackTrace = prepareStackTrace;
    }
  }
  if (stackFrames === undefined) {
    if (reason.stackFrames) {
      stackFrames = reason.stackFrames;
    } else {
      const calls = parseStackTrace(stack);
      stackFrames = [];
      for (const call of calls) {
        if (call.fileName === "") {
          continue;
        }
        const isNative = call.type === "native";
        stackFrames.push({
          raw: call.raw,
          functionName: call.name,
          url: asFileUrl(call.fileName, { isNative }),
          line: call.line,
          column: call.column,
          isNative,
        });
      }
    }
  }
  if (reason.__INTERNAL_ERROR__) {
    stackFrames = [];
  } else {
    const stackFrameInternalArray = [];
    for (const stackFrame of stackFrames) {
      if (!stackFrame.url) {
        continue;
      }
      if (stackFrame.isNative) {
        stackFrame.category = "native";
        continue;
      }
      if (stackFrame.url.startsWith("node:")) {
        stackFrame.category = "node";
        continue;
      }
      if (!stackFrame.url.startsWith("file:")) {
        stackFrameInternalArray.push(stackFrame);
        continue;
      }
      if (rootDirectoryUrl && stackFrame.url.startsWith(rootDirectoryUrl)) {
        stackFrameInternalArray.push(stackFrame);
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
          stackFrame.category = "jsenv";
          continue;
        }
      } else if (
        URL_META.matches(stackFrame.url, {
          "file:///**/node_modules/@jsenv/core/": true,
        })
      ) {
        stackFrame.category = "jsenv";
        continue;
      }
      if (
        URL_META.matches(stackFrame.url, {
          "file:///**/node_modules/": true,
        })
      ) {
        stackFrame.category = "node_modules";
        continue;
      }
      stackFrameInternalArray.push(stackFrame);
    }
    if (stackFrameInternalArray.length) {
      stackFrames = stackFrameInternalArray;
    }
  }

  let stackTrace = "";
  for (const stackFrame of stackFrames) {
    if (stackTrace) stackTrace += "\n";
    stackTrace += stackFrame.raw;
  }

  stack = "";
  const message = reason.message || "";
  stack += `${name}: ${message}`;
  if (stackTrace) {
    stack += `\n${stackTrace}`;
  }

  let site;
  if (reason.stackFrames && reason.site && !reason.site.isInline) {
    site = reason.site;
  } else {
    const [firstCallFrame] = stackFrames;
    if (firstCallFrame) {
      site = firstCallFrame.url
        ? {
            url: firstCallFrame.url,
            line: firstCallFrame.line,
            column: firstCallFrame.column,
          }
        : firstCallFrame.evalSite;
    }
  }
  return { stackFrames, stackTrace, stack, site };
};

const asFileUrl = (callSiteFilename, { isNative }) => {
  if (isNative) {
    return callSiteFilename;
  }
  if (!callSiteFilename) {
    return callSiteFilename;
  }
  if (callSiteFilename.startsWith("file:")) {
    return callSiteFilename;
  }
  if (callSiteFilename.startsWith("node:")) {
    return callSiteFilename;
  }
  try {
    const fileUrl = pathToFileURL(callSiteFilename);
    return fileUrl.href;
  } catch {
    return callSiteFilename;
  }
};

const getErrorName = (value, isError) => {
  const { constructor } = value;
  if (constructor) {
    const { name } = constructor;
    if (name !== "Object") {
      if (name === "Error" && isError && value.name !== "Error") {
        return value.name;
      }
      return name;
    }
  }
  return value.name || "Error";
};

const getPropertiesFromEvalOrigin = (origin) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at [^(]+ \(.+:\d+:\d+\)$/.exec(origin);
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
  const nestedEvalMatch = /^eval at [^(]+ \(.+\)$/.exec(origin);
  if (nestedEvalMatch) {
    return getPropertiesFromEvalOrigin(nestedEvalMatch[2]);
  }
  return null;
};

export { URL_META, createException };
