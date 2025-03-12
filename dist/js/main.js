import { createMagicSource } from "@jsenv/sourcemap";
import process$1 from "node:process";
import os from "node:os";
import tty from "node:tty";
import stringWidth from "string-width";
import "node:url";

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
      // if remainingString
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

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process$1.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const {env} = process$1;

let flagForceColor;
if (
	hasFlag('no-color')
	|| hasFlag('no-colors')
	|| hasFlag('color=false')
	|| hasFlag('color=never')
) {
	flagForceColor = 0;
} else if (
	hasFlag('color')
	|| hasFlag('colors')
	|| hasFlag('color=true')
	|| hasFlag('color=always')
) {
	flagForceColor = 1;
}

function envForceColor() {
	if (!('FORCE_COLOR' in env)) {
		return;
	}

	if (env.FORCE_COLOR === 'true') {
		return 1;
	}

	if (env.FORCE_COLOR === 'false') {
		return 0;
	}

	if (env.FORCE_COLOR.length === 0) {
		return 1;
	}

	const level = Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);

	if (![0, 1, 2, 3].includes(level)) {
		return;
	}

	return level;
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3,
	};
}

function _supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
	const noFlagForceColor = envForceColor();
	if (noFlagForceColor !== undefined) {
		flagForceColor = noFlagForceColor;
	}

	const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

	if (forceColor === 0) {
		return 0;
	}

	if (sniffFlags) {
		if (hasFlag('color=16m')
			|| hasFlag('color=full')
			|| hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}
	}

	// Check for Azure DevOps pipelines.
	// Has to be above the `!streamIsTTY` check.
	if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
		return 1;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process$1.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10
			&& Number(osRelease[2]) >= 10_586
		) {
			return Number(osRelease[2]) >= 14_931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['GITHUB_ACTIONS', 'GITEA_ACTIONS', 'CIRCLECI'].some(key => key in env)) {
			return 3;
		}

		if (['TRAVIS', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if (env.TERM === 'xterm-kitty') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app': {
				return version >= 3 ? 3 : 2;
			}

			case 'Apple_Terminal': {
				return 2;
			}
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function createSupportsColor(stream, options = {}) {
	const level = _supportsColor(stream, {
		streamIsTTY: stream && stream.isTTY,
		...options,
	});

	return translateLevel(level);
}

({
	stdout: createSupportsColor({isTTY: tty.isatty(1)}),
	stderr: createSupportsColor({isTTY: tty.isatty(2)}),
});

function isUnicodeSupported() {
	const {env} = process$1;
	const {TERM, TERM_PROGRAM} = env;

	if (process$1.platform !== 'win32') {
		return TERM !== 'linux'; // Linux console (kernel)
	}

	return Boolean(env.WT_SESSION) // Windows Terminal
		|| Boolean(env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
		|| env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
		|| TERM_PROGRAM === 'Terminus-Sublime'
		|| TERM_PROGRAM === 'vscode'
		|| TERM === 'xterm-256color'
		|| TERM === 'alacritty'
		|| TERM === 'rxvt-unicode'
		|| TERM === 'rxvt-unicode-256color'
		|| env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
}

/* globals WorkerGlobalScope, DedicatedWorkerGlobalScope, SharedWorkerGlobalScope, ServiceWorkerGlobalScope */

const isBrowser = globalThis.window?.document !== undefined;

globalThis.process?.versions?.node !== undefined;

globalThis.process?.versions?.bun !== undefined;

globalThis.Deno?.version?.deno !== undefined;

globalThis.process?.versions?.electron !== undefined;

globalThis.navigator?.userAgent?.includes('jsdom') === true;

typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;

typeof DedicatedWorkerGlobalScope !== 'undefined' && globalThis instanceof DedicatedWorkerGlobalScope;

typeof SharedWorkerGlobalScope !== 'undefined' && globalThis instanceof SharedWorkerGlobalScope;

typeof ServiceWorkerGlobalScope !== 'undefined' && globalThis instanceof ServiceWorkerGlobalScope;

// Note: I'm intentionally not DRYing up the other variables to keep them "lazy".
const platform = globalThis.navigator?.userAgentData?.platform;

platform === 'macOS'
	|| globalThis.navigator?.platform === 'MacIntel' // Even on Apple silicon Macs.
	|| globalThis.navigator?.userAgent?.includes(' Mac ') === true
	|| globalThis.process?.platform === 'darwin';

platform === 'Windows'
	|| globalThis.navigator?.platform === 'Win32'
	|| globalThis.process?.platform === 'win32';

platform === 'Linux'
	|| globalThis.navigator?.platform?.startsWith('Linux') === true
	|| globalThis.navigator?.userAgent?.includes(' Linux ') === true
	|| globalThis.process?.platform === 'linux';

platform === 'Android'
	|| globalThis.navigator?.platform === 'Android'
	|| globalThis.navigator?.userAgent?.includes(' Android ') === true
	|| globalThis.process?.platform === 'android';

const ESC = '\u001B[';

!isBrowser && process$1.env.TERM_PROGRAM === 'Apple_Terminal';
const isWindows = !isBrowser && process$1.platform === 'win32';

isBrowser ? () => {
	throw new Error('`process.cwd()` only works in Node.js, not the browser.');
} : process$1.cwd;

const cursorUp = (count = 1) => ESC + count + 'A';

const cursorLeft = ESC + 'G';

const eraseLines = count => {
	let clear = '';

	for (let i = 0; i < count; i++) {
		clear += eraseLine + (i < count - 1 ? cursorUp() : '');
	}

	if (count) {
		clear += cursorLeft;
	}

	return clear;
};
const eraseLine = ESC + '2K';
const eraseScreen = ESC + '2J';

const clearTerminal = isWindows
	? `${eraseScreen}${ESC}0f`
	// 1. Erases the screen (Only done in case `2` is not supported)
	// 2. Erases the whole screen including scrollback buffer
	// 3. Moves cursor to the top-left position
	// More info: https://www.real-world-systems.com/docs/ANSIcode.html
	:	`${eraseScreen}${ESC}3J${ESC}H`;

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;

  Object.keys(details).forEach((key) => {
    const value = details[key];
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
  });

  return string;
};

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

const createAnsi = ({ supported }) => {
  const ANSI = {
    supported,

    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    GREY: "\x1b[90m",
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
      return `${color}${text}${RESET}`;
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
      return `${effect}${text}${RESET}`;
    },
  };

  return ANSI;
};

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;

