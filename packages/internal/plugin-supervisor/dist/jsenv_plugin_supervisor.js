import { applyBabelPlugins, parseHtml, visitHtmlNodes, analyzeScriptNode, getHtmlNodeAttribute, getHtmlNodeText, injectJsenvScript, stringifyHtmlAst, getHtmlNodePosition, getUrlForContentInsideHtml, setHtmlNodeText, setHtmlNodeAttributes } from "@jsenv/ast";
import process$1 from "node:process";
import os from "node:os";
import tty from "node:tty";
import "string-width";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import "node:path";
import "node:crypto";

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process$1.argv) {
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf('--');
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
const {
  env
} = process$1;
let flagForceColor;
if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false') || hasFlag('color=never')) {
  flagForceColor = 0;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) {
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
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, {
  streamIsTTY,
  sniffFlags = true
} = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
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
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
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
      case 'iTerm.app':
        {
          return version >= 3 ? 3 : 2;
        }
      case 'Apple_Terminal':
        {
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
    ...options
  });
  return translateLevel(level);
}
({
  stdout: createSupportsColor({
    isTTY: tty.isatty(1)
  }),
  stderr: createSupportsColor({
    isTTY: tty.isatty(2)
  })
});

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";
const createAnsi = ({
  supported
}) => {
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
      return "".concat(color).concat(text).concat(RESET);
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
      return "".concat(effect).concat(text).concat(RESET);
    }
  };
  return ANSI;
};
const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;
const ANSI = createAnsi({
  supported: process.env.FORCE_COLOR === "1" || processSupportsBasicColor ||
  // GitHub workflow does support ANSI but "supports-color" returns false
  // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
  process.env.GITHUB_WORKFLOW
});
function isUnicodeSupported() {
  const {
    env
  } = process$1;
  const {
    TERM,
    TERM_PROGRAM
  } = env;
  if (process$1.platform !== 'win32') {
    return TERM !== 'linux'; // Linux console (kernel)
  }
  return Boolean(env.WT_SESSION) // Windows Terminal
  || Boolean(env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
  || env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
  || TERM_PROGRAM === 'Terminus-Sublime' || TERM_PROGRAM === 'vscode' || TERM === 'xterm-256color' || TERM === 'alacritty' || TERM === 'rxvt-unicode' || TERM === 'rxvt-unicode-256color' || env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
}

// see also https://github.com/sindresorhus/figures

const createUnicode = ({
  supported,
  ANSI
}) => {
  const UNICODE = {
    supported,
    get COMMAND_RAW() {
      return UNICODE.supported ? "\u276F" : ">";
    },
    get OK_RAW() {
      return UNICODE.supported ? "\u2714" : "\u221A";
    },
    get FAILURE_RAW() {
      return UNICODE.supported ? "\u2716" : "\xD7";
    },
    get DEBUG_RAW() {
      return UNICODE.supported ? "\u25C6" : "\u2666";
    },
    get INFO_RAW() {
      return UNICODE.supported ? "\u2139" : "i";
    },
    get WARNING_RAW() {
      return UNICODE.supported ? "\u26A0" : "\u203C";
    },
    get CIRCLE_CROSS_RAW() {
      return UNICODE.supported ? "\u24E7" : "(\xD7)";
    },
    get CIRCLE_DOTTED_RAW() {
      return UNICODE.supported ? "\u25CC" : "*";
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
      return UNICODE.supported ? "\u2026" : "...";
    }
  };
  return UNICODE;
};
createUnicode({
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported(),
  ANSI
});
const formatDefault = v => v;
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
  format = formatDefault
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
          source += "".concat(format(">", "marker_line"), " ");
        } else {
          source += "  ";
        }
      }
      if (lineNumbersOnTheLeft) {
        // fill with spaces to ensure if line moves from 7,8,9 to 10 the display is still great
        const asideSource = "".concat(fillLeft(lineNumber, lineEndIndex + 1), " |");
        source += "".concat(format(asideSource, "line_number_aside"), " ");
      }
    }
    {
      source += truncateLine(lineString, {
        start: columnsBefore,
        end: columnsAfter,
        prefix: "…",
        suffix: "…",
        format
      });
    }
    {
      if (columnMarker && isMainLine) {
        source += "\n";
        if (lineMarker) {
          source += "  ";
        }
        if (lineNumbersOnTheLeft) {
          const asideSpaces = "".concat(fillLeft(lineNumber, lineEndIndex + 1), " | ").length;
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
    return "".concat(format(prefix, "marker_overflow_left")).concat(result).concat(format(suffix, "marker_overflow_right"));
  }
  if (startTruncated) {
    return "".concat(format(prefix, "marker_overflow_left")).concat(result);
  }
  if (endTruncated) {
    return "".concat(result).concat(format(suffix, "marker_overflow_right"));
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
platform === 'macOS' || globalThis.navigator?.platform === 'MacIntel' // Even on Apple silicon Macs.
|| globalThis.navigator?.userAgent?.includes(' Mac ') === true || globalThis.process?.platform === 'darwin';
platform === 'Windows' || globalThis.navigator?.platform === 'Win32' || globalThis.process?.platform === 'win32';
platform === 'Linux' || globalThis.navigator?.platform?.startsWith('Linux') === true || globalThis.navigator?.userAgent?.includes(' Linux ') === true || globalThis.process?.platform === 'linux';
platform === 'Android' || globalThis.navigator?.platform === 'Android' || globalThis.navigator?.userAgent?.includes(' Android ') === true || globalThis.process?.platform === 'android';
!isBrowser && process$1.env.TERM_PROGRAM === 'Apple_Terminal';
!isBrowser && process$1.platform === 'win32';
isBrowser ? () => {
  throw new Error('`process.cwd()` only works in Node.js, not the browser.');
} : process$1.cwd;

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
const normalizeUrl = url => {
  if (url.includes("?")) {
    // disable on data urls (would mess up base64 encoding)
    if (url.startsWith("data:")) {
      return url;
    }
    return url.replace(/[=](?=&|$)/g, "");
  }
  return url;
};
const injectQueryParams = (url, params) => {
  const urlObject = new URL(url);
  const {
    searchParams
  } = urlObject;
  Object.keys(params).forEach(key => {
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

const isFileSystemPath = value => {
  if (typeof value !== "string") {
    throw new TypeError("isFileSystemPath first arg must be a string, got ".concat(value));
  }
  if (value[0] === "/") {
    return true;
  }
  return startsWithWindowsDriveLetter(value);
};
const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

const fileSystemPathToUrl = value => {
  if (!isFileSystemPath(value)) {
    throw new Error("value must be a filesystem path, got ".concat(value));
  }
  return String(pathToFileURL(value));
};

const getCommonPathname = (pathname, otherPathname) => {
  if (pathname === otherPathname) {
    return pathname;
  }
  let commonPart = "";
  let commonPathname = "";
  let i = 0;
  const length = pathname.length;
  const otherLength = otherPathname.length;
  while (i < length) {
    const char = pathname.charAt(i);
    const otherChar = otherPathname.charAt(i);
    i++;
    if (char === otherChar) {
      if (char === "/") {
        commonPart += "/";
        commonPathname += commonPart;
        commonPart = "";
      } else {
        commonPart += char;
      }
    } else {
      if (char === "/" && i - 1 === otherLength) {
        commonPart += "/";
        commonPathname += commonPart;
      }
      return commonPathname;
    }
  }
  if (length === otherLength) {
    commonPathname += commonPart;
  } else if (otherPathname.charAt(i) === "/") {
    commonPathname += commonPart;
  }
  return commonPathname;
};

const urlToRelativeUrl = (url, baseUrl, {
  preferRelativeNotation
} = {}) => {
  const urlObject = new URL(url);
  const baseUrlObject = new URL(baseUrl);
  if (urlObject.protocol !== baseUrlObject.protocol) {
    const urlAsString = String(url);
    return urlAsString;
  }
  if (urlObject.username !== baseUrlObject.username || urlObject.password !== baseUrlObject.password || urlObject.host !== baseUrlObject.host) {
    const afterUrlScheme = String(url).slice(urlObject.protocol.length);
    return afterUrlScheme;
  }
  const {
    pathname,
    hash,
    search
  } = urlObject;
  if (pathname === "/") {
    const baseUrlResourceWithoutLeadingSlash = baseUrlObject.pathname.slice(1);
    return baseUrlResourceWithoutLeadingSlash;
  }
  const basePathname = baseUrlObject.pathname;
  const commonPathname = getCommonPathname(pathname, basePathname);
  if (!commonPathname) {
    const urlAsString = String(url);
    return urlAsString;
  }
  const specificPathname = pathname.slice(commonPathname.length);
  const baseSpecificPathname = basePathname.slice(commonPathname.length);
  if (baseSpecificPathname.includes("/")) {
    const baseSpecificParentPathname = pathnameToParentPathname(baseSpecificPathname);
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(/.*?\//g, "../");
    const relativeUrl = "".concat(relativeDirectoriesNotation).concat(specificPathname).concat(search).concat(hash);
    return relativeUrl;
  }
  const relativeUrl = "".concat(specificPathname).concat(search).concat(hash);
  return preferRelativeNotation ? "./".concat(relativeUrl) : relativeUrl;
};
const pathnameToParentPathname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const urlToFileSystemPath = url => {
  const urlObject = new URL(url);
  let {
    origin,
    pathname,
    hash
  } = urlObject;
  if (urlObject.protocol === "file:") {
    origin = "file://";
  }
  pathname = pathname.split("/").map(part => {
    return part.replace(/%(?![0-9A-F][0-9A-F])/g, "%25");
  }).join("/");
  if (hash) {
    pathname += "%23".concat(encodeURIComponent(hash.slice(1)));
  }
  const urlString = "".concat(origin).concat(pathname);
  const fileSystemPath = fileURLToPath(urlString);
  if (fileSystemPath[fileSystemPath.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    return fileSystemPath.slice(0, -1);
  }
  return fileSystemPath;
};

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const intToChar = new Uint8Array(64); // 64 possible chars.
const charToInt = new Uint8Array(128); // z is 122 in ASCII
for (let i = 0; i < chars.length; i++) {
  const c = chars.charCodeAt(i);
  intToChar[i] = c;
  charToInt[c] = i;
}

const require = createRequire(import.meta.url);
// consider using https://github.com/7rulnik/source-map-js

const requireSourcemap = () => {
  const namespace = require("source-map-js");
  return namespace;
};

/*
 * https://github.com/mozilla/source-map#sourcemapgenerator
 */

requireSourcemap();

// https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
const getOriginalPosition = ({
  sourcemap,
  line,
  column,
  bias
}) => {
  const {
    SourceMapConsumer
  } = requireSourcemap();
  const sourceMapConsumer = new SourceMapConsumer(sourcemap);
  const originalPosition = sourceMapConsumer.originalPositionFor({
    line,
    column,
    bias
  });
  return originalPosition;
};

const generateSourcemapDataUrl = sourcemap => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return "data:application/json;charset=utf-8;base64,".concat(asBase64);
};

const SOURCEMAP = {
  enabledOnContentType: contentType => {
    return ["text/javascript", "text/css"].includes(contentType);
  },
  readComment: ({
    contentType,
    content
  }) => {
    const read = {
      "text/javascript": parseJavaScriptSourcemapComment,
      "text/css": parseCssSourcemapComment
    }[contentType];
    return read ? read(content) : null;
  },
  removeComment: ({
    contentType,
    content
  }) => {
    return SOURCEMAP.writeComment({
      contentType,
      content,
      specifier: ""
    });
  },
  writeComment: ({
    contentType,
    content,
    specifier
  }) => {
    const write = {
      "text/javascript": setJavaScriptSourceMappingUrl,
      "text/css": setCssSourceMappingUrl
    }[contentType];
    return write ? write(content, specifier) : content;
  }
};
const parseJavaScriptSourcemapComment = javaScriptSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, value => {
    sourceMappingUrl = value;
  });
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "js",
    // we assume it's on last line
    line: javaScriptSource.split(/\r?\n/).length,
    // ${"//#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: "//#".concat(" sourceMappingURL=").length + 1,
    specifier: sourceMappingUrl
  };
};
const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl) : "";
  });
  if (replaced) {
    return sourceAfterReplace;
  }
  return sourceMappingFileUrl ? "".concat(javaScriptSource, "\n").concat(writeJavaScriptSourceMappingURL(sourceMappingFileUrl), "\n") : javaScriptSource;
};
const parseCssSourcemapComment = cssSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, value => {
    sourceMappingUrl = value;
  });
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "css",
    // we assume it's on last line
    line: cssSource.split(/\r?\n/).length - 1,
    // ${"//*#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: "//*#".concat(" sourceMappingURL=").length + 1,
    specifier: sourceMappingUrl
  };
};
const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeCssSourceMappingUrl(sourceMappingFileUrl) : "";
  });
  if (replaced) {
    return sourceAfterReplace;
  }
  return sourceMappingFileUrl ? "".concat(cssSource, "\n").concat(writeCssSourceMappingUrl(sourceMappingFileUrl), "\n") : cssSource;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g;

// ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
const writeJavaScriptSourceMappingURL = value => {
  return "//#".concat(" sourceMappingURL=", value);
};
const writeCssSourceMappingUrl = value => {
  return "/*# sourceMappingURL=".concat(value, " */");
};
const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;
  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return "".concat(before).concat(mappedAfter);
  }
  return source;
};

/*
 * ```js
 * console.log(42)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsClassicStart('main.html@L10-L13.js')
 * try {
 *   console.log(42)
 *   window.__supervisor__.jsClassicEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsClassicError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * ```js
 * import value from "./file.js"
 * console.log(value)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsModuleStart('main.html@L10-L13.js')
 * try {
 *   const value = await import("./file.js")
 *   console.log(value)
 *   window.__supervisor__.jsModuleEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsModuleError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * -> TO KEEP IN MIND:
 * Static import can throw errors like
 * The requested module '/js_module_export_not_found/foo.js' does not provide an export named 'answerr'
 * While dynamic import will work just fine
 * and create a variable named "undefined"
 */

const injectSupervisorIntoJs = async ({
  content,
  url,
  type,
  inlineSrc,
  sourcemaps
}) => {
  const babelPluginJsSupervisor = type === "js_module" ? babelPluginJsModuleSupervisor : babelPluginJsClassicSupervisor;
  const result = await applyBabelPlugins({
    babelPlugins: [[babelPluginJsSupervisor, {
      inlineSrc
    }]],
    input: content,
    inputIsJsModule: type === "js_module",
    inputUrl: url
  });
  let code = result.code;
  if (sourcemaps === "inline") {
    const map = result.map;
    const sourcemapDataUrl = generateSourcemapDataUrl(map);
    code = SOURCEMAP.writeComment({
      contentType: "text/javascript",
      content: code,
      specifier: sourcemapDataUrl
    });
  }
  code = "".concat(code, "\n//# sourceURL=").concat(inlineSrc);
  return code;
};
const babelPluginJsModuleSupervisor = babel => {
  const t = babel.types;
  return {
    name: "js-module-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const {
          inlineSrc
        } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;
        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleStart"
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleEnd"
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleError",
          args: [t.identifier("e")]
        });
        const bodyPath = programPath.get("body");
        const importNodes = [];
        const topLevelNodes = [];
        for (const topLevelNodePath of bodyPath) {
          const topLevelNode = topLevelNodePath.node;
          if (t.isImportDeclaration(topLevelNode)) {
            importNodes.push(topLevelNode);
          } else {
            topLevelNodes.push(topLevelNode);
          }
        }

        // replace all import nodes with dynamic imports
        const dynamicImports = [];
        importNodes.forEach(importNode => {
          const dynamicImportConversion = convertStaticImportIntoDynamicImport(importNode, t);
          if (Array.isArray(dynamicImportConversion)) {
            dynamicImports.push(...dynamicImportConversion);
          } else {
            dynamicImports.push(dynamicImportConversion);
          }
        });
        const tryCatchNode = t.tryStatement(t.blockStatement([...dynamicImports, ...topLevelNodes, endCallNode]), t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])));
        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      }
    }
  };
};
const convertStaticImportIntoDynamicImport = (staticImportNode, t) => {
  const awaitExpression = t.awaitExpression(t.callExpression(t.import(), [t.stringLiteral(staticImportNode.source.value)]));

  // import "./file.js" -> await import("./file.js")
  if (staticImportNode.specifiers.length === 0) {
    return t.expressionStatement(awaitExpression);
  }
  if (staticImportNode.specifiers.length === 1) {
    const [firstSpecifier] = staticImportNode.specifiers;
    if (firstSpecifier.type === "ImportNamespaceSpecifier") {
      return t.variableDeclaration("const", [t.variableDeclarator(t.identifier(firstSpecifier.local.name), awaitExpression)]);
    }
  }
  if (staticImportNode.specifiers.length === 2) {
    const [first, second] = staticImportNode.specifiers;
    if (first.type === "ImportDefaultSpecifier" && second.type === "ImportNamespaceSpecifier") {
      const namespaceDeclaration = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(second.local.name), awaitExpression)]);
      const defaultDeclaration = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(first.local.name), t.memberExpression(t.identifier(second.local.name), t.identifier("default")))]);
      return [namespaceDeclaration, defaultDeclaration];
    }
  }

  // import { name } from "./file.js" -> const { name } = await import("./file.js")
  // import toto, { name } from "./file.js" -> const { name, default as toto } = await import("./file.js")
  const objectPattern = t.objectPattern(staticImportNode.specifiers.map(specifier => {
    if (specifier.type === "ImportDefaultSpecifier") {
      return t.objectProperty(t.identifier("default"), t.identifier(specifier.local.name), false,
      // computed
      false // shorthand
      );
    }
    // if (specifier.type === "ImportNamespaceSpecifier") {
    //   return t.restElement(t.identifier(specifier.local.name))
    // }
    const isRenamed = specifier.imported.name !== specifier.local.name;
    if (isRenamed) {
      return t.objectProperty(t.identifier(specifier.imported.name), t.identifier(specifier.local.name), false,
      // computed
      false // shorthand
      );
    }
    // shorthand must be true
    return t.objectProperty(t.identifier(specifier.local.name), t.identifier(specifier.local.name), false,
    // computed
    true // shorthand
    );
  }));
  const variableDeclarator = t.variableDeclarator(objectPattern, awaitExpression);
  const variableDeclaration = t.variableDeclaration("const", [variableDeclarator]);
  return variableDeclaration;
};
const babelPluginJsClassicSupervisor = babel => {
  const t = babel.types;
  return {
    name: "js-classic-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const {
          inlineSrc
        } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;
        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicStart"
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicEnd"
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicError",
          args: [t.identifier("e")]
        });
        const topLevelNodes = programPath.node.body;
        const tryCatchNode = t.tryStatement(t.blockStatement([...topLevelNodes, endCallNode]), t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])));
        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      }
    }
  };
};
const createSupervisionCall = ({
  t,
  methodName,
  urlNode,
  args = []
}) => {
  return t.expressionStatement(t.callExpression(t.memberExpression(t.memberExpression(t.identifier("window"), t.identifier("__supervisor__")), t.identifier(methodName)), [urlNode, ...args]), [], null);
};

