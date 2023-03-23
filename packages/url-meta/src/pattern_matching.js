/*
 * Link to things doing pattern matching:
 * https://git-scm.com/docs/gitignore
 * https://github.com/kaelzhang/node-ignore
 */

import { assertUrlLike } from "./assertions.js"

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
export const applyPatternMatching = ({ url, pattern }) => {
  assertUrlLike(pattern, "pattern")
  assertUrlLike(url, "url")
  const { matched, patternIndex, index, groups } = applyMatching(pattern, url)
  const matchGroups = []
  let groupIndex = 0
  groups.forEach((group) => {
    if (group.name) {
      matchGroups[group.name] = group.string
    } else {
      matchGroups[groupIndex] = group.string
      groupIndex++
    }
  })
  return {
    matched,
    patternIndex,
    urlIndex: index,
    matchGroups,
  }
}

const applyMatching = (pattern, string) => {
  const groups = []
  let patternIndex = 0
  let index = 0
  let remainingPattern = pattern
  let remainingString = string
  let restoreIndexes = true

  const consumePattern = (count) => {
    const subpattern = remainingPattern.slice(0, count)
    remainingPattern = remainingPattern.slice(count)
    patternIndex += count
    return subpattern
  }
  const consumeString = (count) => {
    const substring = remainingString.slice(0, count)
    remainingString = remainingString.slice(count)
    index += count
    return substring
  }
  const consumeRemainingString = () => {
    return consumeString(remainingString.length)
  }

  let matched
  const iterate = () => {
    const patternIndexBefore = patternIndex
    const indexBefore = index
    matched = matchOne()
    if (matched === undefined) {
      consumePattern(1)
      consumeString(1)
      iterate()
      return
    }
    if (matched === false && restoreIndexes) {
      patternIndex = patternIndexBefore
      index = indexBefore
    }
  }
  const matchOne = () => {
    // pattern consumed and string consumed
    if (remainingPattern === "" && remainingString === "") {
      return true // string fully matched pattern
    }
    // pattern consumed, string not consumed
    if (remainingPattern === "" && remainingString !== "") {
      return false // fails because string longer than expected
    }
    // -- from this point pattern is not consumed --
    // string consumed, pattern not consumed
    if (remainingString === "") {
      if (remainingPattern === "**") {
        // trailing "**" is optional
        consumePattern(2)
        return true
      }
      if (remainingPattern === "*") {
        groups.push({ string: "" })
      }
      return false // fail because string shorter than expected
    }
    // -- from this point pattern and string are not consumed --
    // fast path trailing slash
    if (remainingPattern === "/") {
      if (remainingString[0] === "/") {
        // trailing slash match remaining
        consumePattern(1)
        groups.push({ string: consumeRemainingString() })
        return true
      }
      return false
    }
    // fast path trailing '**'
    if (remainingPattern === "**") {
      consumePattern(2)
      consumeRemainingString()
      return true
    }
    // pattern leading **
    if (remainingPattern.slice(0, 2) === "**") {
      consumePattern(2) // consumes "**"
      let skipAllowed = true
      if (remainingPattern[0] === "/") {
        consumePattern(1) // consumes "/"
        if (!remainingString.includes("/")) {
          skipAllowed = false
        }
      }
      // pattern ending with "**" or "**/" always match remaining string
      if (remainingPattern === "") {
        consumeRemainingString()
        return true
      }
      if (skipAllowed) {
        const skipResult = skipUntilMatch({
          pattern: remainingPattern,
          string: remainingString,
          canSkipSlash: true,
        })
        groups.push(...skipResult.groups)
        consumePattern(skipResult.patternIndex)
        consumeRemainingString()
        restoreIndexes = false
        return skipResult.matched
      }
    }
    if (remainingPattern[0] === "*") {
      consumePattern(1) // consumes "*"
      if (remainingPattern === "") {
        // matches everything except '/'
        const slashIndex = remainingString.indexOf("/")
        if (slashIndex === -1) {
          groups.push({ string: consumeRemainingString() })
          return true
        }
        groups.push({ string: consumeString(slashIndex) })
        return false
      }
      // the next char must not the one expected by remainingPattern[0]
      // because * is greedy and expect to skip at least one char
      if (remainingPattern[0] === remainingString[0]) {
        groups.push({ string: "" })
        patternIndex = patternIndex - 1
        return false
      }
      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString,
        canSkipSlash: false,
      })
      groups.push(skipResult.group, ...skipResult.groups)
      consumePattern(skipResult.patternIndex)
      consumeString(skipResult.index)
      restoreIndexes = false
      return skipResult.matched
    }
    if (remainingPattern[0] !== remainingString[0]) {
      return false
    }
    return undefined
  }
  iterate()

  return {
    matched,
    patternIndex,
    index,
    groups,
  }
}

const skipUntilMatch = ({ pattern, string, canSkipSlash }) => {
  let index = 0
  let remainingString = string
  let longestAttemptRange = null
  const tryToMatch = () => {
    const matchAttempt = applyMatching(pattern, remainingString)
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
      }
    }
    const attemptIndex = matchAttempt.index
    const attemptRange = {
      patternIndex: matchAttempt.patternIndex,
      index,
      length: attemptIndex,
      groups: matchAttempt.groups,
    }
    if (
      !longestAttemptRange ||
      longestAttemptRange.length < attemptRange.length
    ) {
      longestAttemptRange = attemptRange
    }
    const nextIndex = attemptIndex + 1
    let canSkip
    if (nextIndex >= remainingString.length) {
      canSkip = false
    } else if (remainingString[0] === "/") {
      canSkip = canSkipSlash
    } else {
      canSkip = true
    }
    if (canSkip) {
      // search against the next unattempted string
      index += nextIndex
      remainingString = remainingString.slice(nextIndex)
      return tryToMatch()
    }
    return {
      matched: false,
      patternIndex: longestAttemptRange.patternIndex,
      index: longestAttemptRange.index + longestAttemptRange.length,
      groups: longestAttemptRange.groups,
      group: {
        string: string.slice(0, longestAttemptRange.index),
      },
    }
  }
  return tryToMatch()
}