const ANSI = createAnsi({
  supported:
    process.env.FORCE_COLOR === "1" ||
    processSupportsBasicColor ||
    // GitHub workflow does support ANSI but "supports-color" returns false
    // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
    process.env.GITHUB_WORKFLOW,
});

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
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported(),
  ANSI,
});

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
const unitShort = {
  year: "y",
  month: "m",
  week: "w",
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

const humanizeDuration = (
  ms,
  { short, rounded = true, decimals } = {},
) => {
  // ignore ms below meaningfulMs so that:
  // humanizeDuration(0.5) -> "0 second"
  // humanizeDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return short ? "0s" : "0 second";
  }
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return humanizeDurationUnit(primary, {
      decimals:
        decimals === undefined ? (primary.name === "second" ? 1 : 0) : decimals,
      short,
      rounded,
    });
  }
  return `${humanizeDurationUnit(primary, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })} and ${humanizeDurationUnit(remaining, {
    decimals: decimals === undefined ? 0 : decimals,
    short,
    rounded,
  })}`;
};
const humanizeDurationUnit = (unit, { decimals, short, rounded }) => {
  const count = rounded
    ? setRoundedPrecision(unit.count, { decimals })
    : setPrecision(unit.count, { decimals });
  let name = unit.name;
  if (short) {
    name = unitShort[name];
    return `${count}${name}`;
  }
  if (count <= 1) {
    return `${count} ${name}`;
  }
  return `${count} ${name}s`;
};
const MS_PER_UNITS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
};