/*
 * Jsenv needs to track js execution in order to:
 * 1. report errors
 * 2. wait for all js execution inside an HTML page before killing the browser
 *
 * A naive approach would rely on "load" events on window but:
 * scenario                                    | covered by window "load"
 * ------------------------------------------- | -------------------------
 * js referenced by <script src>               | yes
 * js inlined into <script>                    | yes
 * js referenced by <script type="module" src> | partially (not for import and top level await)
 * js inlined into <script type="module">      | not at all
 * Same for "error" event on window who is not enough
 *
 * <script src="file.js">
 * becomes
 * <script>
 *   window.__supervisor__.superviseScript('file.js')
 * </script>
 *
 * <script>
 *    console.log(42)
 * </script>
 * becomes
 * <script inlined-from-src="main.html@L10-C5.js">
 *   window.__supervisor.__superviseScript("main.html@L10-C5.js")
 * </script>
 *
 * <script type="module" src="module.js"></script>
 * becomes
 * <script type="module">
 *   window.__supervisor__.superviseScriptTypeModule('module.js')
 * </script>
 *
 * <script type="module">
 *   console.log(42)
 * </script>
 * becomes
 * <script type="module" inlined-from-src="main.html@L10-C5.js">
 *   window.__supervisor__.superviseScriptTypeModule('main.html@L10-C5.js')
 * </script>
 *
 * Why Inline scripts are converted to files dynamically?
 * -> No changes required on js source code, it's only the HTML that is modified
 *   - Also allow to catch syntax errors and export missing
 */

