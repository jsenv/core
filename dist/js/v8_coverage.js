const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(`${name} must be a url but looks like a windows pathname, got ${value}`);
  }
  if (!hasScheme(value)) {
    throw new TypeError(`${name} must be a url and no scheme found, got ${value}`);
  }
};
const isPlainObject = value => {
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
const isWindowsPathnameSpecifier = specifier => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/" || thirdChar === "\\";
};
const hasScheme = specifier => /^[a-zA-Z]+:/.test(specifier);

const resolveAssociations = (associations, baseUrl) => {
  assertUrlLike(baseUrl, "baseUrl");
  const associationsResolved = {};
  Object.keys(associations).forEach(key => {
    const valueMap = associations[key];
    const valueMapResolved = {};
    Object.keys(valueMap).forEach(pattern => {
      const value = valueMap[pattern];
      const patternResolved = normalizeUrlPattern(pattern, baseUrl);
      valueMapResolved[patternResolved] = value;
    });
    associationsResolved[key] = valueMapResolved;
  });
  return associationsResolved;
};
const normalizeUrlPattern = (urlPattern, baseUrl) => {
  try {
    return String(new URL(urlPattern, baseUrl));
  } catch (e) {
    // it's not really an url, no need to perform url resolution nor encoding
    return urlPattern;
  }
};

const asFlatAssociations = associations => {
  if (!isPlainObject(associations)) {
    throw new TypeError(`associations must be a plain object, got ${associations}`);
  }
  const flatAssociations = {};
  Object.keys(associations).forEach(key => {
    const valueMap = associations[key];
    if (!isPlainObject(valueMap)) {
      throw new TypeError(`all associations value must be objects, found "${key}": ${valueMap}`);
    }
    Object.keys(valueMap).forEach(pattern => {
      const value = valueMap[pattern];
      const previousValue = flatAssociations[pattern];
      flatAssociations[pattern] = previousValue ? {
        ...previousValue,
        [key]: value
      } : {
        [key]: value
      };
    });
  });
  return flatAssociations;
};

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
const applyPatternMatching = ({
  url,
  pattern
}) => {
  assertUrlLike(pattern, "pattern");
  assertUrlLike(url, "url");
  const {
    matched,
    patternIndex,
    index,
    groups
  } = applyMatching(pattern, url);
  const matchGroups = [];
  let groupIndex = 0;
  groups.forEach(group => {
    if (group.name) {
      matchGroups[group.name] = group.string;
    } else {
      matchGroups[groupIndex] = group.string;
      groupIndex++;
    }
  });
  return {
    matched,
    patternIndex,
    urlIndex: index,
    matchGroups
  };
};
const applyMatching = (pattern, string) => {
  const groups = [];
  let patternIndex = 0;
  let index = 0;
  let remainingPattern = pattern;
  let remainingString = string;
  let restoreIndexes = true;
  const consumePattern = count => {
    const subpattern = remainingPattern.slice(0, count);
    remainingPattern = remainingPattern.slice(count);
    patternIndex += count;
    return subpattern;
  };
  const consumeString = count => {
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
      return false; // fails because string longer than expected
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
        groups.push({
          string: ""
        });
      }
      return false; // fail because string shorter than expected
    }
    // -- from this point pattern and string are not consumed --
    // fast path trailing slash
    if (remainingPattern === "/") {
      if (remainingString[0] === "/") {
        // trailing slash match remaining
        consumePattern(1);
        groups.push({
          string: consumeRemainingString()
        });
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
      if (remainingPattern[0] === "/") {
        consumePattern(1); // consumes "/"
      }
      // pattern ending with ** always match remaining string
      if (remainingPattern === "") {
        consumeRemainingString();
        return true;
      }
      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: true
      });
      groups.push(...skipResult.groups);
      consumePattern(skipResult.patternIndex);
      consumeRemainingString();
      restoreIndexes = false;
      return skipResult.matched;
    }
    if (remainingPattern[0] === "*") {
      consumePattern(1); // consumes "*"
      if (remainingPattern === "") {
        // matches everything except '/'
        const slashIndex = remainingString.indexOf("/");
        if (slashIndex === -1) {
          groups.push({
            string: consumeRemainingString()
          });
          return true;
        }
        groups.push({
          string: consumeString(slashIndex)
        });
        return false;
      }
      // the next char must not the one expected by remainingPattern[0]
      // because * is greedy and expect to skip at least one char
      if (remainingPattern[0] === remainingString[0]) {
        groups.push({
          string: ""
        });
        patternIndex = patternIndex - 1;
        return false;
      }
      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: false
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
    groups
  };
};
const skipUntilMatch = ({
  pattern,
  string,
  canSkipSlash
}) => {
  let index = 0;
  let remainingString = string;
  let longestMatchRange = null;
  const tryToMatch = () => {
    const matchAttempt = applyMatching(pattern, remainingString);
    if (matchAttempt.matched) {
      return {
        matched: true,
        patternIndex: matchAttempt.patternIndex,
        index: index + matchAttempt.index,
        groups: matchAttempt.groups,
        group: {
          string: remainingString === "" ? string : string.slice(0, -remainingString.length)
        }
      };
    }
    const matchAttemptIndex = matchAttempt.index;
    const matchRange = {
      patternIndex: matchAttempt.patternIndex,
      index,
      length: matchAttemptIndex,
      groups: matchAttempt.groups
    };
    if (!longestMatchRange || longestMatchRange.length < matchRange.length) {
      longestMatchRange = matchRange;
    }
    const nextIndex = matchAttemptIndex + 1;
    const canSkip = nextIndex < remainingString.length && (canSkipSlash || remainingString[0] !== "/");
    if (canSkip) {
      // search against the next unattempted string
      index += nextIndex;
      remainingString = remainingString.slice(nextIndex);
      return tryToMatch();
    }
    return {
      matched: false,
      patternIndex: longestMatchRange.patternIndex,
      index: longestMatchRange.index + longestMatchRange.length,
      groups: longestMatchRange.groups,
      group: {
        string: string.slice(0, longestMatchRange.index)
      }
    };
  };
  return tryToMatch();
};