const parseMs = (ms) => {
  const unitNames = Object.keys(MS_PER_UNITS);
  const smallestUnitName = unitNames[unitNames.length - 1];
  let firstUnitName = smallestUnitName;
  let firstUnitCount = ms / MS_PER_UNITS[smallestUnitName];
  const firstUnitIndex = unitNames.findIndex((unitName) => {
    if (unitName === smallestUnitName) {
      return false;
    }
    const msPerUnit = MS_PER_UNITS[unitName];
    const unitCount = Math.floor(ms / msPerUnit);
    if (unitCount) {
      firstUnitName = unitName;
      firstUnitCount = unitCount;
      return true;
    }
    return false;
  });
  if (firstUnitName === smallestUnitName) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    };
  }
  const remainingMs = ms - firstUnitCount * MS_PER_UNITS[firstUnitName];
  const remainingUnitName = unitNames[firstUnitIndex + 1];
  const remainingUnitCount = remainingMs / MS_PER_UNITS[remainingUnitName];
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
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: remainingUnitCount,
    },
  };
};

const humanizeFileSize = (numberOfBytes, { decimals, short } = {}) => {
  return inspectBytes(numberOfBytes, { decimals, short });
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

const LOG_LEVEL_OFF = "off";

const LOG_LEVEL_DEBUG = "debug";

const LOG_LEVEL_INFO = "info";

const LOG_LEVEL_WARN = "warn";

const LOG_LEVEL_ERROR = "error";

const createLogger = ({ logLevel = LOG_LEVEL_INFO } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      level: "debug",
      levels: { debug: true, info: true, warn: true, error: true },
      debug,
      info,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_INFO) {
    return {
      level: "info",
      levels: { debug: false, info: true, warn: true, error: true },
      debug: debugDisabled,
      info,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_WARN) {
    return {
      level: "warn",
      levels: { debug: false, info: false, warn: true, error: true },
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      level: "error",
      levels: { debug: false, info: false, warn: false, error: true },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error,
    };
  }
  if (logLevel === LOG_LEVEL_OFF) {
    return {
      level: "off",
      levels: { debug: false, info: false, warn: false, error: false },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled,
    };
  }
  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF}
${LOG_LEVEL_ERROR}
${LOG_LEVEL_WARN}
${LOG_LEVEL_INFO}
${LOG_LEVEL_DEBUG}`);
};

const debug = (...args) => console.debug(...args);

const debugDisabled = () => {};

const info = (...args) => console.info(...args);

const infoDisabled = () => {};

const warn = (...args) => console.warn(...args);

const warnDisabled = () => {};

const error = (...args) => console.error(...args);

const errorDisabled = () => {};

/*
 * see also https://github.com/vadimdemedes/ink
 */


const createDynamicLog = ({
  stream = process.stdout,
  clearTerminalAllowed,
  onVerticalOverflow = () => {},
  onWriteFromOutside = () => {},
} = {}) => {
  const { columns = 80, rows = 24 } = stream;
  const dynamicLog = {
    destroyed: false,
    onVerticalOverflow,
    onWriteFromOutside,
  };

  let lastOutput = "";
  let lastOutputFromOutside = "";
  let clearAttemptResult;
  let writing = false;

  const getErasePreviousOutput = () => {
    // nothing to clear
    if (!lastOutput) {
      return "";
    }
    if (clearAttemptResult !== undefined) {
      return "";
    }

    const logLines = lastOutput.split(/\r\n|\r|\n/);
    let visualLineCount = 0;
    for (const logLine of logLines) {
      const width = stringWidth(logLine);
      if (width === 0) {
        visualLineCount++;
      } else {
        visualLineCount += Math.ceil(width / columns);
      }
    }

    if (visualLineCount > rows) {
      if (clearTerminalAllowed) {
        clearAttemptResult = true;
        return clearTerminal;
      }
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      clearAttemptResult = false;
      dynamicLog.onVerticalOverflow();
      return "";
    }

    clearAttemptResult = true;
    return eraseLines(visualLineCount);
  };

  const update = (string) => {
    if (dynamicLog.destroyed) {
      throw new Error("Cannot write log after destroy");
    }
    let stringToWrite = string;
    if (lastOutput) {
      if (lastOutputFromOutside) {
        // We don't want to clear logs written by other code,
        // it makes output unreadable and might erase precious information
        // To detect this we put a spy on the stream.
        // The spy is required only if we actually wrote something in the stream
        // something else than this code has written in the stream
        // so we just write without clearing (append instead of replacing)
        lastOutput = "";
        lastOutputFromOutside = "";
      } else {
        stringToWrite = `${getErasePreviousOutput()}${string}`;
      }
    }
    writing = true;
    stream.write(stringToWrite);
    lastOutput = string;
    writing = false;
    clearAttemptResult = undefined;
  };

  const clearDuringFunctionCall = (
    callback,
    ouputAfterCallback = lastOutput,
  ) => {
    // 1. Erase the current log
    // 2. Call callback (expect to write something on stdout)
    // 3. Restore the current log
    // During step 2. we expect a "write from outside" so we uninstall
    // the stream spy during function call
    update("");

    writing = true;
    callback();
    writing = false;

    update(ouputAfterCallback);
  };

  const writeFromOutsideEffect = (value) => {
    if (!lastOutput) {
      // we don't care if the log never wrote anything
      // or if last update() wrote an empty string
      return;
    }
    if (writing) {
      return;
    }
    lastOutputFromOutside = value;
    dynamicLog.onWriteFromOutside(value);
  };

  let removeStreamSpy;
  if (stream === process.stdout) {
    const removeStdoutSpy = spyStreamOutput(
      process.stdout,
      writeFromOutsideEffect,
    );
    const removeStderrSpy = spyStreamOutput(
      process.stderr,
      writeFromOutsideEffect,
    );
    removeStreamSpy = () => {
      removeStdoutSpy();
      removeStderrSpy();
    };
  } else {
    removeStreamSpy = spyStreamOutput(stream, writeFromOutsideEffect);
  }

  const destroy = () => {
    dynamicLog.destroyed = true;
    if (removeStreamSpy) {
      removeStreamSpy();
      removeStreamSpy = null;
      lastOutput = "";
      lastOutputFromOutside = "";
    }
  };

  Object.assign(dynamicLog, {
    update,
    destroy,
    stream,
    clearDuringFunctionCall,
  });
  return dynamicLog;
};

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = (stream, callback) => {
  let output = "";
  let installed = true;
  const originalWrite = stream.write;
  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
    callback(output);
    return originalWrite.call(this, ...args);
  };

  const uninstall = () => {
    if (!installed) {
      return;
    }
    stream.write = originalWrite;
    installed = false;
  };

  return () => {
    uninstall();
    return output;
  };
};

const startSpinner = ({
  dynamicLog,
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  fps = 20,
  keepProcessAlive = false,
  stopOnWriteFromOutside = true,
  stopOnVerticalOverflow = true,
  render = () => "",
  effect = () => {},
  animated = dynamicLog.stream.isTTY,
}) => {
  let frameIndex = 0;
  let interval;
  let running = true;

  const spinner = {
    message: undefined,
  };

  const update = (message) => {
    spinner.message = running
      ? `${frames[frameIndex]} ${message}\n`
      : `${message}\n`;
    return spinner.message;
  };
  spinner.update = update;

  let cleanup;
  if (animated && ANSI.supported) {
    running = true;
    cleanup = effect();
    dynamicLog.update(update(render()));

    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
      dynamicLog.update(update(render()));
    }, 1000 / fps);
    if (!keepProcessAlive) {
      interval.unref();
    }
  } else {
    dynamicLog.update(update(render()));
  }

  const stop = (message) => {
    running = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    if (dynamicLog && message) {
      dynamicLog.update(update(message));
      dynamicLog = null;
    }
  };
  spinner.stop = stop;

  if (stopOnVerticalOverflow) {
    dynamicLog.onVerticalOverflow = stop;
  }
  if (stopOnWriteFromOutside) {
    dynamicLog.onWriteFromOutside = stop;
  }

  return spinner;
};

const createTaskLog = (
  label,
  { disabled = false, animated = true, stopOnWriteFromOutside } = {},
) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
      fail: () => {},
    };
  }
  if (animated && process.env.CAPTURING_SIDE_EFFECTS) {
    animated = false;
  }
  const startMs = Date.now();
  const dynamicLog = createDynamicLog();
  let message = label;
  const taskSpinner = startSpinner({
    dynamicLog,
    render: () => message,
    stopOnWriteFromOutside,
    animated,
  });
  return {
    setRightText: (value) => {
      message = `${label} ${value}`;
    },
    done: () => {
      const msEllapsed = Date.now() - startMs;
      taskSpinner.stop(
        `${UNICODE.OK} ${label} (done in ${humanizeDuration(msEllapsed)})`,
      );
    },
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      );
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`);
    },
  };
};

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  const filename =
    slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1);
  if (filename.match(/@([0-9])+(\.[0-9]+)?(\.[0-9]+)?$/)) {
    return "";
  }
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return "";
  }
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};