const supervisorFileUrl = new URL("./js/supervisor.js", import.meta.url).href;
const injectSupervisorIntoHTML = async ({
  content,
  url
}, {
  supervisorScriptSrc = supervisorFileUrl,
  supervisorOptions,
  webServer,
  onInlineScript = () => {},
  generateInlineScriptSrc = ({
    inlineScriptUrl
  }) => urlToRelativeUrl(inlineScriptUrl, webServer.rootDirectoryUrl),
  inlineAsRemote,
  sourcemaps = "inline"
}) => {
  const htmlAst = parseHtml({
    html: content,
    url
  });
  const mutations = [];
  const actions = [];
  const scriptInfos = [];
  // 1. Find inline and remote scripts
  {
    const handleInlineScript = (scriptNode, {
      type,
      textContent
    }) => {
      const {
        line,
        column,
        isOriginal
      } = getHtmlNodePosition(scriptNode, {
        preferOriginal: true
      });
      const inlineScriptUrl = getUrlForContentInsideHtml(scriptNode, {
        htmlUrl: url
      });
      const inlineScriptSrc = generateInlineScriptSrc({
        type,
        textContent,
        inlineScriptUrl,
        isOriginal,
        line,
        column
      });
      onInlineScript({
        type,
        textContent,
        url: inlineScriptUrl,
        isOriginal,
        line,
        column,
        src: inlineScriptSrc
      });
      if (inlineAsRemote) {
        // prefere la version src
        scriptInfos.push({
          type,
          src: inlineScriptSrc
        });
        const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
          type,
          src: inlineScriptSrc
        });
        mutations.push(() => {
          setHtmlNodeText(scriptNode, remoteJsSupervised, {
            indentation: "auto"
          });
          setHtmlNodeAttributes(scriptNode, {
            "jsenv-cooked-by": "jsenv:supervisor",
            "src": undefined,
            "inlined-from-src": inlineScriptSrc
          });
        });
      } else {
        scriptInfos.push({
          type,
          src: inlineScriptSrc,
          isInline: true
        });
        actions.push(async () => {
          try {
            const inlineJsSupervised = await injectSupervisorIntoJs({
              webServer,
              content: textContent,
              url: inlineScriptUrl,
              type,
              inlineSrc: inlineScriptSrc,
              sourcemaps
            });
            mutations.push(() => {
              setHtmlNodeText(scriptNode, inlineJsSupervised, {
                indentation: "auto"
              });
              setHtmlNodeAttributes(scriptNode, {
                "jsenv-cooked-by": "jsenv:supervisor"
              });
            });
          } catch (e) {
            if (e.code === "PARSE_ERROR") {
              // mutations.push(() => {
              //   setHtmlNodeAttributes(scriptNode, {
              //     "jsenv-cooked-by": "jsenv:supervisor",
              //   })
              // })
              // on touche a rien
              return;
            }
            throw e;
          }
        });
      }
    };
    const handleScriptWithSrc = (scriptNode, {
      type,
      src
    }) => {
      scriptInfos.push({
        type,
        src
      });
      const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
        type,
        src
      });
      mutations.push(() => {
        setHtmlNodeText(scriptNode, remoteJsSupervised, {
          indentation: "auto"
        });
        setHtmlNodeAttributes(scriptNode, {
          "jsenv-cooked-by": "jsenv:supervisor",
          "src": undefined,
          "inlined-from-src": src
        });
      });
    };
    visitHtmlNodes(htmlAst, {
      script: scriptNode => {
        const {
          type
        } = analyzeScriptNode(scriptNode);
        if (type !== "js_classic" && type !== "js_module") {
          return;
        }
        if (getHtmlNodeAttribute(scriptNode, "jsenv-injected-by")) {
          return;
        }
        const noSupervisor = getHtmlNodeAttribute(scriptNode, "no-supervisor");
        if (noSupervisor !== undefined) {
          return;
        }
        const scriptNodeText = getHtmlNodeText(scriptNode);
        if (scriptNodeText) {
          handleInlineScript(scriptNode, {
            type,
            textContent: scriptNodeText
          });
          return;
        }
        const src = getHtmlNodeAttribute(scriptNode, "src");
        if (src) {
          const urlObject = new URL(src, "http://example.com/");
          if (urlObject.searchParams.has("inline")) {
            return;
          }
          handleScriptWithSrc(scriptNode, {
            type,
            src
          });
          return;
        }
      }
    });
  }
  // 2. Inject supervisor js file + setup call
  {
    injectJsenvScript(htmlAst, {
      src: supervisorScriptSrc,
      initCall: {
        callee: "window.__supervisor__.setup",
        params: {
          ...supervisorOptions,
          serverIsJsenvDevServer: webServer.isJsenvDevServer,
          rootDirectoryUrl: webServer.rootDirectoryUrl,
          scriptInfos
        }
      },
      pluginName: "jsenv:supervisor"
    });
  }
  // 3. Perform actions (transforming inline script content) and html mutations
  if (actions.length > 0) {
    await Promise.all(actions.map(action => action()));
  }
  mutations.forEach(mutation => mutation());
  const htmlModified = stringifyHtmlAst(htmlAst);
  return {
    content: htmlModified
  };
};
const generateCodeToSuperviseScriptWithSrc = ({
  type,
  src
}) => {
  const srcEncoded = JSON.stringify(src);
  if (type === "js_module") {
    return "window.__supervisor__.superviseScriptTypeModule(".concat(srcEncoded, ", (url) => import(url));");
  }
  return "window.__supervisor__.superviseScript(".concat(srcEncoded, ");");
};

// https://nodejs.org/api/packages.html#resolving-user-conditions
const readCustomConditionsFromProcessArgs = () => {
  const packageConditions = [];
  process.execArgv.forEach(arg => {
    if (arg.includes("-C=")) {
      const packageCondition = arg.slice(0, "-C=".length);
      packageConditions.push(packageCondition);
    }
    if (arg.includes("--conditions=")) {
      const packageCondition = arg.slice("--conditions=".length);
      packageConditions.push(packageCondition);
    }
  });
  return packageConditions;
};

const asDirectoryUrl = url => {
  const {
    pathname
  } = new URL(url);
  if (pathname.endsWith("/")) {
    return url;
  }
  return new URL("./", url).href;
};
const getParentUrl = url => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const resource = url.slice("file://".length);
    const slashLastIndex = resource.lastIndexOf("/");
    if (slashLastIndex === -1) {
      return url;
    }
    const lastCharIndex = resource.length - 1;
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = resource.lastIndexOf("/", slashLastIndex - 1);
      if (slashBeforeLastIndex === -1) {
        return url;
      }
      return "file://".concat(resource.slice(0, slashBeforeLastIndex + 1));
    }
    return "file://".concat(resource.slice(0, slashLastIndex + 1));
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};
const isValidUrl = url => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (_unused) {
    return false;
  }
};