const applyAssociations = ({
  url,
  associations
}) => {
  assertUrlLike(url);
  const flatAssociations = asFlatAssociations(associations);
  return Object.keys(flatAssociations).reduce((previousValue, pattern) => {
    const {
      matched
    } = applyPatternMatching({
      pattern,
      url
    });
    if (matched) {
      const value = flatAssociations[pattern];
      if (isPlainObject(previousValue) && isPlainObject(value)) {
        return {
          ...previousValue,
          ...value
        };
      }
      return value;
    }
    return previousValue;
  }, {});
};

const applyAliases = ({
  url,
  aliases
}) => {
  let aliasFullMatchResult;
  const aliasMatchingKey = Object.keys(aliases).find(key => {
    const aliasMatchResult = applyPatternMatching({
      pattern: key,
      url
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
  const {
    matchGroups
  } = aliasFullMatchResult;
  const alias = aliases[aliasMatchingKey];
  const parts = alias.split("*");
  const newUrl = parts.reduce((previous, value, index) => {
    return `${previous}${value}${index === parts.length - 1 ? "" : matchGroups[index]}`;
  }, "");
  return newUrl;
};

const urlChildMayMatch = ({
  url,
  associations,
  predicate
}) => {
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
  Object.keys(flatAssociations).forEach(pattern => {
    const value = flatAssociations[pattern];
    const matchResult = applyPatternMatching({
      pattern,
      url
    });
    if (matchResult.matched) {
      someFullMatch = true;
      if (isPlainObject(fullMatchMeta) && isPlainObject(value)) {
        fullMatchMeta = {
          ...fullMatchMeta,
          ...value
        };
      } else {
        fullMatchMeta = value;
      }
    } else if (someFullMatch === false && matchResult.urlIndex >= url.length) {
      partialMatchMetaArray.push(value);
    }
  });
  if (someFullMatch) {
    return Boolean(predicate(fullMatchMeta));
  }
  return partialMatchMetaArray.some(partialMatchMeta => predicate(partialMatchMeta));
};

const URL_META = {
  resolveAssociations,
  applyAssociations,
  urlChildMayMatch,
  applyPatternMatching,
  applyAliases
};

const filterV8Coverage = async (v8Coverage, {
  rootDirectoryUrl,
  coverageConfig
}) => {
  const associations = URL_META.resolveAssociations({
    cover: coverageConfig
  }, rootDirectoryUrl);
  const urlShouldBeCovered = url => {
    const {
      cover
    } = URL_META.applyAssociations({
      url: new URL(url, rootDirectoryUrl).href,
      associations
    });
    return cover;
  };
  const v8CoverageFiltered = {
    ...v8Coverage,
    result: v8Coverage.result.filter(fileReport => urlShouldBeCovered(fileReport.url))
  };
  return v8CoverageFiltered;
};

var v8_coverage = /*#__PURE__*/Object.freeze({
  __proto__: null,
  filterV8Coverage: filterV8Coverage
});

export { URL_META as U, filterV8Coverage as f, v8_coverage as v };