const resourceToPathname = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return resource.slice(0, searchSeparatorIndex);
  }
  const hashIndex = resource.indexOf("#");
  if (hashIndex > -1) {
    return resource.slice(0, hashIndex);
  }
  return resource;
};

const urlToScheme = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource = (url) => {
  const scheme = urlToScheme(url);

  if (scheme === "file") {
    const urlAsStringWithoutFileProtocol = String(url).slice("file://".length);
    return urlAsStringWithoutFileProtocol;
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = String(url).slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    const urlAsStringWithoutOrigin = afterProtocol.slice(pathnameSlashIndex);
    return urlAsStringWithoutOrigin;
  }

  const urlAsStringWithoutProtocol = String(url).slice(scheme.length + 1);
  return urlAsStringWithoutProtocol;
};

const urlToPathname = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
};

const urlToFilename = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToFilename(pathname);
};

const pathnameToFilename = (pathname) => {
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};

const urlToBasename = (url, removeAllExtensions) => {
  const filename = urlToFilename(url);
  const basename = filenameToBasename(filename);
  {
    return basename;
  }
};

const filenameToBasename = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};

const urlToExtension = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToExtension(pathname);
};

const urlToOrigin = (url) => {
  const urlString = String(url);
  if (urlString.startsWith("file://")) {
    return `file://`;
  }
  return new URL(urlString).origin;
};