const defaultLookupPackageScope = url => {
  let scopeUrl = asDirectoryUrl(url);
  while (scopeUrl !== "file:///") {
    if (scopeUrl.endsWith("node_modules/")) {
      return null;
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl);
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl;
    }
    scopeUrl = getParentUrl(scopeUrl);
  }
  return null;
};

const defaultReadPackageJson = packageUrl => {
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch (_unused) {
    throw new Error("Invalid package configuration");
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473
const createInvalidModuleSpecifierError = (reason, specifier, {
  parentUrl
}) => {
  const error = new Error("Invalid module \"".concat(specifier, "\" ").concat(reason, " imported from ").concat(fileURLToPath(parentUrl)));
  error.code = "INVALID_MODULE_SPECIFIER";
  return error;
};
const createInvalidPackageTargetError = (reason, target, {
  parentUrl,
  packageDirectoryUrl,
  key,
  isImport
}) => {
  let message;
  if (key === ".") {
    message = "Invalid \"exports\" main target defined in ".concat(fileURLToPath(packageDirectoryUrl), "package.json imported from ").concat(fileURLToPath(parentUrl), "; ").concat(reason);
  } else {
    message = "Invalid \"".concat(isImport ? "imports" : "exports", "\" target ").concat(JSON.stringify(target), " defined for \"").concat(key, "\" in ").concat(fileURLToPath(packageDirectoryUrl), "package.json imported from ").concat(fileURLToPath(parentUrl), "; ").concat(reason);
  }
  const error = new Error(message);
  error.code = "INVALID_PACKAGE_TARGET";
  return error;
};
const createPackagePathNotExportedError = (subpath, {
  parentUrl,
  packageDirectoryUrl
}) => {
  let message;
  if (subpath === ".") {
    message = "No \"exports\" main defined in ".concat(fileURLToPath(packageDirectoryUrl), "package.json imported from ").concat(fileURLToPath(parentUrl));
  } else {
    message = "Package subpath \"".concat(subpath, "\" is not defined by \"exports\" in ").concat(fileURLToPath(packageDirectoryUrl), "package.json imported from ").concat(fileURLToPath(parentUrl));
  }
  const error = new Error(message);
  error.code = "PACKAGE_PATH_NOT_EXPORTED";
  return error;
};
const createModuleNotFoundError = (specifier, {
  parentUrl
}) => {
  const error = new Error("Cannot find \"".concat(specifier, "\" imported from ").concat(fileURLToPath(parentUrl)));
  error.code = "MODULE_NOT_FOUND";
  return error;
};
const createPackageImportNotDefinedError = (specifier, {
  parentUrl,
  packageDirectoryUrl
}) => {
  const error = new Error("Package import specifier \"".concat(specifier, "\" is not defined in ").concat(fileURLToPath(packageDirectoryUrl), "package.json imported from ").concat(fileURLToPath(parentUrl)));
  error.code = "PACKAGE_IMPORT_NOT_DEFINED";
  return error;
};

const isSpecifierForNodeBuiltin = specifier => {
  return specifier.startsWith("node:") || NODE_BUILTIN_MODULE_SPECIFIERS.includes(specifier);
};
const NODE_BUILTIN_MODULE_SPECIFIERS = ["assert", "assert/strict", "async_hooks", "buffer_ieee754", "buffer", "child_process", "cluster", "console", "constants", "crypto", "_debugger", "dgram", "dns", "domain", "events", "freelist", "fs", "fs/promises", "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server", "http", "http2", "https", "inspector", "_linklist", "module", "net", "node-inspect/lib/_inspect", "node-inspect/lib/internal/inspect_client", "node-inspect/lib/internal/inspect_repl", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "smalloc", "_stream_duplex", "_stream_transform", "_stream_wrap", "_stream_passthrough", "_stream_readable", "_stream_writable", "stream", "stream/promises", "string_decoder", "sys", "timers", "_tls_common", "_tls_legacy", "_tls_wrap", "tls", "trace_events", "tty", "url", "util", "v8/tools/arguments", "v8/tools/codemap", "v8/tools/consarray", "v8/tools/csvparser", "v8/tools/logreader", "v8/tools/profile_view", "v8/tools/splaytree", "v8", "vm", "worker_threads", "zlib",
// global is special
"global"];

/*
 * https://nodejs.org/api/esm.html#resolver-algorithm-specification
 * https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L1
 * deviations from the spec:
 * - take into account "browser", "module" and "jsnext"
 * - the check for isDirectory -> throw is delayed is descoped to the caller
 * - the call to real path ->
 *   delayed to the caller so that we can decide to
 *   maintain symlink as facade url when it's outside project directory
 *   or use the real path when inside
 */
const applyNodeEsmResolution = ({
  specifier,
  parentUrl,
  conditions = [...readCustomConditionsFromProcessArgs(), "node", "import"],
  lookupPackageScope = defaultLookupPackageScope,
  readPackageJson = defaultReadPackageJson,
  preservesSymlink = false
}) => {
  const resolution = applyPackageSpecifierResolution(specifier, {
    parentUrl: String(parentUrl),
    conditions,
    lookupPackageScope,
    readPackageJson,
    preservesSymlink
  });
  const {
    url
  } = resolution;
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError("must not include encoded \"/\" or \"\\\" characters", specifier, {
        parentUrl
      });
    }
    return resolution;
  }
  return resolution;
};
const applyPackageSpecifierResolution = (specifier, resolutionContext) => {
  const {
    parentUrl
  } = resolutionContext;
  // relative specifier
  if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution(specifier, resolutionContext);
      if (browserFieldResolution) {
        return browserFieldResolution;
      }
    }
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href
    };
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution(specifier, resolutionContext);
  }
  try {
    const urlObject = new URL(specifier);
    if (specifier.startsWith("node:")) {
      return {
        type: "node_builtin_specifier",
        url: specifier
      };
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href
    };
  } catch (_unused) {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution(specifier, resolutionContext);
    if (browserFieldResolution) {
      return browserFieldResolution;
    }
    const packageResolution = applyPackageResolve(specifier, resolutionContext);
    const search = new URL(specifier, "file:///").search;
    if (search && !new URL(packageResolution.url).search) {
      packageResolution.url = "".concat(packageResolution.url).concat(search);
    }
    return packageResolution;
  }
};
const applyBrowserFieldResolution = (specifier, resolutionContext) => {
  const {
    parentUrl,
    conditions,
    lookupPackageScope,
    readPackageJson
  } = resolutionContext;
  const browserCondition = conditions.includes("browser");
  if (!browserCondition) {
    return null;
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (!packageDirectoryUrl) {
    return null;
  }
  const packageJson = readPackageJson(packageDirectoryUrl);
  if (!packageJson) {
    return null;
  }
  const {
    browser
  } = packageJson;
  if (!browser) {
    return null;
  }
  if (typeof browser !== "object") {
    return null;
  }
  let url;
  if (specifier.startsWith(".")) {
    const specifierUrl = new URL(specifier, parentUrl).href;
    const specifierRelativeUrl = specifierUrl.slice(packageDirectoryUrl.length);
    const secifierRelativeNotation = "./".concat(specifierRelativeUrl);
    const browserMapping = browser[secifierRelativeNotation];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = "file:///@ignore/".concat(specifierUrl.slice("file:///"));
    }
  } else {
    const browserMapping = browser[specifier];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = "file:///@ignore/".concat(specifier);
    }
  }
  if (url) {
    return {
      type: "field:browser",
      packageDirectoryUrl,
      packageJson,
      url
    };
  }
  return null;
};
const applyPackageImportsResolution = (internalSpecifier, resolutionContext) => {
  const {
    parentUrl,
    lookupPackageScope,
    readPackageJson
  } = resolutionContext;
  if (internalSpecifier === "#" || internalSpecifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError("not a valid internal imports specifier name", internalSpecifier, resolutionContext);
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (packageDirectoryUrl !== null) {
    const packageJson = readPackageJson(packageDirectoryUrl);
    const {
      imports
    } = packageJson;
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution(internalSpecifier, {
        ...resolutionContext,
        packageDirectoryUrl,
        packageJson,
        isImport: true
      });
      if (resolved) {
        return resolved;
      }
    }
  }
  throw createPackageImportNotDefinedError(internalSpecifier, {
    ...resolutionContext,
    packageDirectoryUrl
  });
};
const applyPackageResolve = (packageSpecifier, resolutionContext) => {
  const {
    parentUrl,
    conditions,
    readPackageJson,
    preservesSymlink
  } = resolutionContext;
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier");
  }
  if (conditions.includes("node") && isSpecifierForNodeBuiltin(packageSpecifier)) {
    return {
      type: "node_builtin_specifier",
      url: "node:".concat(packageSpecifier)
    };
  }
  let {
    packageName,
    packageSubpath
  } = parsePackageSpecifier(packageSpecifier);
  if (packageName[0] === "." || packageName.includes("\\") || packageName.includes("%")) {
    throw createInvalidModuleSpecifierError("is not a valid package name", packageName, resolutionContext);
  }
  if (packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier");
  }
  const questionCharIndex = packageName.indexOf("?");
  if (questionCharIndex > -1) {
    packageName = packageName.slice(0, questionCharIndex);
  }
  const selfResolution = applyPackageSelfResolution(packageSubpath, {
    ...resolutionContext,
    packageName
  });
  if (selfResolution) {
    return selfResolution;
  }
  let currentUrl = parentUrl;
  while (currentUrl !== "file:///") {
    const packageDirectoryFacadeUrl = new URL("node_modules/".concat(packageName, "/"), currentUrl).href;
    if (!existsSync(new URL(packageDirectoryFacadeUrl))) {
      currentUrl = getParentUrl(currentUrl);
      continue;
    }
    const packageDirectoryUrl = preservesSymlink ? packageDirectoryFacadeUrl : resolvePackageSymlink(packageDirectoryFacadeUrl);
    const packageJson = readPackageJson(packageDirectoryUrl);
    if (packageJson !== null) {
      const {
        exports
      } = packageJson;
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports
        });
      }
    }
    return applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson
    });
  }
  throw createModuleNotFoundError(packageName, resolutionContext);
};
const applyPackageSelfResolution = (packageSubpath, resolutionContext) => {
  const {
    parentUrl,
    packageName,
    lookupPackageScope,
    readPackageJson
  } = resolutionContext;
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (!packageDirectoryUrl) {
    return undefined;
  }
  const packageJson = readPackageJson(packageDirectoryUrl);
  if (!packageJson) {
    return undefined;
  }
  if (packageJson.name !== packageName) {
    return undefined;
  }
  const {
    exports
  } = packageJson;
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson
    });
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution;
    }
    return undefined;
  }
  return applyPackageExportsResolution(packageSubpath, {
    ...resolutionContext,
    packageDirectoryUrl,
    packageJson
  });
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = (packageSubpath, resolutionContext) => {
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution(resolutionContext);
    if (!mainExport) {
      throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
    }
    const resolved = applyPackageTargetResolution(mainExport, {
      ...resolutionContext,
      key: "."
    });
    if (resolved) {
      return resolved;
    }
    throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
  }
  const packageExportsInfo = readExports(resolutionContext);
  if (packageExportsInfo.type === "object" && packageExportsInfo.allKeysAreRelative) {
    const resolved = applyPackageImportsExportsResolution(packageSubpath, {
      ...resolutionContext,
      isImport: false
    });
    if (resolved) {
      return resolved;
    }
  }
  throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
};
const applyPackageImportsExportsResolution = (matchKey, resolutionContext) => {
  const {
    packageJson,
    isImport
  } = resolutionContext;
  const matchObject = isImport ? packageJson.imports : packageJson.exports;
  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey];
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      isImport
    });
  }
  const expansionKeys = Object.keys(matchObject).filter(key => key.split("*").length === 2).sort(comparePatternKeys);
  for (const expansionKey of expansionKeys) {
    const [patternBase, patternTrailer] = expansionKey.split("*");
    if (matchKey === patternBase) continue;
    if (!matchKey.startsWith(patternBase)) continue;
    if (patternTrailer.length > 0) {
      if (!matchKey.endsWith(patternTrailer)) continue;
      if (matchKey.length < expansionKey.length) continue;
    }
    const target = matchObject[expansionKey];
    const subpath = matchKey.slice(patternBase.length, matchKey.length - patternTrailer.length);
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      subpath,
      pattern: true,
      isImport
    });
  }
  return null;
};
const applyPackageTargetResolution = (target, resolutionContext) => {
  const {
    conditions,
    packageDirectoryUrl,
    packageJson,
    key,
    subpath = "",
    pattern = false,
    isImport = false
  } = resolutionContext;
  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier");
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageDirectoryUrl).href;
      if (!targetUrl.startsWith(packageDirectoryUrl)) {
        throw createInvalidPackageTargetError("target must be inside package", target, resolutionContext);
      }
      return {
        type: isImport ? "field:imports" : "field:exports",
        packageDirectoryUrl,
        packageJson,
        url: pattern ? targetUrl.replaceAll("*", subpath) : new URL(subpath, targetUrl).href
      };
    }
    if (!isImport || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError("target must starst with \"./\"", target, resolutionContext);
    }
    return applyPackageResolve(pattern ? target.replaceAll("*", subpath) : "".concat(target).concat(subpath), {
      ...resolutionContext,
      parentUrl: packageDirectoryUrl
    });
  }
  if (Array.isArray(target)) {
    if (target.length === 0) {
      return null;
    }
    let lastResult;
    let i = 0;
    while (i < target.length) {
      const targetValue = target[i];
      i++;
      try {
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key: "".concat(key, "[").concat(i, "]"),
          subpath,
          pattern,
          isImport
        });
        if (resolved) {
          return resolved;
        }
        lastResult = resolved;
      } catch (e) {
        if (e.code === "INVALID_PACKAGE_TARGET") {
          continue;
        }
        lastResult = e;
      }
    }
    if (lastResult) {
      throw lastResult;
    }
    return null;
  }
  if (target === null) {
    return null;
  }
  if (typeof target === "object") {
    const keys = Object.keys(target);
    for (const key of keys) {
      if (Number.isInteger(key)) {
        throw new Error("Invalid package configuration");
      }
      if (key === "default" || conditions.includes(key)) {
        const targetValue = target[key];
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key,
          subpath,
          pattern,
          isImport
        });
        if (resolved) {
          return resolved;
        }
      }
    }
    return null;
  }
  throw createInvalidPackageTargetError("target must be a string, array, object or null", target, resolutionContext);
};
const readExports = ({
  packageDirectoryUrl,
  packageJson
}) => {
  const packageExports = packageJson.exports;
  if (Array.isArray(packageExports)) {
    return {
      type: "array"
    };
  }
  if (packageExports === null) {
    return {};
  }
  if (typeof packageExports === "object") {
    const keys = Object.keys(packageExports);
    const relativeKeys = [];
    const conditionalKeys = [];
    keys.forEach(availableKey => {
      if (availableKey.startsWith(".")) {
        relativeKeys.push(availableKey);
      } else {
        conditionalKeys.push(availableKey);
      }
    });
    const hasRelativeKey = relativeKeys.length > 0;
    if (hasRelativeKey && conditionalKeys.length > 0) {
      throw new Error("Invalid package configuration: cannot mix relative and conditional keys in package.exports\n--- unexpected keys ---\n".concat(conditionalKeys.map(key => "\"".concat(key, "\"")).join("\n"), "\n--- package directory url ---\n").concat(packageDirectoryUrl));
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length
    };
  }
  if (typeof packageExports === "string") {
    return {
      type: "string"
    };
  }
  return {};
};
const parsePackageSpecifier = packageSpecifier => {
  if (packageSpecifier[0] === "@") {
    const firstSlashIndex = packageSpecifier.indexOf("/");
    if (firstSlashIndex === -1) {
      throw new Error("invalid module specifier");
    }
    const secondSlashIndex = packageSpecifier.indexOf("/", firstSlashIndex + 1);
    if (secondSlashIndex === -1) {
      return {
        packageName: packageSpecifier,
        packageSubpath: ".",
        isScoped: true
      };
    }
    const packageName = packageSpecifier.slice(0, secondSlashIndex);
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex + 1);
    const packageSubpath = "./".concat(afterSecondSlash);
    return {
      packageName,
      packageSubpath,
      isScoped: true
    };
  }
  const firstSlashIndex = packageSpecifier.indexOf("/");
  if (firstSlashIndex === -1) {
    return {
      packageName: packageSpecifier,
      packageSubpath: "."
    };
  }
  const packageName = packageSpecifier.slice(0, firstSlashIndex);
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex + 1);
  const packageSubpath = "./".concat(afterFirstSlash);
  return {
    packageName,
    packageSubpath
  };
};
const applyMainExportResolution = resolutionContext => {
  const {
    packageJson
  } = resolutionContext;
  const packageExportsInfo = readExports(resolutionContext);
  if (packageExportsInfo.type === "array" || packageExportsInfo.type === "string") {
    return packageJson.exports;
  }
  if (packageExportsInfo.type === "object") {
    if (packageExportsInfo.hasRelativeKey) {
      return packageJson.exports["."];
    }
    return packageJson.exports;
  }
  return undefined;
};
const applyLegacySubpathResolution = (packageSubpath, resolutionContext) => {
  const {
    packageDirectoryUrl,
    packageJson
  } = resolutionContext;
  if (packageSubpath === ".") {
    return applyLegacyMainResolution(packageSubpath, resolutionContext);
  }
  const browserFieldResolution = applyBrowserFieldResolution(packageSubpath, resolutionContext);
  if (browserFieldResolution) {
    return browserFieldResolution;
  }
  return {
    type: "subpath",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href
  };
};
const applyLegacyMainResolution = (packageSubpath, resolutionContext) => {
  const {
    conditions,
    packageDirectoryUrl,
    packageJson
  } = resolutionContext;
  for (const condition of conditions) {
    const conditionResolver = mainLegacyResolvers[condition];
    if (!conditionResolver) {
      continue;
    }
    const resolved = conditionResolver(resolutionContext);
    if (resolved) {
      return {
        type: resolved.type,
        packageDirectoryUrl,
        packageJson,
        url: new URL(resolved.path, packageDirectoryUrl).href
      };
    }
  }
  return {
    type: "field:main",
    // the absence of "main" field
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href
  };
};
const mainLegacyResolvers = {
  import: ({
    packageJson
  }) => {
    if (typeof packageJson.module === "string") {
      return {
        type: "field:module",
        path: packageJson.module
      };
    }
    if (typeof packageJson.jsnext === "string") {
      return {
        type: "field:jsnext",
        path: packageJson.jsnext
      };
    }
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        path: packageJson.main
      };
    }
    return null;
  },
  browser: ({
    packageDirectoryUrl,
    packageJson
  }) => {
    const browserMain = (() => {
      if (typeof packageJson.browser === "string") {
        return packageJson.browser;
      }
      if (typeof packageJson.browser === "object" && packageJson.browser !== null) {
        return packageJson.browser["."];
      }
      return "";
    })();
    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "field:module",
          path: packageJson.module
        };
      }
      return null;
    }
    if (typeof packageJson.module !== "string" || packageJson.module === browserMain) {
      return {
        type: "field:browser",
        path: browserMain
      };
    }
    const browserMainUrlObject = new URL(browserMain, packageDirectoryUrl);
    const content = readFileSync(browserMainUrlObject, "utf-8");
    if (/typeof exports\s*==/.test(content) && /typeof module\s*==/.test(content) || /module\.exports\s*=/.test(content)) {
      return {
        type: "field:module",
        path: packageJson.module
      };
    }
    return {
      type: "field:browser",
      path: browserMain
    };
  },
  node: ({
    packageJson
  }) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        path: packageJson.main
      };
    }
    return null;
  }
};
const comparePatternKeys = (keyA, keyB) => {
  if (!keyA.endsWith("/") && !keyA.includes("*")) {
    throw new Error("Invalid package configuration");
  }
  if (!keyB.endsWith("/") && !keyB.includes("*")) {
    throw new Error("Invalid package configuration");
  }
  const aStarIndex = keyA.indexOf("*");
  const baseLengthA = aStarIndex > -1 ? aStarIndex + 1 : keyA.length;
  const bStarIndex = keyB.indexOf("*");
  const baseLengthB = bStarIndex > -1 ? bStarIndex + 1 : keyB.length;
  if (baseLengthA > baseLengthB) {
    return -1;
  }
  if (baseLengthB > baseLengthA) {
    return 1;
  }
  if (aStarIndex === -1) {
    return 1;
  }
  if (bStarIndex === -1) {
    return -1;
  }
  if (keyA.length > keyB.length) {
    return -1;
  }
  if (keyB.length > keyA.length) {
    return 1;
  }
  return 0;
};
const resolvePackageSymlink = packageDirectoryUrl => {
  const packageDirectoryPath = realpathSync(new URL(packageDirectoryUrl));
  const packageDirectoryResolvedUrl = pathToFileURL(packageDirectoryPath).href;
  return "".concat(packageDirectoryResolvedUrl, "/");
};