const asUrlWithoutSearch = (url) => {
  url = String(url);
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const asSpecifierWithoutSearch = (specifier) => {
  if (isValidUrl(specifier)) {
    return asUrlWithoutSearch(specifier);
  }
  const [beforeQuestion] = specifier.split("?");
  return beforeQuestion;
};

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
const normalizeUrl = (url) => {
  if (url.includes("?")) {
    // disable on data urls (would mess up base64 encoding)
    if (url.startsWith("data:")) {
      return url;
    }
    return url.replace(/[=](?=&|$)/g, "");
  }
  return url;
};

const injectQueryParamsIntoSpecifier = (specifier, params) => {
  if (isValidUrl(specifier)) {
    return injectQueryParams(specifier, params);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  });
  let paramsString = searchParams.toString();
  if (paramsString) {
    paramsString = paramsString.replace(/[=](?=&|$)/g, "");
    return `${beforeQuestion}?${paramsString}`;
  }
  return beforeQuestion;
};

const injectQueryParams = (url, params) => {
  const urlObject = new URL(url);
  const { searchParams } = urlObject;
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  });
  const urlWithParams = urlObject.href;
  return normalizeUrl(urlWithParams);
};

const injectQueryParamWithoutEncoding = (url, key, value) => {
  const urlObject = new URL(url);
  let { origin, pathname, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search += `${key}=${value}`;
  }
  return `${origin}${pathname}${search}${hash}`;
};
const injectQueryParamIntoSpecifierWithoutEncoding = (
  specifier,
  key,
  value,
) => {
  if (isValidUrl(specifier)) {
    return injectQueryParamWithoutEncoding(specifier, key, value);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  let search = searchParams.toString();
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search = `?${search}&${key}=${value}`;
  }
  return `${beforeQuestion}${search}`;
};

const renderUrlOrRelativeUrlFilename = (urlOrRelativeUrl, renderer) => {
  const questionIndex = urlOrRelativeUrl.indexOf("?");
  const beforeQuestion =
    questionIndex === -1
      ? urlOrRelativeUrl
      : urlOrRelativeUrl.slice(0, questionIndex);
  const afterQuestion =
    questionIndex === -1 ? "" : urlOrRelativeUrl.slice(questionIndex);
  const beforeLastSlash = beforeQuestion.endsWith("/")
    ? beforeQuestion.slice(0, -1)
    : beforeQuestion;
  const slashLastIndex = beforeLastSlash.lastIndexOf("/");
  const beforeFilename =
    slashLastIndex === -1 ? "" : beforeQuestion.slice(0, slashLastIndex + 1);
  const filename =
    slashLastIndex === -1
      ? beforeQuestion
      : beforeQuestion.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  const extension = dotLastIndex === -1 ? "" : filename.slice(dotLastIndex);
  const newFilename = renderer({
    basename,
    extension,
  });
  return `${beforeFilename}${newFilename}${afterQuestion}`;
};

const setUrlExtension = (url, extension) => {
  const origin = urlToOrigin(url);
  const currentExtension = urlToExtension(url);
  if (typeof extension === "function") {
    extension = extension(currentExtension);
  }
  const resource = urlToResource(url);
  const [pathname, search] = resource.split("?");
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname;
  let newPathname;
  if (pathnameWithoutExtension.endsWith("/")) {
    newPathname = pathnameWithoutExtension.slice(0, -1);
    newPathname += extension;
    newPathname += "/";
  } else {
    newPathname = pathnameWithoutExtension;
    newPathname += extension;
  }
  return `${origin}${newPathname}${search ? `?${search}` : ""}`;
};

const setUrlFilename = (url, filename) => {
  const parentPathname = new URL("./", url).pathname;
  return transformUrlPathname(url, (pathname) => {
    if (typeof filename === "function") {
      filename = filename(pathnameToFilename(pathname));
    }
    return `${parentPathname}${filename}`;
  });
};

const setUrlBasename = (url, basename) => {
  return setUrlFilename(url, (filename) => {
    if (typeof basename === "function") {
      basename = basename(filenameToBasename(filename));
    }
    return `${basename}${urlToExtension(url)}`;
  });
};

const transformUrlPathname = (url, transformer) => {
  if (typeof url === "string") {
    const urlObject = new URL(url);
    const { pathname } = urlObject;
    const pathnameTransformed = transformer(pathname);
    if (pathnameTransformed === pathname) {
      return url;
    }
    let { origin } = urlObject;
    // origin is "null" for "file://" urls with Node.js
    if (origin === "null" && urlObject.href.startsWith("file:")) {
      origin = "file://";
    }
    const { search, hash } = urlObject;
    const urlWithPathnameTransformed = `${origin}${pathnameTransformed}${search}${hash}`;
    return urlWithPathnameTransformed;
  }
  const pathnameTransformed = transformer(url.pathname);
  url.pathname = pathnameTransformed;
  return url;
};
const ensurePathnameTrailingSlash = (url) => {
  return transformUrlPathname(url, (pathname) => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  });
};