process.platform === "win32";
fileSystemPathToUrl(process.cwd());

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */

process.platform === "win32";

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */

process.platform === "win32";

process.platform === "win32";

process.platform === "win32";

process.platform === "win32";

process.platform === "linux";

process.platform === "darwin";
process.platform === "linux";
process.platform === "freebsd";

/*
 * This plugin provides a way for jsenv to supervisor js execution:
 * - Know how many js are executed, when they are done, collect errors, etc...
 */

const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl
}) => {
  const resolveUrlSite = urlWithLineAndColumn => {
    const inlineUrlMatch = urlWithLineAndColumn.match(/@L([0-9]+)C([0-9]+)-L([0-9]+)C([0-9]+)\.\w+(:([0-9]+):([0-9]+))?$/);
    if (inlineUrlMatch) {
      const htmlUrl = injectQueryParams(urlWithLineAndColumn.slice(0, inlineUrlMatch.index), {
        hot: undefined
      });
      const tagLineStart = parseInt(inlineUrlMatch[1]);
      const tagColumnStart = parseInt(inlineUrlMatch[2]);
      // const tagLineEnd = parseInt(inlineUrlMatch[3]);
      // const tagColumnEnd = parseInt(inlineUrlMatch[4]);
      const inlineLine = inlineUrlMatch[6] === undefined ? undefined : parseInt(inlineUrlMatch[6]);
      const inlineColumn = inlineUrlMatch[7] === undefined ? undefined : parseInt(inlineUrlMatch[7]);
      return {
        file: htmlUrl,
        ownerLine: tagLineStart,
        ownerColumn: tagColumnStart,
        inlineLine,
        inlineColumn,
        line: inlineLine === undefined ? tagLineStart : tagLineStart + inlineLine,
        column: inlineColumn === undefined ? tagColumnStart : inlineColumn
      };
    }
    const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
    if (!match) {
      return null;
    }
    const file = injectQueryParams(urlWithLineAndColumn.slice(0, match.index), {
      hot: undefined
    });
    let line = parseInt(match[1]);
    let column = parseInt(match[2]);
    return {
      file,
      line,
      column
    };
  };
  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async serveInfo => {
      if (serveInfo.request.pathname.startsWith("/__get_cause_trace__/")) {
        const {
          pathname,
          searchParams
        } = new URL(serveInfo.request.url);
        const urlWithLineAndColumn = decodeURIComponent(pathname.slice("/__get_cause_trace__/".length));
        const result = resolveUrlSite(urlWithLineAndColumn);
        if (!result) {
          return {
            status: 400,
            body: "Missing line and column in url"
          };
        }
        let {
          file,
          line,
          column
        } = result;
        const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store"
            }
          };
        }
        if (!urlInfo.originalContent) {
          await urlInfo.fetchContent();
        }
        const remap = searchParams.has("remap");
        if (remap) {
          const sourcemap = urlInfo.sourcemap;
          if (sourcemap) {
            const original = getOriginalPosition({
              sourcemap,
              url: file,
              line,
              column
            });
            if (original.line !== null) {
              line = original.line;
              if (original.column !== null) {
                column = original.column;
              }
            }
          }
        }
        const causeTrace = {
          url: file,
          line,
          column,
          codeFrame: generateContentFrame({
            line,
            column,
            content: urlInfo.originalContent
          })
        };
        const causeTraceJson = JSON.stringify(causeTrace, null, "  ");
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(causeTraceJson)
          },
          body: causeTraceJson
        };
      }
      if (serveInfo.request.pathname.startsWith("/__get_error_cause__/")) {
        let file = serveInfo.request.pathname.slice("/__get_error_cause__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const {
          url
        } = applyNodeEsmResolution({
          conditions: [],
          parentUrl: serveInfo.rootDirectoryUrl,
          specifier: file
        });
        file = url;
        const getErrorCauseInfo = () => {
          const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
          if (!urlInfo) {
            return null;
          }
          const {
            error
          } = urlInfo;
          if (error) {
            return error;
          }
          // search in direct dependencies (404 or 500)
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            const referencedUrlInfo = referenceToOther.urlInfo;
            if (referencedUrlInfo.error) {
              return referencedUrlInfo.error;
            }
          }
          return null;
        };
        const causeInfo = getErrorCauseInfo();
        const body = JSON.stringify(causeInfo ? {
          code: causeInfo.code,
          name: causeInfo.name,
          message: causeInfo.message,
          reason: causeInfo.reason,
          stack: errorBaseUrl ? "stack mocked for snapshot" : causeInfo.stack,
          trace: causeInfo.trace
        } : null, null, "  ");
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body)
          },
          body
        };
      }
      if (serveInfo.request.pathname.startsWith("/__open_in_editor__/")) {
        let file = serveInfo.request.pathname.slice("/__open_in_editor__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const fileUrl = new URL(file, serveInfo.rootDirectoryUrl);
        const filePath = urlToFileSystemPath(fileUrl);
        const require = createRequire(import.meta.url);
        const launch = require("launch-editor");
        launch(filePath, () => {
          // ignore error for now
        });
        return {
          status: 200,
          headers: {
            "cache-control": "no-store"
          }
        };
      }
      return null;
    },
    transformUrlContent: {
      html: htmlUrlInfo => {
        const supervisorFileReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          expectedType: "js_classic",
          specifier: supervisorFileUrl
        });
        return injectSupervisorIntoHTML({
          content: htmlUrlInfo.content,
          url: htmlUrlInfo.url
        }, {
          supervisorScriptSrc: supervisorFileReference.generatedSpecifier,
          supervisorOptions: {
            errorBaseUrl,
            logs,
            measurePerf,
            errorOverlay,
            openInEditor
          },
          webServer: {
            rootDirectoryUrl: htmlUrlInfo.context.rootDirectoryUrl,
            isJsenvDevServer: true
          },
          inlineAsRemote: true,
          generateInlineScriptSrc: ({
            type,
            textContent,
            inlineScriptUrl,
            isOriginal,
            line,
            column
          }) => {
            const inlineScriptReference = htmlUrlInfo.dependencies.foundInline({
              type: "script",
              subtype: "inline",
              expectedType: type,
              isOriginalPosition: isOriginal,
              specifierLine: line,
              specifierColumn: column,
              specifier: inlineScriptUrl,
              contentType: "text/javascript",
              content: textContent
            });
            return inlineScriptReference.generatedSpecifier;
          },
          sourcemaps: htmlUrlInfo.kitchen.context.sourcemaps
        });
      }
    }
  };
};

export { injectSupervisorIntoHTML, jsenvPluginSupervisor, supervisorFileUrl };