const jsenvPluginInjections = (rawAssociations) => {
  let resolvedAssociations;

  return {
    name: "jsenv:injections",
    appliesDuring: "*",
    init: (context) => {
      resolvedAssociations = URL_META.resolveAssociations(
        { injectionsGetter: rawAssociations },
        context.rootDirectoryUrl,
      );
    },
    transformUrlContent: async (urlInfo) => {
      const { injectionsGetter } = URL_META.applyAssociations({
        url: asUrlWithoutSearch(urlInfo.url),
        associations: resolvedAssociations,
      });
      if (!injectionsGetter) {
        return null;
      }
      if (typeof injectionsGetter !== "function") {
        throw new TypeError("injectionsGetter must be a function");
      }
      const injections = await injectionsGetter(urlInfo);
      if (!injections) {
        return null;
      }
      const keys = Object.keys(injections);
      if (keys.length === 0) {
        return null;
      }
      return replacePlaceholders(urlInfo.content, injections, urlInfo);
    },
  };
};

const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  optional: (value) => {
    return { [injectionSymbol]: "optional", value };
  },
};

// we export this because it is imported by jsenv_plugin_placeholder.js and unit test
const replacePlaceholders = (content, replacements, urlInfo) => {
  const magicSource = createMagicSource(content);
  for (const key of Object.keys(replacements)) {
    let index = content.indexOf(key);
    const replacement = replacements[key];
    let isOptional;
    let value;
    if (replacement && replacement[injectionSymbol]) {
      const valueBehindSymbol = replacement[injectionSymbol];
      isOptional = valueBehindSymbol === "optional";
      value = replacement.value;
    } else {
      value = replacement;
    }
    if (index === -1) {
      if (!isOptional) {
        urlInfo.context.logger.warn(
          `placeholder "${key}" not found in ${urlInfo.url}.
--- suggestion a ---
Add "${key}" in that file.
--- suggestion b ---
Fix eventual typo in "${key}"?
--- suggestion c ---
Mark injection as optional using INJECTIONS.optional():
import { INJECTIONS } from "@jsenv/core";

return {
  "${key}": INJECTIONS.optional(${JSON.stringify(value)}),
};`,
        );
      }
      continue;
    }

    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement:
          urlInfo.type === "js_classic" ||
          urlInfo.type === "js_module" ||
          urlInfo.type === "html"
            ? JSON.stringify(value, null, "  ")
            : value,
      });
      index = content.indexOf(key, end);
    }
  }
  return magicSource.toContentAndSourcemap();
};

// dev
const startDevServer = async (...args) => {
  const namespace = await import("./start_dev_server.js");
  return namespace.startDevServer(...args);
};

// build
const build = async (...args) => {
  const namespace = await import("./build.js").then(n => n.build);
  return namespace.build(...args);
};
const startBuildServer = async (...args) => {
  const namespace = await import("./start_build_server.js");
  return namespace.startBuildServer(...args);
};

export { ANSI, INJECTIONS, UNICODE, URL_META, asSpecifierWithoutSearch, asUrlWithoutSearch, build, createDetailedMessage, createLogger, createTaskLog, distributePercentages, ensurePathnameTrailingSlash, generateContentFrame, humanizeFileSize, injectQueryParamIntoSpecifierWithoutEncoding, injectQueryParams, injectQueryParamsIntoSpecifier, jsenvPluginInjections, normalizeUrl, renderUrlOrRelativeUrlFilename, replacePlaceholders, setUrlBasename, setUrlExtension, setUrlFilename, startBuildServer, startDevServer, urlToBasename, urlToExtension, urlToFilename, urlToPathname };
