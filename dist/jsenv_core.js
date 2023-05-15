import { pathToFileURL, fileURLToPath } from "node:url";
import { chmod, stat, lstat, readdir, promises, unlink, openSync, closeSync, rmdir, readFileSync as readFileSync$1, watch, readdirSync, statSync, writeFileSync as writeFileSync$1, mkdirSync, createReadStream, readFile, existsSync, realpathSync } from "node:fs";
import crypto, { createHash } from "node:crypto";
import { extname } from "node:path";
import process$1 from "node:process";
import os, { networkInterfaces } from "node:os";
import tty from "node:tty";
import stringWidth from "string-width";
import net, { createServer, isIP } from "node:net";
import cluster from "node:cluster";
import { performance as performance$1 } from "node:perf_hooks";
import http from "node:http";
import { Readable, Stream, Writable } from "node:stream";
import { Http2ServerResponse } from "node:http2";
import { lookup } from "node:dns";
import { SOURCEMAP, generateSourcemapFileUrl, composeTwoSourcemaps, generateSourcemapDataUrl, createMagicSource, getOriginalPosition } from "@jsenv/sourcemap";
import { parseHtmlString, stringifyHtmlAst, getHtmlNodeAttribute, visitHtmlNodes, analyzeScriptNode, setHtmlNodeAttributes, parseSrcSet, getHtmlNodePosition, getHtmlNodeAttributePosition, parseCssUrls, parseJsUrls, getHtmlNodeText, setHtmlNodeText, removeHtmlNodeText, applyBabelPlugins, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, findHtmlNode, removeHtmlNode, injectJsImport, analyzeLinkNode, injectHtmlNode, insertHtmlNodeAfter } from "@jsenv/ast";
import { createRequire } from "node:module";
import babelParser from "@babel/parser";

/*
 * data:[<mediatype>][;base64],<data>
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs#syntax
 */

/* eslint-env browser, node */

const DATA_URL = {
  parse: string => {
    const afterDataProtocol = string.slice("data:".length);
    const commaIndex = afterDataProtocol.indexOf(",");
    const beforeComma = afterDataProtocol.slice(0, commaIndex);
    let contentType;
    let base64Flag;
    if (beforeComma.endsWith(`;base64`)) {
      contentType = beforeComma.slice(0, -`;base64`.length);
      base64Flag = true;
    } else {
      contentType = beforeComma;
      base64Flag = false;
    }
    contentType = contentType === "" ? "text/plain;charset=US-ASCII" : contentType;
    const afterComma = afterDataProtocol.slice(commaIndex + 1);
    return {
      contentType,
      base64Flag,
      data: afterComma
    };
  },
  stringify: ({
    contentType,
    base64Flag = true,
    data
  }) => {
    if (!contentType || contentType === "text/plain;charset=US-ASCII") {
      // can be a buffer or a string, hence check on data.length instead of !data or data === ''
      if (data.length === 0) {
        return `data:,`;
      }
      if (base64Flag) {
        return `data:;base64,${data}`;
      }
      return `data:,${data}`;
    }
    if (base64Flag) {
      return `data:${contentType};base64,${data}`;
    }
    return `data:${contentType},${data}`;
  }
};

const urlToScheme$1 = url => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }
  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource = url => {
  const scheme = urlToScheme$1(url);
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

const urlToPathname$1 = url => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
};
const resourceToPathname = resource => {
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

const urlToFilename$1 = url => {
  const pathname = urlToPathname$1(url);
  const pathnameBeforeLastSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename = slashLastIndex === -1 ? pathnameBeforeLastSlash : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};

const generateInlineContentUrl = ({
  url,
  extension,
  line,
  column,
  lineEnd,
  columnEnd
}) => {
  const generatedName = `L${line}C${column}-L${lineEnd}C${columnEnd}`;
  const filenameRaw = urlToFilename$1(url);
  const filename = `${filenameRaw}@${generatedName}${extension}`;
  // ideally we should keep query params from url
  // maybe we could use a custom scheme like "inline:"
  const inlineContentUrl = new URL(filename, url).href;
  return inlineContentUrl;
};

// consider switching to https://babeljs.io/docs/en/babel-code-frame
const stringifyUrlSite = ({
  url,
  line,
  column,
  content
}, {
  showCodeFrame = true,
  numberOfSurroundingLinesToShow,
  lineMaxLength,
  color
} = {}) => {
  let string = url;
  if (typeof line === "number") {
    string += `:${line}`;
    if (typeof column === "number") {
      string += `:${column}`;
    }
  }
  if (!showCodeFrame || typeof line !== "number" || !content) {
    return string;
  }
  const sourceLoc = showSourceLocation({
    content,
    line,
    column,
    numberOfSurroundingLinesToShow,
    lineMaxLength,
    color
  });
  return `${string}
${sourceLoc}`;
};
const showSourceLocation = ({
  content,
  line,
  column,
  numberOfSurroundingLinesToShow = 1,
  lineMaxLength = 120
} = {}) => {
  let mark = string => string;
  let aside = string => string;
  // if (color) {
  //   mark = (string) => ANSI.color(string, ANSI.RED)
  //   aside = (string) => ANSI.color(string, ANSI.GREY)
  // }

  const lines = content.split(/\r?\n/);
  if (line === 0) line = 1;
  let lineRange = {
    start: line - 1,
    end: line
  };
  lineRange = moveLineRangeUp(lineRange, numberOfSurroundingLinesToShow);
  lineRange = moveLineRangeDown(lineRange, numberOfSurroundingLinesToShow);
  lineRange = lineRangeWithinLines(lineRange, lines);
  const linesToShow = lines.slice(lineRange.start, lineRange.end);
  const endLineNumber = lineRange.end;
  const lineNumberMaxWidth = String(endLineNumber).length;
  if (column === 0) column = 1;
  const columnRange = {};
  if (column === undefined) {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  } else if (column > lineMaxLength) {
    columnRange.start = column - Math.floor(lineMaxLength / 2);
    columnRange.end = column + Math.ceil(lineMaxLength / 2);
  } else {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  }
  return linesToShow.map((lineSource, index) => {
    const lineNumber = lineRange.start + index + 1;
    const isMainLine = lineNumber === line;
    const lineSourceTruncated = applyColumnRange(columnRange, lineSource);
    const lineNumberWidth = String(lineNumber).length;
    // ensure if line moves from 7,8,9 to 10 the display is still great
    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth);
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`;
    const lineFormatted = `${aside(asideSource)} ${lineSourceTruncated}`;
    if (isMainLine) {
      if (column === undefined) {
        return `${mark(">")} ${lineFormatted}`;
      }
      const spacing = stringToSpaces(`${asideSource} ${lineSourceTruncated.slice(0, column - columnRange.start - 1)}`);
      return `${mark(">")} ${lineFormatted}
  ${spacing}${mark("^")}`;
    }
    return `  ${lineFormatted}`;
  }).join(`
`);
};
const applyColumnRange = ({
  start,
  end
}, line) => {
  if (typeof start !== "number") {
    throw new TypeError(`start must be a number, received ${start}`);
  }
  if (typeof end !== "number") {
    throw new TypeError(`end must be a number, received ${end}`);
  }
  if (end < start) {
    throw new Error(`end must be greater than start, but ${end} is smaller than ${start}`);
  }
  const prefix = "…";
  const suffix = "…";
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
    result += line[from];
    from++;
  }
  if (result.length === 0) {
    return "";
  }
  if (startTruncated && endTruncated) {
    return `${prefix}${result}${suffix}`;
  }
  if (startTruncated) {
    return `${prefix}${result}`;
  }
  if (endTruncated) {
    return `${result}${suffix}`;
  }
  return result;
};
const stringToSpaces = string => string.replace(/[^\t]/g, " ");

// const getLineRangeLength = ({ start, end }) => end - start

const moveLineRangeUp = ({
  start,
  end
}, number) => {
  return {
    start: start - number,
    end
  };
};
const moveLineRangeDown = ({
  start,
  end
}, number) => {
  return {
    start,
    end: end + number
  };
};
const lineRangeWithinLines = ({
  start,
  end
}, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end
  };
};

const urlToExtension$1 = url => {
  const pathname = urlToPathname$1(url);
  return pathnameToExtension$1(pathname);
};
const pathnameToExtension$1 = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }
  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = pathname.slice(dotLastIndex);
  return extension;
};

const asUrlWithoutSearch = url => {
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

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
  Object.keys(params).forEach(key => {
    urlObject.searchParams.set(key, params[key]);
  });
  const urlWithParams = urlObject.href;
  return urlWithParams;
};
const setUrlFilename = (url, filename) => {
  const urlObject = new URL(url);
  let {
    origin,
    search,
    hash
  } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const parentPathname = new URL("./", urlObject).pathname;
  return `${origin}${parentPathname}${filename}${search}${hash}`;
};
const ensurePathnameTrailingSlash = url => {
  const urlObject = new URL(url);
  const {
    pathname
  } = urlObject;
  if (pathname.endsWith("/")) {
    return url;
  }
  let {
    origin
  } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const {
    search,
    hash
  } = urlObject;
  return `${origin}${pathname}/${search}${hash}`;
};

const isFileSystemPath$1 = value => {
  if (typeof value !== "string") {
    throw new TypeError(`isFileSystemPath first arg must be a string, got ${value}`);
  }
  if (value[0] === "/") {
    return true;
  }
  return startsWithWindowsDriveLetter$1(value);
};
const startsWithWindowsDriveLetter$1 = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

const fileSystemPathToUrl$1 = value => {
  if (!isFileSystemPath$1(value)) {
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};

const getCallerPosition = () => {
  const {
    prepareStackTrace
  } = Error;
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace;
    return stack;
  };
  const {
    stack
  } = new Error();
  const callerCallsite = stack[2];
  const fileName = callerCallsite.getFileName();
  return {
    url: fileName && isFileSystemPath$1(fileName) ? fileSystemPathToUrl$1(fileName) : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber()
  };
};

const resolveUrl$1 = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }
  return String(new URL(specifier, baseUrl));
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

const urlToRelativeUrl = (url, baseUrl) => {
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
    const baseSpecificParentPathname = pathnameToParentPathname$1(baseSpecificPathname);
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(/.*?\//g, "../");
    const relativeUrl = `${relativeDirectoriesNotation}${specificPathname}${search}${hash}`;
    return relativeUrl;
  }
  const relativeUrl = `${specificPathname}${search}${hash}`;
  return relativeUrl;
};
const pathnameToParentPathname$1 = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const moveUrl = ({
  url,
  from,
  to,
  preferRelative
}) => {
  let relativeUrl = urlToRelativeUrl(url, from);
  if (relativeUrl.slice(0, 2) === "//") {
    // restore the protocol
    relativeUrl = new URL(relativeUrl, url).href;
  }
  const absoluteUrl = new URL(relativeUrl, to).href;
  if (preferRelative) {
    return urlToRelativeUrl(absoluteUrl, to);
  }
  return absoluteUrl;
};

const urlIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);
  if (urlObject.origin !== otherUrlObject.origin) {
    return false;
  }
  const urlPathname = urlObject.pathname;
  const otherUrlPathname = otherUrlObject.pathname;
  if (urlPathname === otherUrlPathname) {
    return false;
  }
  const isInside = urlPathname.startsWith(otherUrlPathname);
  return isInside;
};

const urlToBasename = url => {
  const filename = urlToFilename$1(url);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename = dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};

const urlToFileSystemPath = url => {
  let urlString = String(url);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  const fileSystemPath = fileURLToPath(urlString);
  return fileSystemPath;
};

const validateDirectoryUrl = value => {
  let urlString;
  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath$1(value)) {
      urlString = fileSystemPathToUrl$1(value);
    } else {
      try {
        urlString = String(new URL(value));
      } catch (e) {
        return {
          valid: false,
          value,
          message: `must be a valid url`
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: `must be a string or an url`
    };
  }
  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"'
    };
  }
  return {
    valid: true,
    value: ensurePathnameTrailingSlash(urlString)
  };
};
const assertAndNormalizeDirectoryUrl = (directoryUrl, name = "directoryUrl") => {
  const {
    valid,
    message,
    value
  } = validateDirectoryUrl(directoryUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${value}`);
  }
  return value;
};

const validateFileUrl = (value, baseUrl) => {
  let urlString;
  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath$1(value)) {
      urlString = fileSystemPathToUrl$1(value);
    } else {
      try {
        urlString = String(new URL(value, baseUrl));
      } catch (e) {
        return {
          valid: false,
          value,
          message: "must be a valid url"
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: "must be a string or an url"
    };
  }
  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"'
    };
  }
  return {
    valid: true,
    value: urlString
  };
};
const assertAndNormalizeFileUrl = (fileUrl, baseUrl, name = "fileUrl") => {
  const {
    valid,
    message,
    value
  } = validateFileUrl(fileUrl, baseUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${fileUrl}`);
  }
  return value;
};

const statsToType = stats => {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return undefined;
};

// https://github.com/coderaiser/cloudcmd/issues/63#issuecomment-195478143
// https://nodejs.org/api/fs.html#fs_file_modes
// https://github.com/TooTallNate/stat-mode

// cannot get from fs.constants because they are not available on windows
const S_IRUSR = 256; /* 0000400 read permission, owner */
const S_IWUSR = 128; /* 0000200 write permission, owner */
const S_IXUSR = 64; /* 0000100 execute/search permission, owner */
const S_IRGRP = 32; /* 0000040 read permission, group */
const S_IWGRP = 16; /* 0000020 write permission, group */
const S_IXGRP = 8; /* 0000010 execute/search permission, group */
const S_IROTH = 4; /* 0000004 read permission, others */
const S_IWOTH = 2; /* 0000002 write permission, others */
const S_IXOTH = 1; /* 0000001 execute/search permission, others */
const permissionsToBinaryFlags = ({
  owner,
  group,
  others
}) => {
  let binaryFlags = 0;
  if (owner.read) binaryFlags |= S_IRUSR;
  if (owner.write) binaryFlags |= S_IWUSR;
  if (owner.execute) binaryFlags |= S_IXUSR;
  if (group.read) binaryFlags |= S_IRGRP;
  if (group.write) binaryFlags |= S_IWGRP;
  if (group.execute) binaryFlags |= S_IXGRP;
  if (others.read) binaryFlags |= S_IROTH;
  if (others.write) binaryFlags |= S_IWOTH;
  if (others.execute) binaryFlags |= S_IXOTH;
  return binaryFlags;
};

const writeEntryPermissions = async (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  let binaryFlags;
  if (typeof permissions === "object") {
    permissions = {
      owner: {
        read: getPermissionOrComputeDefault("read", "owner", permissions),
        write: getPermissionOrComputeDefault("write", "owner", permissions),
        execute: getPermissionOrComputeDefault("execute", "owner", permissions)
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions)
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault("execute", "others", permissions)
      }
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }
  return new Promise((resolve, reject) => {
    chmod(new URL(sourceUrl), binaryFlags, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
const actionLevels = {
  read: 0,
  write: 1,
  execute: 2
};
const subjectLevels = {
  others: 0,
  group: 1,
  owner: 2
};
const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];
    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }
    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(actionFallbackCandidate => actionLevels[actionFallbackCandidate] > actionLevel && actionFallbackCandidate in subjectPermissions);
    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }
  const subjectLevel = subjectLevels[subject];
  // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?
  const subjectFallback = Object.keys(subjectLevels).find(subjectFallbackCandidate => subjectLevels[subjectFallbackCandidate] > subjectLevel && subjectFallbackCandidate in permissions);
  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions ? subjectPermissions[action] : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }
  return false;
};

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */
const isWindows$3 = process.platform === "win32";
const readEntryStat = async (source, {
  nullIfNotFound = false,
  followLink = true
} = {}) => {
  let sourceUrl = assertAndNormalizeFileUrl(source);
  if (sourceUrl.endsWith("/")) sourceUrl = sourceUrl.slice(0, -1);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const handleNotFoundOption = nullIfNotFound ? {
    handleNotFoundError: () => null
  } : {};
  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows$3 ? {
      // Windows can EPERM on stat
      handlePermissionDeniedError: async error => {
        console.error(`trying to fix windows EPERM after stats on ${sourcePath}`);
        try {
          // unfortunately it means we mutate the permissions
          // without being able to restore them to the previous value
          // (because reading current permission would also throw)
          await writeEntryPermissions(sourceUrl, 0o666);
          const stats = await readStat(sourcePath, {
            followLink,
            ...handleNotFoundOption,
            // could not fix the permission error, give up and throw original error
            handlePermissionDeniedError: () => {
              console.error(`still got EPERM after stats on ${sourcePath}`);
              throw error;
            }
          });
          return stats;
        } catch (e) {
          console.error(`error while trying to fix windows EPERM after stats on ${sourcePath}: ${e.stack}`);
          throw error;
        }
      }
    } : {})
  });
};
const readStat = (sourcePath, {
  followLink,
  handleNotFoundError = null,
  handlePermissionDeniedError = null
} = {}) => {
  const nodeMethod = followLink ? stat : lstat;
  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else if (handlePermissionDeniedError && (error.code === "EPERM" || error.code === "EACCES")) {
          resolve(handlePermissionDeniedError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(statsObject);
      }
    });
  });
};

/*
 * - Buffer documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/buffer.html
 * - eTag documentation on MDN
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 */
const ETAG_FOR_EMPTY_CONTENT$1 = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
const bufferToEtag$1 = buffer => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`);
  }
  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT$1;
  }
  const hash = createHash("sha1");
  hash.update(buffer, "utf8");
  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;
  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

/*
 * See callback_race.md
 */

const raceCallbacks = (raceDescription, winnerCallback) => {
  let cleanCallbacks = [];
  let status = "racing";
  const clean = () => {
    cleanCallbacks.forEach(clean => {
      clean();
    });
    cleanCallbacks = null;
  };
  const cancel = () => {
    if (status !== "racing") {
      return;
    }
    status = "cancelled";
    clean();
  };
  Object.keys(raceDescription).forEach(candidateName => {
    const register = raceDescription[candidateName];
    const returnValue = register(data => {
      if (status !== "racing") {
        return;
      }
      status = "done";
      clean();
      winnerCallback({
        name: candidateName,
        data
      });
    });
    if (typeof returnValue === "function") {
      cleanCallbacks.push(returnValue);
    }
  });
  return cancel;
};

const createCallbackListNotifiedOnce = () => {
  let callbacks = [];
  let status = "waiting";
  let currentCallbackIndex = -1;
  const callbackListOnce = {};
  const add = callback => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({
        action: "add",
        status
      });
      return removeNoop;
    }
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    // don't register twice
    const existingCallback = callbacks.find(callbackCandidate => {
      return callbackCandidate === callback;
    });
    if (existingCallback) {
      emitCallbackDuplicationWarning();
      return removeNoop;
    }
    callbacks.push(callback);
    return () => {
      if (status === "notified") {
        // once called removing does nothing
        // as the callbacks array is frozen to null
        return;
      }
      const index = callbacks.indexOf(callback);
      if (index === -1) {
        return;
      }
      if (status === "looping") {
        if (index <= currentCallbackIndex) {
          // The callback was already called (or is the current callback)
          // We don't want to mutate the callbacks array
          // or it would alter the looping done in "call" and the next callback
          // would be skipped
          return;
        }

        // Callback is part of the next callback to call,
        // we mutate the callbacks array to prevent this callback to be called
      }

      callbacks.splice(index, 1);
    };
  };
  const notify = param => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({
        action: "call",
        status
      });
      return [];
    }
    status = "looping";
    const values = callbacks.map((callback, index) => {
      currentCallbackIndex = index;
      return callback(param);
    });
    callbackListOnce.notified = true;
    status = "notified";
    // we reset callbacks to null after looping
    // so that it's possible to remove during the loop
    callbacks = null;
    currentCallbackIndex = -1;
    return values;
  };
  callbackListOnce.notified = false;
  callbackListOnce.add = add;
  callbackListOnce.notify = notify;
  return callbackListOnce;
};
const emitUnexpectedActionWarning = ({
  action,
  status
}) => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`"${action}" should not happen when callback list is ${status}`, {
      CODE: "UNEXPECTED_ACTION_ON_CALLBACK_LIST",
      detail: `Code is potentially executed when it should not`
    });
  } else {
    console.warn(`"${action}" should not happen when callback list is ${status}`);
  }
};
const emitCallbackDuplicationWarning = () => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`Trying to add a callback already in the list`, {
      CODE: "CALLBACK_DUPLICATION",
      detail: `Code is potentially executed more than it should`
    });
  } else {
    console.warn(`Trying to add same callback twice`);
  }
};
const removeNoop = () => {};

/*
 * https://github.com/whatwg/dom/issues/920
 */
const Abort = {
  isAbortError: error => {
    return error && error.name === "AbortError";
  },
  startOperation: () => {
    return createOperation();
  },
  throwIfAborted: signal => {
    if (signal.aborted) {
      const error = new Error(`The operation was aborted`);
      error.name = "AbortError";
      error.type = "aborted";
      throw error;
    }
  }
};
const createOperation = () => {
  const operationAbortController = new AbortController();
  // const abortOperation = (value) => abortController.abort(value)
  const operationSignal = operationAbortController.signal;

  // abortCallbackList is used to ignore the max listeners warning from Node.js
  // this warning is useful but becomes problematic when it's expected
  // (a function doing 20 http call in parallel)
  // To be 100% sure we don't have memory leak, only Abortable.asyncCallback
  // uses abortCallbackList to know when something is aborted
  const abortCallbackList = createCallbackListNotifiedOnce();
  const endCallbackList = createCallbackListNotifiedOnce();
  let isAbortAfterEnd = false;
  operationSignal.onabort = () => {
    operationSignal.onabort = null;
    const allAbortCallbacksPromise = Promise.all(abortCallbackList.notify());
    if (!isAbortAfterEnd) {
      addEndCallback(async () => {
        await allAbortCallbacksPromise;
      });
    }
  };
  const throwIfAborted = () => {
    Abort.throwIfAborted(operationSignal);
  };

  // add a callback called on abort
  // differences with signal.addEventListener('abort')
  // - operation.end awaits the return value of this callback
  // - It won't increase the count of listeners for "abort" that would
  //   trigger max listeners warning when count > 10
  const addAbortCallback = callback => {
    // It would be painful and not super redable to check if signal is aborted
    // before deciding if it's an abort or end callback
    // with pseudo-code below where we want to stop server either
    // on abort or when ended because signal is aborted
    // operation[operation.signal.aborted ? 'addAbortCallback': 'addEndCallback'](async () => {
    //   await server.stop()
    // })
    if (operationSignal.aborted) {
      return addEndCallback(callback);
    }
    return abortCallbackList.add(callback);
  };
  const addEndCallback = callback => {
    return endCallbackList.add(callback);
  };
  const end = async ({
    abortAfterEnd = false
  } = {}) => {
    await Promise.all(endCallbackList.notify());

    // "abortAfterEnd" can be handy to ensure "abort" callbacks
    // added with { once: true } are removed
    // It might also help garbage collection because
    // runtime implementing AbortSignal (Node.js, browsers) can consider abortSignal
    // as settled and clean up things
    if (abortAfterEnd) {
      // because of operationSignal.onabort = null
      // + abortCallbackList.clear() this won't re-call
      // callbacks
      if (!operationSignal.aborted) {
        isAbortAfterEnd = true;
        operationAbortController.abort();
      }
    }
  };
  const addAbortSignal = (signal, {
    onAbort = callbackNoop,
    onRemove = callbackNoop
  } = {}) => {
    const applyAbortEffects = () => {
      const onAbortCallback = onAbort;
      onAbort = callbackNoop;
      onAbortCallback();
    };
    const applyRemoveEffects = () => {
      const onRemoveCallback = onRemove;
      onRemove = callbackNoop;
      onAbort = callbackNoop;
      onRemoveCallback();
    };
    if (operationSignal.aborted) {
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop;
    }
    if (signal.aborted) {
      operationAbortController.abort();
      applyAbortEffects();
      applyRemoveEffects();
      return callbackNoop;
    }
    const cancelRace = raceCallbacks({
      operation_abort: cb => {
        return addAbortCallback(cb);
      },
      operation_end: cb => {
        return addEndCallback(cb);
      },
      child_abort: cb => {
        return addEventListener(signal, "abort", cb);
      }
    }, winner => {
      const raceEffects = {
        // Both "operation_abort" and "operation_end"
        // means we don't care anymore if the child aborts.
        // So we can:
        // - remove "abort" event listener on child (done by raceCallback)
        // - remove abort callback on operation (done by raceCallback)
        // - remove end callback on operation (done by raceCallback)
        // - call any custom cancel function
        operation_abort: () => {
          applyAbortEffects();
          applyRemoveEffects();
        },
        operation_end: () => {
          // Exists to
          // - remove abort callback on operation
          // - remove "abort" event listener on child
          // - call any custom cancel function
          applyRemoveEffects();
        },
        child_abort: () => {
          applyAbortEffects();
          operationAbortController.abort();
        }
      };
      raceEffects[winner.name](winner.value);
    });
    return () => {
      cancelRace();
      applyRemoveEffects();
    };
  };
  const addAbortSource = abortSourceCallback => {
    const abortSource = {
      cleaned: false,
      signal: null,
      remove: callbackNoop
    };
    const abortSourceController = new AbortController();
    const abortSourceSignal = abortSourceController.signal;
    abortSource.signal = abortSourceSignal;
    if (operationSignal.aborted) {
      return abortSource;
    }
    const returnValue = abortSourceCallback(value => {
      abortSourceController.abort(value);
    });
    const removeAbortSignal = addAbortSignal(abortSourceSignal, {
      onRemove: () => {
        if (typeof returnValue === "function") {
          returnValue();
        }
        abortSource.cleaned = true;
      }
    });
    abortSource.remove = removeAbortSignal;
    return abortSource;
  };
  const timeout = ms => {
    return addAbortSource(abort => {
      const timeoutId = setTimeout(abort, ms);
      // an abort source return value is called when:
      // - operation is aborted (by an other source)
      // - operation ends
      return () => {
        clearTimeout(timeoutId);
      };
    });
  };
  const withSignal = async asyncCallback => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      }
    });
    try {
      const value = await asyncCallback(signal);
      removeAbortSignal();
      return value;
    } catch (e) {
      removeAbortSignal();
      throw e;
    }
  };
  const withSignalSync = callback => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      }
    });
    try {
      const value = callback(signal);
      removeAbortSignal();
      return value;
    } catch (e) {
      removeAbortSignal();
      throw e;
    }
  };
  return {
    // We could almost hide the operationSignal
    // But it can be handy for 2 things:
    // - know if operation is aborted (operation.signal.aborted)
    // - forward the operation.signal directly (not using "withSignal" or "withSignalSync")
    signal: operationSignal,
    throwIfAborted,
    addAbortCallback,
    addAbortSignal,
    addAbortSource,
    timeout,
    withSignal,
    withSignalSync,
    addEndCallback,
    end
  };
};
const callbackNoop = () => {};
const addEventListener = (target, eventName, cb) => {
  target.addEventListener(eventName, cb);
  return () => {
    target.removeEventListener(eventName, cb);
  };
};

const raceProcessTeardownEvents = (processTeardownEvents, callback) => {
  return raceCallbacks({
    ...(processTeardownEvents.SIGHUP ? SIGHUP_CALLBACK : {}),
    ...(processTeardownEvents.SIGTERM ? SIGTERM_CALLBACK : {}),
    ...(processTeardownEvents.SIGINT ? SIGINT_CALLBACK : {}),
    ...(processTeardownEvents.beforeExit ? BEFORE_EXIT_CALLBACK : {}),
    ...(processTeardownEvents.exit ? EXIT_CALLBACK : {})
  }, callback);
};
const SIGHUP_CALLBACK = {
  SIGHUP: cb => {
    process.on("SIGHUP", cb);
    return () => {
      process.removeListener("SIGHUP", cb);
    };
  }
};
const SIGTERM_CALLBACK = {
  SIGTERM: cb => {
    process.on("SIGTERM", cb);
    return () => {
      process.removeListener("SIGTERM", cb);
    };
  }
};
const BEFORE_EXIT_CALLBACK = {
  beforeExit: cb => {
    process.on("beforeExit", cb);
    return () => {
      process.removeListener("beforeExit", cb);
    };
  }
};
const EXIT_CALLBACK = {
  exit: cb => {
    process.on("exit", cb);
    return () => {
      process.removeListener("exit", cb);
    };
  }
};
const SIGINT_CALLBACK = {
  SIGINT: cb => {
    process.on("SIGINT", cb);
    return () => {
      process.removeListener("SIGINT", cb);
    };
  }
};

const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(`${name} must be a url but looks like a windows pathname, got ${value}`);
  }
  if (!hasScheme$1(value)) {
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
const hasScheme$1 = specifier => /^[a-zA-Z]+:/.test(specifier);

const resolveAssociations = (associations, baseUrl) => {
  assertUrlLike(baseUrl, "baseUrl");
  const associationsResolved = {};
  Object.keys(associations).forEach(key => {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      Object.keys(value).forEach(pattern => {
        const valueAssociated = value[pattern];
        const patternResolved = normalizeUrlPattern(pattern, baseUrl);
        valueMapResolved[patternResolved] = valueAssociated;
      });
      associationsResolved[key] = valueMapResolved;
    } else {
      associationsResolved[key] = value;
    }
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
  Object.keys(associations).forEach(associationName => {
    const associationValue = associations[associationName];
    if (isPlainObject(associationValue)) {
      Object.keys(associationValue).forEach(pattern => {
        const patternValue = associationValue[pattern];
        const previousValue = flatAssociations[pattern];
        if (isPlainObject(previousValue)) {
          flatAssociations[pattern] = {
            ...previousValue,
            [associationName]: patternValue
          };
        } else {
          flatAssociations[pattern] = {
            [associationName]: patternValue
          };
        }
      });
    }
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
          canSkipSlash: true
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
  let longestAttemptRange = null;
  let isLastAttempt = false;
  const failure = () => {
    return {
      matched: false,
      patternIndex: longestAttemptRange.patternIndex,
      index: longestAttemptRange.index + longestAttemptRange.length,
      groups: longestAttemptRange.groups,
      group: {
        string: string.slice(0, longestAttemptRange.index)
      }
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
          string: remainingString === "" ? string : string.slice(0, -remainingString.length)
        }
      };
    }
    const attemptIndex = matchAttempt.index;
    const attemptRange = {
      patternIndex: matchAttempt.patternIndex,
      index,
      length: attemptIndex,
      groups: matchAttempt.groups
    };
    if (!longestAttemptRange || longestAttemptRange.length < attemptRange.length) {
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

const readDirectory = async (url, {
  emfileMaxWait = 1000
} = {}) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url);
  const directoryUrlObject = new URL(directoryUrl);
  const startMs = Date.now();
  let attemptCount = 0;
  const attempt = async () => {
    try {
      const names = await new Promise((resolve, reject) => {
        readdir(directoryUrlObject, (error, names) => {
          if (error) {
            reject(error);
          } else {
            resolve(names);
          }
        });
      });
      return names.map(encodeURIComponent);
    } catch (e) {
      // https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#errors_common_system_errors
      if (e.code === "EMFILE" || e.code === "ENFILE") {
        attemptCount++;
        const nowMs = Date.now();
        const timeSpentWaiting = nowMs - startMs;
        if (timeSpentWaiting > emfileMaxWait) {
          throw e;
        }
        await new Promise(resolve => setTimeout(resolve), attemptCount);
        return await attempt();
      }
      throw e;
    }
  };
  return attempt();
};

const comparePathnames = (leftPathame, rightPathname) => {
  const leftPartArray = leftPathame.split("/");
  const rightPartArray = rightPathname.split("/");
  const leftLength = leftPartArray.length;
  const rightLength = rightPartArray.length;
  const maxLength = Math.max(leftLength, rightLength);
  let i = 0;
  while (i < maxLength) {
    const leftPartExists = (i in leftPartArray);
    const rightPartExists = (i in rightPartArray);

    // longer comes first
    if (!leftPartExists) {
      return +1;
    }
    if (!rightPartExists) {
      return -1;
    }
    const leftPartIsLast = i === leftPartArray.length - 1;
    const rightPartIsLast = i === rightPartArray.length - 1;
    // folder comes first
    if (leftPartIsLast && !rightPartIsLast) {
      return +1;
    }
    if (!leftPartIsLast && rightPartIsLast) {
      return -1;
    }
    const leftPart = leftPartArray[i];
    const rightPart = rightPartArray[i];
    i++;
    // local comparison comes first
    const comparison = leftPart.localeCompare(rightPart);
    if (comparison !== 0) {
      return comparison;
    }
  }
  if (leftLength < rightLength) {
    return +1;
  }
  if (leftLength > rightLength) {
    return -1;
  }
  return 0;
};

// https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fspromises_mkdir_path_options
const {
  mkdir
} = promises;
const writeDirectory = async (destination, {
  recursive = true,
  allowUseless = false
} = {}) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationStats = await readEntryStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false
  });
  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }
      throw new Error(`directory already exists at ${destinationPath}`);
    }
    const destinationType = statsToType(destinationStats);
    throw new Error(`cannot write directory at ${destinationPath} because there is a ${destinationType}`);
  }
  try {
    await mkdir(destinationPath, {
      recursive
    });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};

const removeEntry = async (source, {
  signal = new AbortController().signal,
  allowUseless = false,
  recursive = false,
  maxRetries = 3,
  retryDelay = 100,
  onlyContent = false
} = {}) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const removeOperation = Abort.startOperation();
  removeOperation.addAbortSignal(signal);
  try {
    removeOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false
    });
    if (!sourceStats) {
      if (allowUseless) {
        return;
      }
      throw new Error(`nothing to remove at ${urlToFileSystemPath(sourceUrl)}`);
    }

    // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_class_fs_stats
    // FIFO and socket are ignored, not sure what they are exactly and what to do with them
    // other libraries ignore them, let's do the same.
    if (sourceStats.isFile() || sourceStats.isSymbolicLink() || sourceStats.isCharacterDevice() || sourceStats.isBlockDevice()) {
      await removeNonDirectory(sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl, {
        maxRetries,
        retryDelay
      });
    } else if (sourceStats.isDirectory()) {
      await removeDirectory(ensurePathnameTrailingSlash(sourceUrl), {
        signal: removeOperation.signal,
        recursive,
        maxRetries,
        retryDelay,
        onlyContent
      });
    }
  } finally {
    await removeOperation.end();
  }
};
const removeNonDirectory = (sourceUrl, {
  maxRetries,
  retryDelay
}) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);
  let retryCount = 0;
  const attempt = () => {
    return unlinkNaive(sourcePath, {
      ...(retryCount >= maxRetries ? {} : {
        handleTemporaryError: async () => {
          retryCount++;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(attempt());
            }, retryCount * retryDelay);
          });
        }
      })
    });
  };
  return attempt();
};
const unlinkNaive = (sourcePath, {
  handleTemporaryError = null
} = {}) => {
  return new Promise((resolve, reject) => {
    unlink(sourcePath, error => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve();
        } else if (handleTemporaryError && (error.code === "EBUSY" || error.code === "EMFILE" || error.code === "ENFILE" || error.code === "ENOENT")) {
          resolve(handleTemporaryError(error));
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};
const removeDirectory = async (rootDirectoryUrl, {
  signal,
  maxRetries,
  retryDelay,
  recursive,
  onlyContent
}) => {
  const removeDirectoryOperation = Abort.startOperation();
  removeDirectoryOperation.addAbortSignal(signal);
  const visit = async sourceUrl => {
    removeDirectoryOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false
    });

    // file/directory not found
    if (sourceStats === null) {
      return;
    }
    if (sourceStats.isFile() || sourceStats.isCharacterDevice() || sourceStats.isBlockDevice()) {
      await visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      await visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      await visitDirectory(`${sourceUrl}/`);
    }
  };
  const visitDirectory = async directoryUrl => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive ? {
      handleNotEmptyError: async () => {
        await removeDirectoryContent(directoryUrl);
        await visitDirectory(directoryUrl);
      }
    } : {};
    removeDirectoryOperation.throwIfAborted();
    await removeDirectoryNaive(directoryPath, {
      ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32" ? {
        handlePermissionError: async error => {
          console.error(`trying to fix windows EPERM after readir on ${directoryPath}`);
          let openOrCloseError;
          try {
            const fd = openSync(directoryPath);
            closeSync(fd);
          } catch (e) {
            openOrCloseError = e;
          }
          if (openOrCloseError) {
            if (openOrCloseError.code === "ENOENT") {
              return;
            }
            console.error(`error while trying to fix windows EPERM after readir on ${directoryPath}: ${openOrCloseError.stack}`);
            throw error;
          }
          await removeDirectoryNaive(directoryPath, {
            ...optionsFromRecursive
          });
        }
      } : {})
    });
  };
  const removeDirectoryContent = async directoryUrl => {
    removeDirectoryOperation.throwIfAborted();
    const names = await readDirectory(directoryUrl);
    await Promise.all(names.map(async name => {
      const url = resolveUrl$1(name, directoryUrl);
      await visit(url);
    }));
  };
  const visitFile = async fileUrl => {
    await removeNonDirectory(fileUrl, {
      maxRetries,
      retryDelay
    });
  };
  const visitSymbolicLink = async symbolicLinkUrl => {
    await removeNonDirectory(symbolicLinkUrl, {
      maxRetries,
      retryDelay
    });
  };
  try {
    if (onlyContent) {
      await removeDirectoryContent(rootDirectoryUrl);
    } else {
      await visitDirectory(rootDirectoryUrl);
    }
  } finally {
    await removeDirectoryOperation.end();
  }
};
const removeDirectoryNaive = (directoryPath, {
  handleNotEmptyError = null,
  handlePermissionError = null
} = {}) => {
  return new Promise((resolve, reject) => {
    rmdir(directoryPath, (error, lstatObject) => {
      if (error) {
        if (handlePermissionError && error.code === "EPERM") {
          resolve(handlePermissionError(error));
        } else if (error.code === "ENOENT") {
          resolve();
        } else if (handleNotEmptyError && (
        // linux os
        error.code === "ENOTEMPTY" ||
        // SunOS
        error.code === "EEXIST")) {
          resolve(handleNotEmptyError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(lstatObject);
      }
    });
  });
};

const ensureEmptyDirectory = async source => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false
  });
  if (stats === null) {
    // if there is nothing, create a directory
    return writeDirectory(source, {
      allowUseless: true
    });
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    return removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true
    });
  }
  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(`ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`);
};

const isWindows$2 = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl$1(process.cwd());

/**
 * Some url might be resolved or remapped to url without the windows drive letter.
 * For instance
 * new URL('/foo.js', 'file:///C:/dir/file.js')
 * resolves to
 * 'file:///foo.js'
 *
 * But on windows it becomes a problem because we need the drive letter otherwise
 * url cannot be converted to a filesystem path.
 *
 * ensureWindowsDriveLetter ensure a resolved url still contains the drive letter.
 */

const ensureWindowsDriveLetter = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch (e) {
    throw new Error(`absolute url expected but got ${url}`);
  }
  if (!isWindows$2) {
    return url;
  }
  try {
    baseUrl = String(new URL(baseUrl));
  } catch (e) {
    throw new Error(`absolute baseUrl expected but got ${baseUrl} to ensure windows drive letter on ${url}`);
  }
  if (!url.startsWith("file://")) {
    return url;
  }
  const afterProtocol = url.slice("file://".length);
  // we still have the windows drive letter
  if (extractDriveLetter(afterProtocol)) {
    return url;
  }

  // drive letter was lost, restore it
  const baseUrlOrFallback = baseUrl.startsWith("file://") ? baseUrl : baseUrlFallback;
  const driveLetter = extractDriveLetter(baseUrlOrFallback.slice("file://".length));
  if (!driveLetter) {
    throw new Error(`drive letter expected on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`);
  }
  return `file:///${driveLetter}:${afterProtocol}`;
};
const extractDriveLetter = resource => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(resource[1]) && resource[2] === ":") {
    return resource[1];
  }
  return null;
};

process.platform === "win32";

const readFileSync = (value, {
  as = "buffer"
} = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const buffer = readFileSync$1(new URL(fileUrl));
  if (as === "buffer") {
    return buffer;
  }
  if (as === "string") {
    return buffer.toString();
  }
  if (as === "json") {
    return JSON.parse(buffer.toString());
  }
  throw new Error(`"as" must be one of "buffer","string","json" received "${as}"`);
};

const guardTooFastSecondCallPerFile = (callback, cooldownBetweenFileEvents = 40) => {
  const previousCallMsMap = new Map();
  return fileEvent => {
    const {
      relativeUrl
    } = fileEvent;
    const previousCallMs = previousCallMsMap.get(relativeUrl);
    const nowMs = Date.now();
    if (previousCallMs) {
      const msEllapsed = nowMs - previousCallMs;
      if (msEllapsed < cooldownBetweenFileEvents) {
        previousCallMsMap.delete(relativeUrl);
        return;
      }
    }
    previousCallMsMap.set(relativeUrl, nowMs);
    callback(fileEvent);
  };
};

const isWindows$1 = process.platform === "win32";
const createWatcher = (sourcePath, options) => {
  const watcher = watch(sourcePath, options);
  if (isWindows$1) {
    watcher.on("error", async error => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = openSync(sourcePath, "r");
          closeSync(fd);
        } catch (e) {
          if (e.code === "ENOENT") {
            return;
          }
          console.error(`error while fixing windows eperm: ${e.stack}`);
          throw error;
        }
      } else {
        throw error;
      }
    });
  }
  return watcher;
};

const trackResources = () => {
  const callbackArray = [];
  const registerCleanupCallback = callback => {
    if (typeof callback !== "function") throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };
  const cleanup = async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  };
  return {
    registerCleanupCallback,
    cleanup
  };
};

const isLinux = process.platform === "linux";
// linux does not support recursive option
const fsWatchSupportsRecursive = !isLinux;
const registerDirectoryLifecycle = (source, {
  debug = false,
  added,
  updated,
  removed,
  watchPatterns = {
    "./**/*": true
  },
  notifyExistent = false,
  keepProcessAlive = true,
  recursive = false,
  // filesystem might dispatch more events than expected
  // Code can use "cooldownBetweenFileEvents" to prevent that
  // BUT it is UNADVISED to rely on this as explained later (search for "is lying" in this file)
  // For this reason"cooldownBetweenFileEvents" should be reserved to scenarios
  // like unit tests
  cooldownBetweenFileEvents = 0
}) => {
  const sourceUrl = assertAndNormalizeDirectoryUrl(source);
  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }
  if (!undefinedOrFunction(updated)) {
    throw new TypeError(`updated must be a function or undefined, got ${updated}`);
  }
  if (!undefinedOrFunction(removed)) {
    throw new TypeError(`removed must be a function or undefined, got ${removed}`);
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCallPerFile(added, cooldownBetweenFileEvents);
    }
    if (updated) {
      updated = guardTooFastSecondCallPerFile(updated, cooldownBetweenFileEvents);
    }
    if (removed) {
      removed = guardTooFastSecondCallPerFile(removed, cooldownBetweenFileEvents);
    }
  }
  const associations = URL_META.resolveAssociations({
    watch: watchPatterns
  }, sourceUrl);
  const getWatchPatternValue = ({
    url,
    type
  }) => {
    if (type === "directory") {
      let firstMeta = false;
      URL_META.urlChildMayMatch({
        url: `${url}/`,
        associations,
        predicate: ({
          watch
        }) => {
          if (watch) {
            firstMeta = watch;
          }
          return watch;
        }
      });
      return firstMeta;
    }
    const {
      watch
    } = URL_META.applyAssociations({
      url,
      associations
    });
    return watch;
  };
  const tracker = trackResources();
  const infoMap = new Map();
  const readEntryInfo = url => {
    try {
      const relativeUrl = urlToRelativeUrl(url, source);
      const previousInfo = infoMap.get(relativeUrl);
      const stats = statSync(new URL(url));
      const type = statsToType(stats);
      const patternValue = previousInfo ? previousInfo.patternValue : getWatchPatternValue({
        url,
        type
      });
      return {
        previousInfo,
        url,
        relativeUrl,
        type,
        atimeMs: stats.atimeMs,
        mtimeMs: stats.mtimeMs,
        patternValue
      };
    } catch (e) {
      if (e.code === "ENOENT") {
        return null;
      }
      throw e;
    }
  };
  const handleDirectoryEvent = ({
    directoryRelativeUrl,
    filename,
    eventType
  }) => {
    if (filename) {
      if (directoryRelativeUrl) {
        handleChange(`${directoryRelativeUrl}/${filename}`);
        return;
      }
      handleChange(`${filename}`);
      return;
    }
    if (eventType === "rename") {
      if (!removed && !added) {
        return;
      }
      // we might receive `rename` without filename
      // in that case we try to find ourselves which file was removed.
      let relativeUrlCandidateArray = Array.from(infoMap.keys());
      if (recursive && !fsWatchSupportsRecursive) {
        relativeUrlCandidateArray = relativeUrlCandidateArray.filter(relativeUrlCandidate => {
          if (!directoryRelativeUrl) {
            // ensure entry is top level
            if (relativeUrlCandidate.includes("/")) {
              return false;
            }
            return true;
          }
          // entry not inside this directory
          if (!relativeUrlCandidate.startsWith(directoryRelativeUrl)) {
            return false;
          }
          const afterDirectory = relativeUrlCandidate.slice(directoryRelativeUrl.length + 1);
          // deep inside this directory
          if (afterDirectory.includes("/")) {
            return false;
          }
          return true;
        });
      }
      const removedEntryRelativeUrl = relativeUrlCandidateArray.find(relativeUrlCandidate => {
        try {
          statSync(new URL(relativeUrlCandidate, sourceUrl));
          return false;
        } catch (e) {
          if (e.code === "ENOENT") {
            return true;
          }
          throw e;
        }
      });
      if (removedEntryRelativeUrl) {
        handleEntryLost(infoMap.get(removedEntryRelativeUrl));
      }
    }
  };
  const handleChange = relativeUrl => {
    const entryUrl = new URL(relativeUrl, sourceUrl).href;
    const entryInfo = readEntryInfo(entryUrl);
    if (!entryInfo) {
      const previousEntryInfo = infoMap.get(relativeUrl);
      if (!previousEntryInfo) {
        // on MacOS it's possible to receive a "rename" event for
        // a file that does not exists...
        return;
      }
      if (debug) {
        console.debug(`"${relativeUrl}" removed`);
      }
      handleEntryLost(previousEntryInfo);
      return;
    }
    const {
      previousInfo
    } = entryInfo;
    if (!previousInfo) {
      if (debug) {
        console.debug(`"${relativeUrl}" added`);
      }
      handleEntryFound(entryInfo);
      return;
    }
    if (entryInfo.type !== previousInfo.type) {
      // it existed and was replaced by something else
      // we don't handle this as an update. We rather say the resource
      // is lost and something else is found (call removed() then added())
      handleEntryLost(previousInfo);
      handleEntryFound(entryInfo);
      return;
    }
    if (entryInfo.type === "directory") {
      // a directory cannot really be updated in way that matters for us
      // filesystem is trying to tell us the directory content have changed
      // but we don't care about that
      // we'll already be notified about what has changed
      return;
    }
    // something has changed at this relativeUrl (the file existed and was not deleted)
    // it's possible to get there without a real update
    // (file content is the same and file mtime is the same).
    // In short filesystem is sometimes "lying"
    // Not trying to guard against that because:
    // - hurt perfs a lot
    // - it happens very rarely
    // - it's not really a concern in practice
    // - filesystem did not send an event out of nowhere:
    //   something occured but we don't know exactly what
    // maybe we should exclude some stuff as done in
    // https://github.com/paulmillr/chokidar/blob/b2c4f249b6cfa98c703f0066fb4a56ccd83128b5/lib/nodefs-handler.js#L366
    if (debug) {
      console.debug(`"${relativeUrl}" modified`);
    }
    handleEntryUpdated(entryInfo);
  };
  const handleEntryFound = (entryInfo, {
    notify = true
  } = {}) => {
    infoMap.set(entryInfo.relativeUrl, entryInfo);
    if (entryInfo.type === "directory") {
      const directoryUrl = `${entryInfo.url}/`;
      readdirSync(new URL(directoryUrl)).forEach(entryName => {
        const childEntryUrl = new URL(entryName, directoryUrl).href;
        const childEntryInfo = readEntryInfo(childEntryUrl);
        if (childEntryInfo && childEntryInfo.patternValue) {
          handleEntryFound(childEntryInfo, {
            notify
          });
        }
      });
      // we must watch manually every directory we find
      if (!fsWatchSupportsRecursive) {
        const watcher = createWatcher(urlToFileSystemPath(entryInfo.url), {
          persistent: keepProcessAlive
        });
        tracker.registerCleanupCallback(() => {
          watcher.close();
        });
        watcher.on("change", (eventType, filename) => {
          handleDirectoryEvent({
            directoryRelativeUrl: entryInfo.relativeUrl,
            filename: filename ?
            // replace back slashes with slashes
            filename.replace(/\\/g, "/") : "",
            eventType
          });
        });
      }
    }
    if (added && entryInfo.patternValue && notify) {
      added({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs
      });
    }
  };
  const handleEntryLost = entryInfo => {
    infoMap.delete(entryInfo.relativeUrl);
    if (removed && entryInfo.patternValue) {
      removed({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs
      });
    }
  };
  const handleEntryUpdated = entryInfo => {
    infoMap.set(entryInfo.relativeUrl, entryInfo);
    if (updated && entryInfo.patternValue) {
      updated({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs,
        previousMtime: entryInfo.previousInfo.mtimeMs
      });
    }
  };
  readdirSync(new URL(sourceUrl)).forEach(entry => {
    const entryUrl = new URL(entry, sourceUrl).href;
    const entryInfo = readEntryInfo(entryUrl);
    if (entryInfo && entryInfo.patternValue) {
      handleEntryFound(entryInfo, {
        notify: notifyExistent
      });
    }
  });
  if (debug) {
    const relativeUrls = Array.from(infoMap.keys());
    if (relativeUrls.length === 0) {
      console.debug(`No file found`);
    } else {
      console.debug(`${relativeUrls.length} file found: 
${relativeUrls.join("\n")}`);
    }
  }
  const watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive,
    persistent: keepProcessAlive
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({
      ...fileSystemPathToDirectoryRelativeUrlAndFilename(fileSystemPath),
      eventType
    });
  });
  return tracker.cleanup;
};
const undefinedOrFunction = value => {
  return typeof value === "undefined" || typeof value === "function";
};
const fileSystemPathToDirectoryRelativeUrlAndFilename = path => {
  if (!path) {
    return {
      directoryRelativeUrl: "",
      filename: ""
    };
  }
  const normalizedPath = path.replace(/\\/g, "/"); // replace back slashes with slashes
  const slashLastIndex = normalizedPath.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return {
      directoryRelativeUrl: "",
      filename: normalizedPath
    };
  }
  const directoryRelativeUrl = normalizedPath.slice(0, slashLastIndex);
  const filename = normalizedPath.slice(slashLastIndex + 1);
  return {
    directoryRelativeUrl,
    filename
  };
};

const writeFileSync = (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  try {
    writeFileSync$1(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      mkdirSync(new URL("./", destinationUrlObject), {
        recursive: true
      });
      writeFileSync$1(destinationUrlObject, content);
      return;
    }
    throw error;
  }
};

const LOG_LEVEL_OFF = "off";
const LOG_LEVEL_DEBUG = "debug";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";

const createLogger = ({
  logLevel = LOG_LEVEL_INFO
} = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      level: "debug",
      levels: {
        debug: true,
        info: true,
        warn: true,
        error: true
      },
      debug,
      info,
      warn,
      error
    };
  }
  if (logLevel === LOG_LEVEL_INFO) {
    return {
      level: "info",
      levels: {
        debug: false,
        info: true,
        warn: true,
        error: true
      },
      debug: debugDisabled,
      info,
      warn,
      error
    };
  }
  if (logLevel === LOG_LEVEL_WARN) {
    return {
      level: "warn",
      levels: {
        debug: false,
        info: false,
        warn: true,
        error: true
      },
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error
    };
  }
  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      level: "error",
      levels: {
        debug: false,
        info: false,
        warn: false,
        error: true
      },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error
    };
  }
  if (logLevel === LOG_LEVEL_OFF) {
    return {
      level: "off",
      levels: {
        debug: false,
        info: false,
        warn: false,
        error: false
      },
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled
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
  if ('FORCE_COLOR' in env) {
    if (env.FORCE_COLOR === 'true') {
      return 1;
    }
    if (env.FORCE_COLOR === 'false') {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
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
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
      return Number(osRelease[2]) >= 14_931 ? 3 : 2;
    }
    return 1;
  }
  if ('CI' in env) {
    if ('GITHUB_ACTIONS' in env) {
      return 3;
    }
    if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
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

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;
let canUseColors = processSupportsBasicColor;

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (process.env.GITHUB_WORKFLOW) {
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  if (process.env.FORCE_COLOR !== "false") {
    // in unit test we use process.env.FORCE_COLOR = 'false' to fake
    // that colors are not supported. Let it have priority
    canUseColors = true;
  }
}

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";
const setANSIColor = canUseColors ? (text, ANSI_COLOR) => `${ANSI_COLOR}${text}${RESET}` : text => text;
const ANSI = {
  supported: canUseColors,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  GREY,
  RESET,
  color: setANSIColor
};

function isUnicodeSupported() {
  if (process$1.platform !== 'win32') {
    return process$1.env.TERM !== 'linux'; // Linux console (kernel)
  }

  return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) // Windows Terminal
  || Boolean(process$1.env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
  || process$1.env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
  || process$1.env.TERM_PROGRAM === 'Terminus-Sublime' || process$1.env.TERM_PROGRAM === 'vscode' || process$1.env.TERM === 'xterm-256color' || process$1.env.TERM === 'alacritty' || process$1.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
}

// see also https://github.com/sindresorhus/figures
const canUseUnicode = isUnicodeSupported();
const COMMAND_RAW = canUseUnicode ? `❯` : `>`;
const OK_RAW = canUseUnicode ? `✔` : `√`;
const FAILURE_RAW = canUseUnicode ? `✖` : `×`;
const DEBUG_RAW = canUseUnicode ? `◆` : `♦`;
const INFO_RAW = canUseUnicode ? `ℹ` : `i`;
const WARNING_RAW = canUseUnicode ? `⚠` : `‼`;
const CIRCLE_CROSS_RAW = canUseUnicode ? `ⓧ` : `(×)`;
const COMMAND = ANSI.color(COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
const OK = ANSI.color(OK_RAW, ANSI.GREEN);
const FAILURE = ANSI.color(FAILURE_RAW, ANSI.RED);
const DEBUG = ANSI.color(DEBUG_RAW, ANSI.GREY);
const INFO = ANSI.color(INFO_RAW, ANSI.BLUE);
const WARNING = ANSI.color(WARNING_RAW, ANSI.YELLOW);
const CIRCLE_CROSS = ANSI.color(CIRCLE_CROSS_RAW, ANSI.RED);
const UNICODE = {
  COMMAND,
  OK,
  FAILURE,
  DEBUG,
  INFO,
  WARNING,
  CIRCLE_CROSS,
  COMMAND_RAW,
  OK_RAW,
  FAILURE_RAW,
  DEBUG_RAW,
  INFO_RAW,
  WARNING_RAW,
  CIRCLE_CROSS_RAW,
  supported: canUseUnicode
};

const createDetailedMessage$1 = (message, details = {}) => {
  let string = `${message}`;
  Object.keys(details).forEach(key => {
    const value = details[key];
    string += `
--- ${key} ---
${Array.isArray(value) ? value.join(`
`) : value}`;
  });
  return string;
};

const getPrecision = number => {
  if (Math.floor(number) === number) return 0;
  const [, decimals] = number.toString().split(".");
  return decimals.length || 0;
};
const setRoundedPrecision = (number, {
  decimals = 1,
  decimalsWhenSmall = decimals
} = {}) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round
  });
};
const setDecimalsPrecision = (number, {
  transform,
  decimals,
  // max decimals for number in [-Infinity, -1[]1, Infinity]
  decimalsWhenSmall // max decimals for number in [-1,1]
} = {}) => {
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

const msAsDuration = ms => {
  // ignore ms below meaningfulMs so that:
  // msAsDuration(0.5) -> "0 second"
  // msAsDuration(1.1) -> "0.001 second" (and not "0.0011 second")
  // This tool is meant to be read by humans and it would be barely readable to see
  // "0.0001 second" (stands for 0.1 millisecond)
  // yes we could return "0.1 millisecond" but we choosed consistency over precision
  // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
  if (ms < 1) {
    return "0 second";
  }
  const {
    primary,
    remaining
  } = parseMs(ms);
  if (!remaining) {
    return formatDurationUnit(primary, primary.name === "second" ? 1 : 0);
  }
  return `${formatDurationUnit(primary, 0)} and ${formatDurationUnit(remaining, 0)}`;
};
const formatDurationUnit = (unit, decimals) => {
  const count = setRoundedPrecision(unit.count, {
    decimals
  });
  if (count <= 1) {
    return `${count} ${unit.name}`;
  }
  return `${count} ${unit.name}s`;
};
const MS_PER_UNITS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000
};
const parseMs = ms => {
  const unitNames = Object.keys(MS_PER_UNITS);
  const smallestUnitName = unitNames[unitNames.length - 1];
  let firstUnitName = smallestUnitName;
  let firstUnitCount = ms / MS_PER_UNITS[smallestUnitName];
  const firstUnitIndex = unitNames.findIndex(unitName => {
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
        count: firstUnitCount
      }
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
        count: firstUnitCount
      }
    };
  }
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount
    },
    remaining: {
      name: remainingUnitName,
      count: remainingUnitCount
    }
  };
};

const byteAsFileSize = numberOfBytes => {
  return formatBytes(numberOfBytes);
};
const formatBytes = (number, {
  fixedDecimals = false
} = {}) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(Math.floor(Math.log10(number) / 3), BYTE_UNITS.length - 1);
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  const maxDecimals = unitNumber < 100 ? 1 : 0;
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals: maxDecimals,
    decimalsWhenSmall: 1
  });
  if (fixedDecimals) {
    return `${unitNumberRounded.toFixed(maxDecimals)} ${unitName}`;
  }
  return `${unitNumberRounded} ${unitName}`;
};
const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const distributePercentages = (namedNumbers, {
  maxPrecisionHint = 2
} = {}) => {
  const numberNames = Object.keys(namedNumbers);
  if (numberNames.length === 0) {
    return {};
  }
  if (numberNames.length === 1) {
    const firstNumberName = numberNames[0];
    return {
      [firstNumberName]: "100 %"
    };
  }
  const numbers = numberNames.map(name => namedNumbers[name]);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const ratios = numbers.map(number => number / total);
  const percentages = {};
  ratios.pop();
  ratios.forEach((ratio, index) => {
    const percentage = ratio * 100;
    percentages[numberNames[index]] = percentage;
  });
  const lowestPercentage = 1 / Math.pow(10, maxPrecisionHint) * 100;
  let precision = 0;
  Object.keys(percentages).forEach(name => {
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
  Object.keys(percentages).forEach(name => {
    const percentage = percentages[name];
    const percentageAllocated = setRoundedPrecision(percentage, {
      decimals: precision
    });
    remainingPercentage -= percentageAllocated;
    percentages[name] = percentageAllocated;
  });
  const lastName = numberNames[numberNames.length - 1];
  percentages[lastName] = setRoundedPrecision(remainingPercentage, {
    decimals: precision
  });
  return percentages;
};

const ESC = '\u001B[';
const OSC = '\u001B]';
const BEL = '\u0007';
const SEP = ';';

/* global window */
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isTerminalApp = !isBrowser && process$1.env.TERM_PROGRAM === 'Apple_Terminal';
const isWindows = !isBrowser && process$1.platform === 'win32';
const cwdFunction = isBrowser ? () => {
  throw new Error('`process.cwd()` only works in Node.js, not the browser.');
} : process$1.cwd;
const ansiEscapes = {};
ansiEscapes.cursorTo = (x, y) => {
  if (typeof x !== 'number') {
    throw new TypeError('The `x` argument is required');
  }
  if (typeof y !== 'number') {
    return ESC + (x + 1) + 'G';
  }
  return ESC + (y + 1) + SEP + (x + 1) + 'H';
};
ansiEscapes.cursorMove = (x, y) => {
  if (typeof x !== 'number') {
    throw new TypeError('The `x` argument is required');
  }
  let returnValue = '';
  if (x < 0) {
    returnValue += ESC + -x + 'D';
  } else if (x > 0) {
    returnValue += ESC + x + 'C';
  }
  if (y < 0) {
    returnValue += ESC + -y + 'A';
  } else if (y > 0) {
    returnValue += ESC + y + 'B';
  }
  return returnValue;
};
ansiEscapes.cursorUp = (count = 1) => ESC + count + 'A';
ansiEscapes.cursorDown = (count = 1) => ESC + count + 'B';
ansiEscapes.cursorForward = (count = 1) => ESC + count + 'C';
ansiEscapes.cursorBackward = (count = 1) => ESC + count + 'D';
ansiEscapes.cursorLeft = ESC + 'G';
ansiEscapes.cursorSavePosition = isTerminalApp ? '\u001B7' : ESC + 's';
ansiEscapes.cursorRestorePosition = isTerminalApp ? '\u001B8' : ESC + 'u';
ansiEscapes.cursorGetPosition = ESC + '6n';
ansiEscapes.cursorNextLine = ESC + 'E';
ansiEscapes.cursorPrevLine = ESC + 'F';
ansiEscapes.cursorHide = ESC + '?25l';
ansiEscapes.cursorShow = ESC + '?25h';
ansiEscapes.eraseLines = count => {
  let clear = '';
  for (let i = 0; i < count; i++) {
    clear += ansiEscapes.eraseLine + (i < count - 1 ? ansiEscapes.cursorUp() : '');
  }
  if (count) {
    clear += ansiEscapes.cursorLeft;
  }
  return clear;
};
ansiEscapes.eraseEndLine = ESC + 'K';
ansiEscapes.eraseStartLine = ESC + '1K';
ansiEscapes.eraseLine = ESC + '2K';
ansiEscapes.eraseDown = ESC + 'J';
ansiEscapes.eraseUp = ESC + '1J';
ansiEscapes.eraseScreen = ESC + '2J';
ansiEscapes.scrollUp = ESC + 'S';
ansiEscapes.scrollDown = ESC + 'T';
ansiEscapes.clearScreen = '\u001Bc';
ansiEscapes.clearTerminal = isWindows ? `${ansiEscapes.eraseScreen}${ESC}0f`
// 1. Erases the screen (Only done in case `2` is not supported)
// 2. Erases the whole screen including scrollback buffer
// 3. Moves cursor to the top-left position
// More info: https://www.real-world-systems.com/docs/ANSIcode.html
: `${ansiEscapes.eraseScreen}${ESC}3J${ESC}H`;
ansiEscapes.enterAlternativeScreen = ESC + '?1049h';
ansiEscapes.exitAlternativeScreen = ESC + '?1049l';
ansiEscapes.beep = BEL;
ansiEscapes.link = (text, url) => [OSC, '8', SEP, SEP, url, BEL, text, OSC, '8', SEP, SEP, BEL].join('');
ansiEscapes.image = (buffer, options = {}) => {
  let returnValue = `${OSC}1337;File=inline=1`;
  if (options.width) {
    returnValue += `;width=${options.width}`;
  }
  if (options.height) {
    returnValue += `;height=${options.height}`;
  }
  if (options.preserveAspectRatio === false) {
    returnValue += ';preserveAspectRatio=0';
  }
  return returnValue + ':' + buffer.toString('base64') + BEL;
};
ansiEscapes.iTerm = {
  setCwd: (cwd = cwdFunction()) => `${OSC}50;CurrentDir=${cwd}${BEL}`,
  annotation(message, options = {}) {
    let returnValue = `${OSC}1337;`;
    const hasX = typeof options.x !== 'undefined';
    const hasY = typeof options.y !== 'undefined';
    if ((hasX || hasY) && !(hasX && hasY && typeof options.length !== 'undefined')) {
      throw new Error('`x`, `y` and `length` must be defined when `x` or `y` is defined');
    }
    message = message.replace(/\|/g, '');
    returnValue += options.isHidden ? 'AddHiddenAnnotation=' : 'AddAnnotation=';
    if (options.length > 0) {
      returnValue += (hasX ? [message, options.length, options.x, options.y] : [options.length, message]).join('|');
    } else {
      returnValue += message;
    }
    return returnValue + BEL;
  }
};

/*
 *
 */

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = stream => {
  const originalWrite = stream.write;
  let output = "";
  let installed = true;
  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
    return originalWrite.call(stream, ...args);
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

/*
 * see also https://github.com/vadimdemedes/ink
 */
const createLog = ({
  stream = process.stdout,
  newLine = "after"
} = {}) => {
  const {
    columns = 80,
    rows = 24
  } = stream;
  const log = {
    onVerticalOverflow: () => {}
  };
  let lastOutput = "";
  let clearAttemptResult;
  let streamOutputSpy = noopStreamSpy;
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
    logLines.forEach(logLine => {
      const width = stringWidth(logLine);
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns);
    });
    if (visualLineCount > rows) {
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      clearAttemptResult = false;
      log.onVerticalOverflow();
      return "";
    }
    clearAttemptResult = true;
    return ansiEscapes.eraseLines(visualLineCount);
  };
  const spyStream = () => {
    if (stream === process.stdout) {
      const stdoutSpy = spyStreamOutput(process.stdout);
      const stderrSpy = spyStreamOutput(process.stderr);
      return () => {
        return stdoutSpy() + stderrSpy();
      };
    }
    return spyStreamOutput(stream);
  };
  const doWrite = string => {
    string = addNewLines(string, newLine);
    stream.write(string);
    lastOutput = string;
    clearAttemptResult = undefined;

    // We don't want to clear logs written by other code,
    // it makes output unreadable and might erase precious information
    // To detect this we put a spy on the stream.
    // The spy is required only if we actually wrote something in the stream
    // otherwise tryToClear() won't do a thing so spy is useless
    streamOutputSpy = string ? spyStream() : noopStreamSpy;
  };
  const write = (string, outputFromOutside = streamOutputSpy()) => {
    if (!lastOutput) {
      doWrite(string);
      return;
    }
    if (outputFromOutside) {
      // something else than this code has written in the stream
      // so we just write without clearing (append instead of replacing)
      doWrite(string);
    } else {
      doWrite(`${getErasePreviousOutput()}${string}`);
    }
  };
  const dynamicWrite = callback => {
    const outputFromOutside = streamOutputSpy();
    const string = callback({
      outputFromOutside
    });
    return write(string, outputFromOutside);
  };
  const destroy = () => {
    if (streamOutputSpy) {
      streamOutputSpy(); // this uninstalls the spy
      streamOutputSpy = null;
      lastOutput = "";
    }
  };
  Object.assign(log, {
    write,
    dynamicWrite,
    destroy
  });
  return log;
};
const noopStreamSpy = () => "";

// could be inlined but vscode do not correctly
// expand/collapse template strings, so I put it at the bottom
const addNewLines = (string, newLine) => {
  if (newLine === "before") {
    return `
${string}`;
  }
  if (newLine === "after") {
    return `${string}
`;
  }
  if (newLine === "around") {
    return `
${string}
`;
  }
  return string;
};

const startSpinner = ({
  log,
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  fps = 20,
  keepProcessAlive = false,
  stopOnWriteFromOutside = true,
  stopOnVerticalOverflow = true,
  render = () => "",
  effect = () => {}
}) => {
  let frameIndex = 0;
  let interval;
  let running = true;
  const spinner = {
    message: undefined
  };
  const update = message => {
    spinner.message = running ? `${frames[frameIndex]} ${message}` : message;
    return spinner.message;
  };
  spinner.update = update;
  let cleanup;
  if (ANSI.supported) {
    running = true;
    cleanup = effect();
    log.write(update(render()));
    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
      log.dynamicWrite(({
        outputFromOutside
      }) => {
        if (outputFromOutside && stopOnWriteFromOutside) {
          stop();
          return "";
        }
        return update(render());
      });
    }, 1000 / fps);
    if (!keepProcessAlive) {
      interval.unref();
    }
  } else {
    log.write(update(render()));
  }
  const stop = message => {
    running = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    if (log && message) {
      log.write(update(message));
      log = null;
    }
  };
  spinner.stop = stop;
  if (stopOnVerticalOverflow) {
    log.onVerticalOverflow = stop;
  }
  return spinner;
};

const createTaskLog = (label, {
  disabled = false,
  stopOnWriteFromOutside
} = {}) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
      fail: () => {}
    };
  }
  const startMs = Date.now();
  const log = createLog();
  let message = label;
  const taskSpinner = startSpinner({
    log,
    render: () => message,
    stopOnWriteFromOutside
  });
  return {
    setRightText: value => {
      message = `${label} ${value}`;
    },
    done: () => {
      const msEllapsed = Date.now() - startMs;
      taskSpinner.stop(`${UNICODE.OK} ${label} (done in ${msAsDuration(msEllapsed)})`);
    },
    happen: message => {
      taskSpinner.stop(`${UNICODE.INFO} ${message} (at ${new Date().toLocaleTimeString()})`);
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`);
    }
  };
};

const memoize = compute => {
  let memoized = false;
  let memoizedValue;
  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue;
    }
    // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later
    memoizedValue = compute(...args);
    memoized = true;
    return memoizedValue;
  };
  fnWithMemoization.forget = () => {
    const value = memoizedValue;
    memoized = false;
    memoizedValue = undefined;
    return value;
  };
  return fnWithMemoization;
};

const timeStart = name => {
  // as specified in https://w3c.github.io/server-timing/#the-performanceservertiming-interface
  // duration is a https://www.w3.org/TR/hr-time-2/#sec-domhighrestimestamp
  const startTimestamp = performance$1.now();
  const timeEnd = () => {
    const endTimestamp = performance$1.now();
    const timing = {
      [name]: endTimestamp - startTimestamp
    };
    return timing;
  };
  return timeEnd;
};
const timeFunction = (name, fn) => {
  const timeEnd = timeStart(name);
  const returnValue = fn();
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then(value => {
      return [timeEnd(), value];
    });
  }
  return [timeEnd(), returnValue];
};

const HOOK_NAMES$1 = ["serverListening", "redirectRequest", "handleRequest", "handleWebsocket", "handleError", "onResponsePush", "injectResponseHeaders", "responseReady", "serverStopped"];
const createServiceController = services => {
  const flatServices = flattenAndFilterServices(services);
  const hookGroups = {};
  const addService = service => {
    Object.keys(service).forEach(key => {
      if (key === "name") return;
      const isHook = HOOK_NAMES$1.includes(key);
      if (!isHook) {
        console.warn(`Unexpected "${key}" property on "${service.name}" service`);
      }
      const hookName = key;
      const hookValue = service[hookName];
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = []);
        group.push({
          service,
          name: hookName,
          value: hookValue
        });
      }
    });
  };
  flatServices.forEach(service => {
    addService(service);
  });
  let currentService = null;
  let currentHookName = null;
  const callHook = (hook, info, context) => {
    const hookFn = hook.value;
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(`${currentService.name.replace("jsenv:", "")}.${currentHookName}`);
    }
    let valueReturned = hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = hook.value;
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(`${currentService.name.replace("jsenv:", "")}.${currentHookName}`);
    }
    let valueReturned = await hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };
  const callHooks = (hookName, info, context, callback = () => {}) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context);
        if (returnValue) {
          callback(returnValue);
        }
      }
    }
  };
  const callHooksUntil = (hookName, info, context, until = returnValue => returnValue) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context);
        const untilReturnValue = until(returnValue);
        if (untilReturnValue) {
          return untilReturnValue;
        }
      }
    }
    return null;
  };
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName];
    if (!hooks) {
      return null;
    }
    if (hooks.length === 0) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const visit = index => {
        if (index >= hooks.length) {
          return resolve();
        }
        const hook = hooks[index];
        const returnValue = callAsyncHook(hook, info, context);
        return Promise.resolve(returnValue).then(output => {
          if (output) {
            return resolve(output);
          }
          return visit(index + 1);
        }, reject);
      };
      visit(0);
    });
  };
  return {
    services: flatServices,
    callHooks,
    callHooksUntil,
    callAsyncHooksUntil,
    getCurrentService: () => currentService,
    getCurrentHookName: () => currentHookName
  };
};
const flattenAndFilterServices = services => {
  const flatServices = [];
  const visitServiceEntry = serviceEntry => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach(value => visitServiceEntry(value));
      return;
    }
    if (typeof serviceEntry === "object" && serviceEntry !== null) {
      if (!serviceEntry.name) {
        serviceEntry.name = "anonymous";
      }
      flatServices.push(serviceEntry);
      return;
    }
    throw new Error(`services must be objects, got ${serviceEntry}`);
  };
  services.forEach(serviceEntry => visitServiceEntry(serviceEntry));
  return flatServices;
};

/**

 A multiple header is a header with multiple values like

 "text/plain, application/json;q=0.1"

 Each, means it's a new value (it's optionally followed by a space)

 Each; mean it's a property followed by =
 if "" is a string
 if not it's likely a number
 */

const parseMultipleHeader = (multipleHeaderString, {
  validateName = () => true,
  validateProperty = () => true
} = {}) => {
  const values = multipleHeaderString.split(",");
  const multipleHeader = {};
  values.forEach(value => {
    const valueTrimmed = value.trim();
    const valueParts = valueTrimmed.split(";");
    const name = valueParts[0];
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return;
    }
    const properties = parseHeaderProperties(valueParts.slice(1), {
      validateProperty
    });
    multipleHeader[name] = properties;
  });
  return multipleHeader;
};
const parseHeaderProperties = (headerProperties, {
  validateProperty
}) => {
  const properties = headerProperties.reduce((previous, valuePart) => {
    const [propertyName, propertyValueString] = valuePart.split("=");
    const propertyValue = parseHeaderPropertyValue(propertyValueString);
    const property = {
      name: propertyName,
      value: propertyValue
    };
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      return previous;
    }
    return {
      ...previous,
      [property.name]: property.value
    };
  }, {});
  return properties;
};
const parseHeaderPropertyValue = headerPropertyValueString => {
  const firstChar = headerPropertyValueString[0];
  const lastChar = headerPropertyValueString[headerPropertyValueString.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return headerPropertyValueString.slice(1, -1);
  }
  if (isNaN(headerPropertyValueString)) {
    return headerPropertyValueString;
  }
  return parseFloat(headerPropertyValueString);
};
const stringifyMultipleHeader = (multipleHeader, {
  validateName = () => true,
  validateProperty = () => true
} = {}) => {
  return Object.keys(multipleHeader).filter(name => {
    const headerProperties = multipleHeader[name];
    if (!headerProperties) {
      return false;
    }
    if (typeof headerProperties !== "object") {
      return false;
    }
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return false;
    }
    return true;
  }).map(name => {
    const headerProperties = multipleHeader[name];
    const headerPropertiesString = stringifyHeaderProperties(headerProperties, {
      validateProperty
    });
    if (headerPropertiesString.length) {
      return `${name};${headerPropertiesString}`;
    }
    return name;
  }).join(", ");
};
const stringifyHeaderProperties = (headerProperties, {
  validateProperty
}) => {
  const headerPropertiesString = Object.keys(headerProperties).map(name => {
    const property = {
      name,
      value: headerProperties[name]
    };
    return property;
  }).filter(property => {
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      return false;
    }
    return true;
  }).map(stringifyHeaderProperty).join(";");
  return headerPropertiesString;
};
const stringifyHeaderProperty = ({
  name,
  value
}) => {
  if (typeof value === "string") {
    return `${name}="${value}"`;
  }
  return `${name}=${value}`;
};

// to predict order in chrome devtools we should put a,b,c,d,e or something
// because in chrome dev tools they are shown in alphabetic order
// also we should manipulate a timing object instead of a header to facilitate
// manipulation of the object so that the timing header response generation logic belongs to @jsenv/server
// so response can return a new timing object
// yes it's awful, feel free to PR with a better approach :)
const timingToServerTimingResponseHeaders = timing => {
  const serverTimingHeader = {};
  Object.keys(timing).forEach((key, index) => {
    const name = letters[index] || "zz";
    serverTimingHeader[name] = {
      desc: key,
      dur: timing[key]
    };
  });
  const serverTimingHeaderString = stringifyServerTimingHeader(serverTimingHeader);
  return {
    "server-timing": serverTimingHeaderString
  };
};
const stringifyServerTimingHeader = serverTimingHeader => {
  return stringifyMultipleHeader(serverTimingHeader, {
    validateName: validateServerTimingName
  });
};

// (),/:;<=>?@[\]{}" Don't allowed
// Minimal length is one symbol
// Digits, alphabet characters,
// and !#$%&'*+-.^_`|~ are allowed
// https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
// https://tools.ietf.org/html/rfc7230#section-3.2.6
const validateServerTimingName = name => {
  const valid = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/gi.test(name);
  if (!valid) {
    console.warn(`server timing contains invalid symbols`);
    return false;
  }
  return true;
};
const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

const listenEvent = (objectWithEventEmitter, eventName, callback, {
  once = false
} = {}) => {
  if (once) {
    objectWithEventEmitter.once(eventName, callback);
  } else {
    objectWithEventEmitter.addListener(eventName, callback);
  }
  return () => {
    objectWithEventEmitter.removeListener(eventName, callback);
  };
};

/**

https://stackoverflow.com/a/42019773/2634179

*/
const createPolyglotServer = async ({
  http2 = false,
  http1Allowed = true,
  certificate,
  privateKey
}) => {
  const httpServer = http.createServer();
  const tlsServer = await createSecureServer({
    certificate,
    privateKey,
    http2,
    http1Allowed
  });
  const netServer = net.createServer({
    allowHalfOpen: false
  });
  listenEvent(netServer, "connection", socket => {
    detectSocketProtocol(socket, protocol => {
      if (protocol === "http") {
        httpServer.emit("connection", socket);
        return;
      }
      if (protocol === "tls") {
        tlsServer.emit("connection", socket);
        return;
      }
      const response = [`HTTP/1.1 400 Bad Request`, `Content-Length: 0`, "", ""].join("\r\n");
      socket.write(response);
      socket.end();
      socket.destroy();
      netServer.emit("clientError", new Error("protocol error, Neither http, nor tls"), socket);
    });
  });
  netServer._httpServer = httpServer;
  netServer._tlsServer = tlsServer;
  return netServer;
};

// The async part is just to lazyly import "http2" or "https"
// so that these module are parsed only if used.
// https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
const createSecureServer = async ({
  certificate,
  privateKey,
  http2,
  http1Allowed
}) => {
  if (http2) {
    const {
      createSecureServer
    } = await import("node:http2");
    return createSecureServer({
      cert: certificate,
      key: privateKey,
      allowHTTP1: http1Allowed
    });
  }
  const {
    createServer
  } = await import("node:https");
  return createServer({
    cert: certificate,
    key: privateKey
  });
};
const detectSocketProtocol = (socket, protocolDetectedCallback) => {
  let removeOnceReadableListener = () => {};
  const tryToRead = () => {
    const buffer = socket.read(1);
    if (buffer === null) {
      removeOnceReadableListener = socket.once("readable", tryToRead);
      return;
    }
    const firstByte = buffer[0];
    socket.unshift(buffer);
    if (firstByte === 22) {
      protocolDetectedCallback("tls");
      return;
    }
    if (firstByte > 32 && firstByte < 127) {
      protocolDetectedCallback("http");
      return;
    }
    protocolDetectedCallback(null);
  };
  tryToRead();
  return () => {
    removeOnceReadableListener();
  };
};

const trackServerPendingConnections = (nodeServer, {
  http2
}) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingConnections(nodeServer);
  }
  return trackHttp1ServerPendingConnections(nodeServer);
};

// const trackHttp2ServerPendingSessions = () => {}

const trackHttp1ServerPendingConnections = nodeServer => {
  const pendingConnections = new Set();
  const removeConnectionListener = listenEvent(nodeServer, "connection", connection => {
    pendingConnections.add(connection);
    listenEvent(connection, "close", () => {
      pendingConnections.delete(connection);
    }, {
      once: true
    });
  });
  const stop = async reason => {
    removeConnectionListener();
    const pendingConnectionsArray = Array.from(pendingConnections);
    pendingConnections.clear();
    await Promise.all(pendingConnectionsArray.map(async pendingConnection => {
      await destroyConnection(pendingConnection, reason);
    }));
  };
  return {
    stop
  };
};
const destroyConnection = (connection, reason) => {
  return new Promise((resolve, reject) => {
    connection.destroy(reason, error => {
      if (error) {
        if (error === reason || error.code === "ENOTCONN") {
          resolve();
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};

// export const trackServerPendingStreams = (nodeServer) => {
//   const pendingClients = new Set()

//   const streamListener = (http2Stream, headers, flags) => {
//     const client = { http2Stream, headers, flags }

//     pendingClients.add(client)
//     http2Stream.on("close", () => {
//       pendingClients.delete(client)
//     })
//   }

//   nodeServer.on("stream", streamListener)

//   const stop = ({
//     status,
//     // reason
//   }) => {
//     nodeServer.removeListener("stream", streamListener)

//     return Promise.all(
//       Array.from(pendingClients).map(({ http2Stream }) => {
//         if (http2Stream.sentHeaders === false) {
//           http2Stream.respond({ ":status": status }, { endStream: true })
//         }

//         return new Promise((resolve, reject) => {
//           if (http2Stream.closed) {
//             resolve()
//           } else {
//             http2Stream.close(NGHTTP2_NO_ERROR, (error) => {
//               if (error) {
//                 reject(error)
//               } else {
//                 resolve()
//               }
//             })
//           }
//         })
//       }),
//     )
//   }

//   return { stop }
// }

// export const trackServerPendingSessions = (nodeServer, { onSessionError }) => {
//   const pendingSessions = new Set()

//   const sessionListener = (session) => {
//     session.on("close", () => {
//       pendingSessions.delete(session)
//     })
//     session.on("error", onSessionError)
//     pendingSessions.add(session)
//   }

//   nodeServer.on("session", sessionListener)

//   const stop = async (reason) => {
//     nodeServer.removeListener("session", sessionListener)

//     await Promise.all(
//       Array.from(pendingSessions).map((pendingSession) => {
//         return new Promise((resolve, reject) => {
//           pendingSession.close((error) => {
//             if (error) {
//               if (error === reason || error.code === "ENOTCONN") {
//                 resolve()
//               } else {
//                 reject(error)
//               }
//             } else {
//               resolve()
//             }
//           })
//         })
//       }),
//     )
//   }

//   return { stop }
// }

const listenRequest = (nodeServer, requestCallback) => {
  if (nodeServer._httpServer) {
    const removeHttpRequestListener = listenEvent(nodeServer._httpServer, "request", requestCallback);
    const removeTlsRequestListener = listenEvent(nodeServer._tlsServer, "request", requestCallback);
    return () => {
      removeHttpRequestListener();
      removeTlsRequestListener();
    };
  }
  return listenEvent(nodeServer, "request", requestCallback);
};

const trackServerPendingRequests = (nodeServer, {
  http2
}) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingRequests(nodeServer);
  }
  return trackHttp1ServerPendingRequests(nodeServer);
};
const trackHttp1ServerPendingRequests = nodeServer => {
  const pendingClients = new Set();
  const removeRequestListener = listenRequest(nodeServer, (nodeRequest, nodeResponse) => {
    const client = {
      nodeRequest,
      nodeResponse
    };
    pendingClients.add(client);
    nodeResponse.once("close", () => {
      pendingClients.delete(client);
    });
  });
  const stop = async ({
    status,
    reason
  }) => {
    removeRequestListener();
    const pendingClientsArray = Array.from(pendingClients);
    pendingClients.clear();
    await Promise.all(pendingClientsArray.map(({
      nodeResponse
    }) => {
      if (nodeResponse.headersSent === false) {
        nodeResponse.writeHead(status, String(reason));
      }

      // http2
      if (nodeResponse.close) {
        return new Promise((resolve, reject) => {
          if (nodeResponse.closed) {
            resolve();
          } else {
            nodeResponse.close(error => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          }
        });
      }

      // http
      return new Promise(resolve => {
        if (nodeResponse.destroyed) {
          resolve();
        } else {
          nodeResponse.once("close", () => {
            resolve();
          });
          nodeResponse.destroy();
        }
      });
    }));
  };
  return {
    stop
  };
};

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}
const createObservable = producer => {
  if (typeof producer !== "function") {
    throw new TypeError(`producer must be a function, got ${producer}`);
  }
  const observable = {
    [Symbol.observable]: () => observable,
    subscribe: ({
      next = () => {},
      error = value => {
        throw value;
      },
      complete = () => {}
    }) => {
      let cleanup = () => {};
      const subscription = {
        closed: false,
        unsubscribe: () => {
          subscription.closed = true;
          cleanup();
        }
      };
      const producerReturnValue = producer({
        next: value => {
          if (subscription.closed) return;
          next(value);
        },
        error: value => {
          if (subscription.closed) return;
          error(value);
        },
        complete: () => {
          if (subscription.closed) return;
          complete();
        }
      });
      if (typeof producerReturnValue === "function") {
        cleanup = producerReturnValue;
      }
      return subscription;
    }
  };
  return observable;
};
const isObservable = value => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "object" || typeof value === "function") {
    return Symbol.observable in value;
  }
  return false;
};
const observableFromValue = value => {
  if (isObservable(value)) {
    return value;
  }
  return createObservable(({
    next,
    complete
  }) => {
    next(value);
    const timer = setTimeout(() => {
      complete();
    });
    return () => {
      clearTimeout(timer);
    };
  });
};

// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js
const observableFromNodeStream = (nodeStream, {
  readableStreamLifetime = 120_000 // 2s
} = {}) => {
  const observable = createObservable(({
    next,
    error,
    complete
  }) => {
    if (nodeStream.isPaused()) {
      nodeStream.resume();
    } else if (nodeStream.complete) {
      complete();
      return null;
    }
    const cleanup = () => {
      nodeStream.removeListener("data", next);
      nodeStream.removeListener("error", error);
      nodeStream.removeListener("end", complete);
      nodeStream.removeListener("close", cleanup);
      nodeStream.destroy();
    };
    // should we do nodeStream.resume() in case the stream was paused ?
    nodeStream.once("error", error);
    nodeStream.on("data", data => {
      next(data);
    });
    nodeStream.once("close", () => {
      cleanup();
    });
    nodeStream.once("end", () => {
      complete();
    });
    return cleanup;
  });
  if (nodeStream instanceof Readable) {
    // safe measure, ensure the readable stream gets
    // used in the next ${readableStreamLifetimeInSeconds} otherwise destroys it
    const timeout = setTimeout(() => {
      process.emitWarning(`Readable stream not used after ${readableStreamLifetime / 1000} seconds. It will be destroyed to release resources`, {
        CODE: "READABLE_STREAM_TIMEOUT",
        // url is for http client request
        detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`
      });
      nodeStream.destroy();
    }, readableStreamLifetime);
    observable.timeout = timeout;
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout);
    });
  }
  return observable;
};
const onceReadableStreamUsedOrClosed = (readableStream, callback) => {
  const dataOrCloseCallback = () => {
    readableStream.removeListener("data", dataOrCloseCallback);
    readableStream.removeListener("close", dataOrCloseCallback);
    callback();
  };
  readableStream.on("data", dataOrCloseCallback);
  readableStream.once("close", dataOrCloseCallback);
};

const normalizeHeaderName = headerName => {
  headerName = String(headerName);
  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }
  return headerName.toLowerCase();
};

const normalizeHeaderValue = headerValue => {
  return String(headerValue);
};

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
const headersFromObject = headersObject => {
  const headers = {};
  Object.keys(headersObject).forEach(headerName => {
    if (headerName[0] === ":") {
      // exclude http2 headers
      return;
    }
    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(headersObject[headerName]);
  });
  return headers;
};

const fromNodeRequest = (nodeRequest, {
  serverOrigin,
  signal,
  requestBodyLifetime
}) => {
  const headers = headersFromObject(nodeRequest.headers);
  const body = observableFromNodeStream(nodeRequest, {
    readableStreamLifetime: requestBodyLifetime
  });
  let requestOrigin;
  if (nodeRequest.upgrade) {
    requestOrigin = serverOrigin;
  } else if (nodeRequest.authority) {
    requestOrigin = nodeRequest.connection.encrypted ? `https://${nodeRequest.authority}` : `http://${nodeRequest.authority}`;
  } else if (nodeRequest.headers.host) {
    requestOrigin = nodeRequest.connection.encrypted ? `https://${nodeRequest.headers.host}` : `http://${nodeRequest.headers.host}`;
  } else {
    requestOrigin = serverOrigin;
  }
  return Object.freeze({
    signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin
    }),
    method: nodeRequest.method,
    headers,
    body
  });
};
const applyRedirectionToRequest = (request, {
  resource,
  pathname,
  ...rest
}) => {
  return {
    ...request,
    ...(resource ? getPropertiesFromResource({
      resource,
      baseUrl: request.url
    }) : pathname ? getPropertiesFromPathname({
      pathname,
      baseUrl: request.url
    }) : {}),
    ...rest
  };
};
const getPropertiesFromResource = ({
  resource,
  baseUrl
}) => {
  const urlObject = new URL(resource, baseUrl);
  let pathname = urlObject.pathname;
  return {
    url: String(urlObject),
    pathname,
    resource
  };
};
const getPropertiesFromPathname = ({
  pathname,
  baseUrl
}) => {
  return getPropertiesFromResource({
    resource: `${pathname}${new URL(baseUrl).search}`,
    baseUrl
  });
};
const createPushRequest = (request, {
  signal,
  pathname,
  method
}) => {
  const pushRequest = Object.freeze({
    ...request,
    parent: request,
    signal,
    http2: true,
    ...(pathname ? getPropertiesFromPathname({
      pathname,
      baseUrl: request.url
    }) : {}),
    method: method || request.method,
    headers: getHeadersInheritedByPushRequest(request),
    body: undefined
  });
  return pushRequest;
};
const getHeadersInheritedByPushRequest = request => {
  const headersInherited = {
    ...request.headers
  };
  // mtime sent by the client in request headers concerns the main request
  // Time remains valid for request to other resources so we keep it
  // in child requests
  // delete childHeaders["if-modified-since"]

  // eTag sent by the client in request headers concerns the main request
  // A request made to an other resource must not inherit the eTag
  delete headersInherited["if-none-match"];
  return headersInherited;
};

const normalizeBodyMethods = body => {
  if (isObservable(body)) {
    return {
      asObservable: () => body,
      destroy: () => {}
    };
  }
  if (isFileHandle(body)) {
    return {
      asObservable: () => fileHandleToObservable(body),
      destroy: () => {
        body.close();
      }
    };
  }
  if (isNodeStream(body)) {
    return {
      asObservable: () => observableFromNodeStream(body),
      destroy: () => {
        body.destroy();
      }
    };
  }
  return {
    asObservable: () => observableFromValue(body),
    destroy: () => {}
  };
};
const isFileHandle = value => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};
const fileHandleToReadableStream = fileHandle => {
  const fileReadableStream = typeof fileHandle.createReadStream === "function" ? fileHandle.createReadStream() : createReadStream("/toto",
  // is it ok to pass a fake path like this?
  {
    fd: fileHandle.fd,
    emitClose: true
    // autoClose: true
  });
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream;
};
const fileHandleToObservable = fileHandle => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};
const isNodeStream = value => {
  if (value === undefined) {
    return false;
  }
  if (value instanceof Stream || value instanceof Writable || value instanceof Readable) {
    return true;
  }
  return false;
};

const writeNodeResponse = async (responseStream, {
  status,
  statusText,
  headers,
  body,
  bodyEncoding
}, {
  signal,
  ignoreBody,
  onAbort,
  onError,
  onHeadersSent,
  onEnd
} = {}) => {
  body = await body;
  const bodyMethods = normalizeBodyMethods(body);
  if (signal.aborted) {
    bodyMethods.destroy();
    responseStream.destroy();
    onAbort();
    return;
  }
  writeHead(responseStream, {
    status,
    statusText,
    headers,
    onHeadersSent
  });
  if (!body) {
    onEnd();
    responseStream.end();
    return;
  }
  if (ignoreBody) {
    onEnd();
    bodyMethods.destroy();
    responseStream.end();
    return;
  }
  if (bodyEncoding) {
    responseStream.setEncoding(bodyEncoding);
  }
  await new Promise(resolve => {
    const observable = bodyMethods.asObservable();
    const subscription = observable.subscribe({
      next: data => {
        try {
          responseStream.write(data);
        } catch (e) {
          // Something inside Node.js sometimes puts stream
          // in a state where .write() throw despites nodeResponse.destroyed
          // being undefined and "close" event not being emitted.
          // I have tested if we are the one calling destroy
          // (I have commented every .destroy() call)
          // but issue still occurs
          // For the record it's "hard" to reproduce but can be by running
          // a lot of tests against a browser in the context of @jsenv/core testing
          if (e.code === "ERR_HTTP2_INVALID_STREAM") {
            return;
          }
          responseStream.emit("error", e);
        }
      },
      error: value => {
        responseStream.emit("error", value);
      },
      complete: () => {
        responseStream.end();
      }
    });
    raceCallbacks({
      abort: cb => {
        signal.addEventListener("abort", cb);
        return () => {
          signal.removeEventListener("abort", cb);
        };
      },
      error: cb => {
        responseStream.on("error", cb);
        return () => {
          responseStream.removeListener("error", cb);
        };
      },
      close: cb => {
        responseStream.on("close", cb);
        return () => {
          responseStream.removeListener("close", cb);
        };
      },
      finish: cb => {
        responseStream.on("finish", cb);
        return () => {
          responseStream.removeListener("finish", cb);
        };
      }
    }, winner => {
      const raceEffects = {
        abort: () => {
          subscription.unsubscribe();
          responseStream.destroy();
          onAbort();
          resolve();
        },
        error: error => {
          subscription.unsubscribe();
          responseStream.destroy();
          onError(error);
          resolve();
        },
        close: () => {
          // close body in case nodeResponse is prematurely closed
          // while body is writing
          // it may happen in case of server sent event
          // where body is kept open to write to client
          // and the browser is reloaded or closed for instance
          subscription.unsubscribe();
          responseStream.destroy();
          onAbort();
          resolve();
        },
        finish: () => {
          onEnd();
          resolve();
        }
      };
      raceEffects[winner.name](winner.data);
    });
  });
};
const writeHead = (responseStream, {
  status,
  statusText,
  headers,
  onHeadersSent
}) => {
  const responseIsHttp2ServerResponse = responseStream instanceof Http2ServerResponse;
  const responseIsServerHttp2Stream = responseStream.constructor.name === "ServerHttp2Stream";
  let nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader: responseIsHttp2ServerResponse || responseIsServerHttp2Stream
  });
  if (statusText === undefined) {
    statusText = statusTextFromStatus(status);
  }
  if (responseIsServerHttp2Stream) {
    nodeHeaders = {
      ...nodeHeaders,
      ":status": status
    };
    responseStream.respond(nodeHeaders);
    onHeadersSent({
      nodeHeaders,
      status,
      statusText
    });
    return;
  }
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (
  // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
  responseIsHttp2ServerResponse) {
    responseStream.writeHead(status, nodeHeaders);
    onHeadersSent({
      nodeHeaders,
      status,
      statusText
    });
    return;
  }
  try {
    responseStream.writeHead(status, statusText, nodeHeaders);
  } catch (e) {
    if (e.code === "ERR_INVALID_CHAR" && e.message.includes("Invalid character in statusMessage")) {
      throw new Error(`Invalid character in statusMessage
--- status message ---
${statusText}`);
    }
    throw e;
  }
  onHeadersSent({
    nodeHeaders,
    status,
    statusText
  });
};
const statusTextFromStatus = status => http.STATUS_CODES[status] || "not specified";
const headersToNodeHeaders = (headers, {
  ignoreConnectionHeader
}) => {
  const nodeHeaders = {};
  Object.keys(headers).forEach(name => {
    if (name === "connection" && ignoreConnectionHeader) return;
    const nodeHeaderName = name in mapping ? mapping[name] : name;
    nodeHeaders[nodeHeaderName] = headers[name];
  });
  return nodeHeaders;
};
const mapping = {
  // "content-type": "Content-Type",
  // "last-modified": "Last-Modified",
};

// https://github.com/Marak/colors.js/blob/b63ef88e521b42920a9e908848de340b31e68c9d/lib/styles.js#L29

const close = "\x1b[0m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
// const blue = "\x1b[34m"
const magenta = "\x1b[35m";
const cyan = "\x1b[36m";
// const white = "\x1b[37m"

const colorizeResponseStatus = status => {
  const statusType = statusToType(status);
  if (statusType === "information") return `${cyan}${status}${close}`;
  if (statusType === "success") return `${green}${status}${close}`;
  if (statusType === "redirection") return `${magenta}${status}${close}`;
  if (statusType === "client_error") return `${yellow}${status}${close}`;
  if (statusType === "server_error") return `${red}${status}${close}`;
  return status;
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const statusToType = status => {
  if (statusIsInformation(status)) return "information";
  if (statusIsSuccess(status)) return "success";
  if (statusIsRedirection(status)) return "redirection";
  if (statusIsClientError(status)) return "client_error";
  if (statusIsServerError(status)) return "server_error";
  return "unknown";
};
const statusIsInformation = status => status >= 100 && status < 200;
const statusIsSuccess = status => status >= 200 && status < 300;
const statusIsRedirection = status => status >= 300 && status < 400;
const statusIsClientError = status => status >= 400 && status < 500;
const statusIsServerError = status => status >= 500 && status < 600;

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname
}) => {
  const listeningOperation = Abort.startOperation();
  try {
    listeningOperation.addAbortSignal(signal);
    if (portHint) {
      listeningOperation.throwIfAborted();
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname
      });
    }
    listeningOperation.throwIfAborted();
    port = await startListening({
      server,
      port,
      hostname
    });
    listeningOperation.addAbortCallback(() => stopListening(server));
    listeningOperation.throwIfAborted();
    return port;
  } finally {
    await listeningOperation.end();
  }
};
const findFreePort = async (initialPort = 1, {
  signal = new AbortController().signal,
  hostname = "127.0.0.1",
  min = 1,
  max = 65534,
  next = port => port + 1
} = {}) => {
  const findFreePortOperation = Abort.startOperation();
  try {
    findFreePortOperation.addAbortSignal(signal);
    findFreePortOperation.throwIfAborted();
    const testUntil = async (port, host) => {
      findFreePortOperation.throwIfAborted();
      const free = await portIsFree(port, host);
      if (free) {
        return port;
      }
      const nextPort = next(port);
      if (nextPort > max) {
        throw new Error(`${hostname} has no available port between ${min} and ${max}`);
      }
      return testUntil(nextPort, hostname);
    };
    const freePort = await testUntil(initialPort, hostname);
    return freePort;
  } finally {
    await findFreePortOperation.end();
  }
};
const portIsFree = async (port, hostname) => {
  const server = createServer();
  try {
    await startListening({
      server,
      port,
      hostname
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return false;
    }
    if (error && error.code === "EACCES") {
      return false;
    }
    throw error;
  }
  await stopListening(server);
  return true;
};
const startListening = ({
  server,
  port,
  hostname
}) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port);
    });
    server.listen(port, hostname);
  });
};
const stopListening = server => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("close", resolve);
    server.close();
  });
};

const composeTwoObjects = (firstObject, secondObject, {
  keysComposition,
  strict = false,
  forceLowerCase = false
} = {}) => {
  if (forceLowerCase) {
    return applyCompositionForcingLowerCase(firstObject, secondObject, {
      keysComposition,
      strict
    });
  }
  return applyCaseSensitiveComposition(firstObject, secondObject, {
    keysComposition,
    strict
  });
};
const applyCaseSensitiveComposition = (firstObject, secondObject, {
  keysComposition,
  strict
}) => {
  if (strict) {
    const composed = {};
    Object.keys(keysComposition).forEach(key => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: keyExistsIn(key, firstObject) ? key : null,
        secondKey: keyExistsIn(key, secondObject) ? key : null
      });
    });
    return composed;
  }
  const composed = {};
  Object.keys(firstObject).forEach(key => {
    composed[key] = firstObject[key];
  });
  Object.keys(secondObject).forEach(key => {
    composed[key] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key,
      firstKey: keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(key, secondObject) ? key : null
    });
  });
  return composed;
};
const applyCompositionForcingLowerCase = (firstObject, secondObject, {
  keysComposition,
  strict
}) => {
  if (strict) {
    const firstObjectKeyMapping = {};
    Object.keys(firstObject).forEach(key => {
      firstObjectKeyMapping[key.toLowerCase()] = key;
    });
    const secondObjectKeyMapping = {};
    Object.keys(secondObject).forEach(key => {
      secondObjectKeyMapping[key.toLowerCase()] = key;
    });
    Object.keys(keysComposition).forEach(key => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: firstObjectKeyMapping[key] || null,
        secondKey: secondObjectKeyMapping[key] || null
      });
    });
  }
  const composed = {};
  Object.keys(firstObject).forEach(key => {
    composed[key.toLowerCase()] = firstObject[key];
  });
  Object.keys(secondObject).forEach(key => {
    const keyLowercased = key.toLowerCase();
    composed[key.toLowerCase()] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key: keyLowercased,
      firstKey: keyExistsIn(keyLowercased, firstObject) ? keyLowercased : keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(keyLowercased, secondObject) ? keyLowercased : keyExistsIn(key, secondObject) ? key : null
    });
  });
  return composed;
};
const composeValueAtKey = ({
  firstObject,
  secondObject,
  firstKey,
  secondKey,
  key,
  keysComposition
}) => {
  if (!firstKey) {
    return secondObject[secondKey];
  }
  if (!secondKey) {
    return firstObject[firstKey];
  }
  const keyForCustomComposition = keyExistsIn(key, keysComposition) ? key : null;
  if (!keyForCustomComposition) {
    return secondObject[secondKey];
  }
  const composeTwoValues = keysComposition[keyForCustomComposition];
  return composeTwoValues(firstObject[firstKey], secondObject[secondKey]);
};
const keyExistsIn = (key, object) => {
  return Object.prototype.hasOwnProperty.call(object, key);
};

const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true
  });
};
const composeHeaderValues = (value, nextValue) => {
  const headerValues = value.split(", ");
  nextValue.split(", ").forEach(value => {
    if (!headerValues.includes(value)) {
      headerValues.push(value);
    }
  });
  return headerValues.join(", ");
};
const HEADER_NAMES_COMPOSITION = {
  "accept": composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeHeaderValues
};

const composeTwoResponses = (firstResponse, secondResponse) => {
  return composeTwoObjects(firstResponse, secondResponse, {
    keysComposition: RESPONSE_KEYS_COMPOSITION,
    strict: true
  });
};
const RESPONSE_KEYS_COMPOSITION = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  statusMessage: (prevStatusMessage, statusMessage) => statusMessage,
  headers: composeTwoHeaders,
  body: (prevBody, body) => body,
  bodyEncoding: (prevEncoding, encoding) => encoding,
  timing: (prevTiming, timing) => {
    return {
      ...prevTiming,
      ...timing
    };
  }
};

const listenServerConnectionError = (nodeServer, connectionErrorCallback, {
  ignoreErrorAfterConnectionIsDestroyed = true
} = {}) => {
  const cleanupSet = new Set();
  const removeConnectionListener = listenEvent(nodeServer, "connection", socket => {
    const removeSocketErrorListener = listenEvent(socket, "error", error => {
      if (ignoreErrorAfterConnectionIsDestroyed && socket.destroyed) {
        return;
      }
      connectionErrorCallback(error, socket);
    });
    const removeOnceSocketCloseListener = listenEvent(socket, "close", () => {
      removeSocketErrorListener();
      cleanupSet.delete(cleanup);
    }, {
      once: true
    });
    const cleanup = () => {
      removeSocketErrorListener();
      removeOnceSocketCloseListener();
    };
    cleanupSet.add(cleanup);
  });
  return () => {
    removeConnectionListener();
    cleanupSet.forEach(cleanup => {
      cleanup();
    });
    cleanupSet.clear();
  };
};

const createReason = reasonString => {
  return {
    toString: () => reasonString
  };
};
const STOP_REASON_INTERNAL_ERROR = createReason("Internal error");
const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP");
const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM");
const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason("process before exit");
const STOP_REASON_PROCESS_EXIT = createReason("process exit");
const STOP_REASON_NOT_SPECIFIED = createReason("not specified");

const createIpGetters = () => {
  const networkAddresses = [];
  const networkInterfaceMap = networkInterfaces();
  for (const key of Object.keys(networkInterfaceMap)) {
    for (const networkAddress of networkInterfaceMap[key]) {
      networkAddresses.push(networkAddress);
    }
  }
  return {
    getFirstInternalIp: ({
      preferIpv6
    }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstInternalIp;
      for (const networkAddress of networkAddresses) {
        if (networkAddress.internal) {
          firstInternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstInternalIp;
    },
    getFirstExternalIp: ({
      preferIpv6
    }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstExternalIp;
      for (const networkAddress of networkAddresses) {
        if (!networkAddress.internal) {
          firstExternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstExternalIp;
    }
  };
};
const isIpV4 = networkAddress => {
  // node 18.5
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4;
  }
  return networkAddress.family === "IPv4";
};
const isIpV6 = networkAddress => !isIpV4(networkAddress);

const parseHostname = hostname => {
  if (hostname === "0.0.0.0") {
    return {
      type: "ip",
      label: "unspecified",
      version: 4
    };
  }
  if (hostname === "::" || hostname === "0000:0000:0000:0000:0000:0000:0000:0000") {
    return {
      type: "ip",
      label: "unspecified",
      version: 6
    };
  }
  if (hostname === "127.0.0.1") {
    return {
      type: "ip",
      label: "loopback",
      version: 4
    };
  }
  if (hostname === "::1" || hostname === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return {
      type: "ip",
      label: "loopback",
      version: 6
    };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 0) {
    return {
      type: "hostname"
    };
  }
  return {
    type: "ip",
    version: ipVersion
  };
};

const applyDnsResolution = async (hostname, {
  verbatim = false
} = {}) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, {
      verbatim
    }, (error, address, family) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          address,
          family
        });
      }
    });
  });
  return dnsResolution;
};

const startServer = async ({
  signal = new AbortController().signal,
  logLevel,
  startLog = true,
  serverName = "server",
  https = false,
  http2 = false,
  http1Allowed = true,
  redirectHttpToHttps,
  allowHttpRequestOnHttps = false,
  acceptAnyIp = false,
  preferIpv6,
  hostname = "localhost",
  port = 0,
  // assign a random available port
  portHint,
  // when inside a worker, we should not try to stop server on SIGINT
  // otherwise it can create an EPIPE error while primary process tries
  // to kill the server
  stopOnSIGINT = !cluster.isWorker,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when requestToResponse throw an error
  stopOnInternalError = false,
  keepProcessAlive = true,
  services = [],
  nagle = true,
  serverTiming = false,
  requestWaitingMs = 0,
  requestWaitingCallback = ({
    request,
    warn,
    requestWaitingMs
  }) => {
    warn(createDetailedMessage$1(`still no response found for request after ${requestWaitingMs} ms`, {
      "request url": request.url,
      "request headers": JSON.stringify(request.headers, null, "  ")
    }));
  },
  // timeAllocated to start responding to a request
  // after this delay the server will respond with 504
  responseTimeout = 60_000 * 10,
  // 10s
  // time allocated to server code to start reading the request body
  // after this delay the underlying stream is destroyed, attempting to read it would throw
  // if used the stream stays opened, it's only if the stream is not read at all that it gets destroyed
  requestBodyLifetime = 60_000 * 2,
  // 2s
  ...rest
} = {}) => {
  // param validations
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(`${unexpectedParamNames.join(",")}: there is no such param`);
    }
    if (https) {
      if (typeof https !== "object") {
        throw new TypeError(`https must be an object, got ${https}`);
      }
      const {
        certificate,
        privateKey
      } = https;
      if (!certificate || !privateKey) {
        throw new TypeError(`https must be an object with { certificate, privateKey }`);
      }
    }
    if (http2 && !https) {
      throw new Error(`http2 needs https`);
    }
  }
  const logger = createLogger({
    logLevel
  });
  // param warnings and normalization
  {
    if (redirectHttpToHttps === undefined && https && !allowHttpRequestOnHttps) {
      redirectHttpToHttps = true;
    }
    if (redirectHttpToHttps && !https) {
      logger.warn(`redirectHttpToHttps ignored because protocol is http`);
      redirectHttpToHttps = false;
    }
    if (allowHttpRequestOnHttps && redirectHttpToHttps) {
      logger.warn(`redirectHttpToHttps ignored because allowHttpRequestOnHttps is enabled`);
      redirectHttpToHttps = false;
    }
    if (allowHttpRequestOnHttps && !https) {
      logger.warn(`allowHttpRequestOnHttps ignored because protocol is http`);
      allowHttpRequestOnHttps = false;
    }
  }
  const server = {};
  const serviceController = createServiceController(services);
  const processTeardownEvents = {
    SIGHUP: stopOnExit,
    SIGTERM: stopOnExit,
    SIGINT: stopOnSIGINT,
    beforeExit: stopOnExit,
    exit: stopOnExit
  };
  let status = "starting";
  let nodeServer;
  const startServerOperation = Abort.startOperation();
  const stopCallbackList = createCallbackListNotifiedOnce();
  const serverOrigins = {
    local: "" // favors hostname when possible
  };

  try {
    startServerOperation.addAbortSignal(signal);
    startServerOperation.addAbortSource(abort => {
      return raceProcessTeardownEvents(processTeardownEvents, ({
        name
      }) => {
        logger.info(`process teardown (${name}) -> aborting start server`);
        abort();
      });
    });
    startServerOperation.throwIfAborted();
    nodeServer = await createNodeServer({
      https,
      redirectHttpToHttps,
      allowHttpRequestOnHttps,
      http2,
      http1Allowed
    });
    startServerOperation.throwIfAborted();

    // https://nodejs.org/api/net.html#net_server_unref
    if (!keepProcessAlive) {
      nodeServer.unref();
    }
    const createOrigin = hostname => {
      const protocol = https ? "https" : "http";
      if (isIP(hostname) === 6) {
        return `${protocol}://[${hostname}]`;
      }
      return `${protocol}://${hostname}`;
    };
    const ipGetters = createIpGetters();
    let hostnameToListen;
    if (acceptAnyIp) {
      const firstInternalIp = ipGetters.getFirstInternalIp({
        preferIpv6
      });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      const firstExternalIp = ipGetters.getFirstExternalIp({
        preferIpv6
      });
      serverOrigins.externalip = createOrigin(firstExternalIp);
      hostnameToListen = preferIpv6 ? "::" : "0.0.0.0";
    } else {
      hostnameToListen = hostname;
    }
    const hostnameInfo = parseHostname(hostname);
    if (hostnameInfo.type === "ip") {
      if (acceptAnyIp) {
        throw new Error(`hostname cannot be an ip when acceptAnyIp is enabled, got ${hostname}`);
      }
      preferIpv6 = hostnameInfo.version === 6;
      const firstInternalIp = ipGetters.getFirstInternalIp({
        preferIpv6
      });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      if (hostnameInfo.label === "unspecified") {
        const firstExternalIp = ipGetters.getFirstExternalIp({
          preferIpv6
        });
        serverOrigins.externalip = createOrigin(firstExternalIp);
      } else if (hostnameInfo.label === "loopback") {
        // nothing
      } else {
        serverOrigins.local = createOrigin(hostname);
      }
    } else {
      const hostnameDnsResolution = await applyDnsResolution(hostname, {
        verbatim: true
      });
      if (hostnameDnsResolution) {
        const hostnameIp = hostnameDnsResolution.address;
        serverOrigins.localip = createOrigin(hostnameIp);
        serverOrigins.local = createOrigin(hostname);
      } else {
        const firstInternalIp = ipGetters.getFirstInternalIp({
          preferIpv6
        });
        // fallback to internal ip because there is no ip
        // associated to this hostname on operating system (in hosts file)
        hostname = firstInternalIp;
        hostnameToListen = firstInternalIp;
        serverOrigins.local = createOrigin(firstInternalIp);
      }
    }
    port = await listen({
      signal: startServerOperation.signal,
      server: nodeServer,
      port,
      portHint,
      hostname: hostnameToListen
    });

    // normalize origins (remove :80 when port is 80 for instance)
    Object.keys(serverOrigins).forEach(key => {
      serverOrigins[key] = new URL(`${serverOrigins[key]}:${port}`).origin;
    });
    serviceController.callHooks("serverListening", {
      port
    });
    startServerOperation.addAbortCallback(async () => {
      await stopListening(nodeServer);
    });
    startServerOperation.throwIfAborted();
  } finally {
    await startServerOperation.end();
  }

  // the main server origin
  // - when protocol is http
  //   node-fetch do not apply local dns resolution to map localhost back to 127.0.0.1
  //   despites localhost being mapped so we prefer to use the internal ip
  //   (127.0.0.1)
  // - when protocol is https
  //   using the hostname becomes important because the certificate is generated
  //   for hostnames, not for ips
  //   so we prefer https://locahost or https://local_hostname
  //   over the ip
  const serverOrigin = serverOrigins.local;

  // now the server is started (listening) it cannot be aborted anymore
  // (otherwise an AbortError is thrown to the code calling "startServer")
  // we can proceed to create a stop function to stop it gacefully
  // and add a request handler
  stopCallbackList.add(({
    reason
  }) => {
    logger.info(`${serverName} stopping server (reason: ${reason})`);
  });
  stopCallbackList.add(async () => {
    await stopListening(nodeServer);
  });
  let stoppedResolve;
  const stoppedPromise = new Promise(resolve => {
    stoppedResolve = resolve;
  });
  const stop = memoize(async (reason = STOP_REASON_NOT_SPECIFIED) => {
    status = "stopping";
    await Promise.all(stopCallbackList.notify({
      reason
    }));
    serviceController.callHooks("serverStopped", {
      reason
    });
    status = "stopped";
    stoppedResolve(reason);
  });
  const cancelProcessTeardownRace = raceProcessTeardownEvents(processTeardownEvents, winner => {
    stop(PROCESS_TEARDOWN_EVENTS_MAP[winner.name]);
  });
  stopCallbackList.add(cancelProcessTeardownRace);
  const onError = error => {
    if (status === "stopping" && error.code === "ECONNRESET") {
      return;
    }
    throw error;
  };
  status = "opened";
  const removeConnectionErrorListener = listenServerConnectionError(nodeServer, onError);
  stopCallbackList.add(removeConnectionErrorListener);
  const connectionsTracker = trackServerPendingConnections(nodeServer, {
    http2
  });
  // opened connection must be shutdown before the close event is emitted
  stopCallbackList.add(connectionsTracker.stop);
  const pendingRequestsTracker = trackServerPendingRequests(nodeServer, {
    http2
  });
  // ensure pending requests got a response from the server
  stopCallbackList.add(reason => {
    pendingRequestsTracker.stop({
      status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
      reason
    });
  });
  {
    const requestCallback = async (nodeRequest, nodeResponse) => {
      // pause the stream to let a chance to "requestToResponse"
      // to call "requestRequestBody". Without this the request body readable stream
      // might be closed when we'll try to attach "data" and "end" listeners to it
      nodeRequest.pause();
      if (!nagle) {
        nodeRequest.connection.setNoDelay(true);
      }
      if (redirectHttpToHttps && !nodeRequest.connection.encrypted) {
        nodeResponse.writeHead(301, {
          location: `${serverOrigin}${nodeRequest.url}`
        });
        nodeResponse.end();
        return;
      }
      const receiveRequestOperation = Abort.startOperation();
      receiveRequestOperation.addAbortSource(abort => {
        const closeEventCallback = () => {
          if (nodeRequest.complete) {
            receiveRequestOperation.end();
          } else {
            nodeResponse.destroy();
            abort();
          }
        };
        nodeRequest.once("close", closeEventCallback);
        return () => {
          nodeRequest.removeListener("close", closeEventCallback);
        };
      });
      receiveRequestOperation.addAbortSource(abort => {
        return stopCallbackList.add(abort);
      });
      const sendResponseOperation = Abort.startOperation();
      sendResponseOperation.addAbortSignal(receiveRequestOperation.signal);
      sendResponseOperation.addAbortSource(abort => {
        return stopCallbackList.add(abort);
      });
      const request = fromNodeRequest(nodeRequest, {
        serverOrigin,
        signal: receiveRequestOperation.signal
      });

      // Handling request is asynchronous, we buffer logs for that request
      // until we know what happens with that request
      // It delays logs until we know of the request will be handled
      // but it's mandatory to make logs readable.
      const rootRequestNode = {
        logs: [],
        children: []
      };
      const addRequestLog = (node, {
        type,
        value
      }) => {
        node.logs.push({
          type,
          value
        });
      };
      const onRequestHandled = node => {
        if (node !== rootRequestNode) {
          // keep buffering until root request write logs for everyone
          return;
        }
        const prefixLines = (string, prefix) => {
          return string.replace(/^(?!\s*$)/gm, prefix);
        };
        const writeLog = ({
          type,
          value
        }, {
          someLogIsError,
          someLogIsWarn,
          depth
        }) => {
          if (depth > 0) {
            value = prefixLines(value, "  ".repeat(depth));
          }
          if (type === "info") {
            if (someLogIsError) {
              type = "error";
            } else if (someLogIsWarn) {
              type = "warn";
            }
          }
          logger[type](value);
        };
        const visitRequestNodeToLog = (requestNode, depth) => {
          let someLogIsError = false;
          let someLogIsWarn = false;
          requestNode.logs.forEach(log => {
            if (log.type === "error") {
              someLogIsError = true;
            }
            if (log.type === "warn") {
              someLogIsWarn = true;
            }
          });
          const firstLog = requestNode.logs.shift();
          const lastLog = requestNode.logs.pop();
          const middleLogs = requestNode.logs;
          writeLog(firstLog, {
            someLogIsError,
            someLogIsWarn,
            depth
          });
          middleLogs.forEach(log => {
            writeLog(log, {
              someLogIsError,
              someLogIsWarn,
              depth
            });
          });
          requestNode.children.forEach(child => {
            visitRequestNodeToLog(child, depth + 1);
          });
          if (lastLog) {
            writeLog(lastLog, {
              someLogIsError,
              someLogIsWarn,
              depth: depth + 1
            });
          }
        };
        visitRequestNodeToLog(rootRequestNode, 0);
      };
      nodeRequest.on("error", error => {
        if (error.message === "aborted") {
          addRequestLog(rootRequestNode, {
            type: "debug",
            value: createDetailedMessage$1(`request aborted by client`, {
              "error message": error.message
            })
          });
        } else {
          // I'm not sure this can happen but it's here in case
          addRequestLog(rootRequestNode, {
            type: "error",
            value: createDetailedMessage$1(`"error" event emitted on request`, {
              "error stack": error.stack
            })
          });
        }
      });
      const pushResponse = async ({
        path,
        method
      }, {
        requestNode
      }) => {
        const http2Stream = nodeResponse.stream;

        // being able to push a stream is nice to have
        // so when it fails it's not critical
        const onPushStreamError = e => {
          addRequestLog(requestNode, {
            type: "error",
            value: createDetailedMessage$1(`An error occured while pushing a stream to the response for ${request.resource}`, {
              "error stack": e.stack
            })
          });
        };

        // not aborted, let's try to push a stream into that response
        // https://nodejs.org/docs/latest-v16.x/api/http2.html#http2streampushstreamheaders-options-callback
        let pushStream;
        try {
          pushStream = await new Promise((resolve, reject) => {
            http2Stream.pushStream({
              ":path": path,
              ...(method ? {
                ":method": method
              } : {})
            }, async (error, pushStream
            // headers
            ) => {
              if (error) {
                reject(error);
              }
              resolve(pushStream);
            });
          });
        } catch (e) {
          onPushStreamError(e);
          return;
        }
        const abortController = new AbortController();
        // It's possible to get NGHTTP2_REFUSED_STREAM errors here
        // https://github.com/nodejs/node/issues/20824
        const pushErrorCallback = error => {
          onPushStreamError(error);
          abortController.abort();
        };
        pushStream.on("error", pushErrorCallback);
        sendResponseOperation.addEndCallback(() => {
          pushStream.removeListener("error", onPushStreamError);
        });
        await sendResponseOperation.withSignal(async signal => {
          const pushResponseOperation = Abort.startOperation();
          pushResponseOperation.addAbortSignal(signal);
          pushResponseOperation.addAbortSignal(abortController.signal);
          const pushRequest = createPushRequest(request, {
            signal: pushResponseOperation.signal,
            pathname: path,
            method
          });
          try {
            const responseProperties = await handleRequest(pushRequest, {
              requestNode
            });
            if (!abortController.signal.aborted) {
              if (pushStream.destroyed) {
                abortController.abort();
              } else if (!http2Stream.pushAllowed) {
                abortController.abort();
              } else if (responseProperties.requestAborted) {} else {
                const responseLength = responseProperties.headers["content-length"] || 0;
                const {
                  effectiveRecvDataLength,
                  remoteWindowSize
                } = http2Stream.session.state;
                if (effectiveRecvDataLength + responseLength > remoteWindowSize) {
                  addRequestLog(requestNode, {
                    type: "debug",
                    value: `Aborting stream to prevent exceeding remoteWindowSize`
                  });
                  abortController.abort();
                }
              }
            }
            await sendResponse({
              signal: pushResponseOperation.signal,
              request: pushRequest,
              requestNode,
              responseStream: pushStream,
              responseProperties
            });
          } finally {
            await pushResponseOperation.end();
          }
        });
      };
      const handleRequest = async (request, {
        requestNode
      }) => {
        let requestReceivedMeasure;
        if (serverTiming) {
          requestReceivedMeasure = performance.now();
        }
        addRequestLog(requestNode, {
          type: "info",
          value: request.parent ? `Push ${request.resource}` : `${request.method} ${request.url}`
        });
        const warn = value => {
          addRequestLog(requestNode, {
            type: "warn",
            value
          });
        };
        let requestWaitingTimeout;
        if (requestWaitingMs) {
          requestWaitingTimeout = setTimeout(() => requestWaitingCallback({
            request,
            warn,
            requestWaitingMs
          }), requestWaitingMs).unref();
        }
        serviceController.callHooks("redirectRequest", request, {
          warn
        }, newRequestProperties => {
          if (newRequestProperties) {
            request = applyRedirectionToRequest(request, {
              original: request.original || request,
              previous: request,
              ...newRequestProperties
            });
          }
        });
        let handleRequestReturnValue;
        let errorWhileHandlingRequest = null;
        let handleRequestTimings = serverTiming ? {} : null;
        let timeout;
        const timeoutPromise = new Promise(resolve => {
          timeout = setTimeout(() => {
            resolve({
              // the correct status code should be 500 because it's
              // we don't really know what takes time
              // in practice it's often because server is trying to reach an other server
              // that is not responding so 504 is more correct
              status: 504,
              statusText: `server timeout after ${responseTimeout / 1000}s waiting to handle request`
            });
          }, responseTimeout);
        });
        const handleRequestPromise = serviceController.callAsyncHooksUntil("handleRequest", request, {
          timing: handleRequestTimings,
          warn,
          pushResponse: async ({
            path,
            method
          }) => {
            if (typeof path !== "string" || path[0] !== "/") {
              addRequestLog(requestNode, {
                type: "warn",
                value: `response push ignored because path is invalid (must be a string starting with "/", found ${path})`
              });
              return;
            }
            if (!request.http2) {
              addRequestLog(requestNode, {
                type: "warn",
                value: `response push ignored because request is not http2`
              });
              return;
            }
            const canPushStream = testCanPushStream(nodeResponse.stream);
            if (!canPushStream.can) {
              addRequestLog(requestNode, {
                type: "debug",
                value: `response push ignored because ${canPushStream.reason}`
              });
              return;
            }
            let preventedByService = null;
            const prevent = () => {
              preventedByService = serviceController.getCurrentService();
            };
            serviceController.callHooksUntil("onResponsePush", {
              path,
              method
            }, {
              request,
              warn,
              prevent
            }, () => preventedByService);
            if (preventedByService) {
              addRequestLog(requestNode, {
                type: "debug",
                value: `response push prevented by "${preventedByService.name}" service`
              });
              return;
            }
            const requestChildNode = {
              logs: [],
              children: []
            };
            requestNode.children.push(requestChildNode);
            await pushResponse({
              path,
              method
            }, {
              requestNode: requestChildNode,
              parentHttp2Stream: nodeResponse.stream
            });
          }
        });
        try {
          handleRequestReturnValue = await Promise.race([timeoutPromise, handleRequestPromise]);
        } catch (e) {
          errorWhileHandlingRequest = e;
        }
        clearTimeout(timeout);
        let responseProperties;
        if (errorWhileHandlingRequest) {
          if (errorWhileHandlingRequest.name === "AbortError" && request.signal.aborted) {
            responseProperties = {
              requestAborted: true
            };
          } else {
            // internal error, create 500 response
            if (
            // stopOnInternalError stops server only if requestToResponse generated
            // a non controlled error (internal error).
            // if requestToResponse gracefully produced a 500 response (it did not throw)
            // then we can assume we are still in control of what we are doing
            stopOnInternalError) {
              // il faudrais pouvoir stop que les autres response ?
              stop(STOP_REASON_INTERNAL_ERROR);
            }
            const handleErrorReturnValue = await serviceController.callAsyncHooksUntil("handleError", errorWhileHandlingRequest, {
              request,
              warn
            });
            if (!handleErrorReturnValue) {
              throw errorWhileHandlingRequest;
            }
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage$1(`internal error while handling request`, {
                "error stack": errorWhileHandlingRequest.stack
              })
            });
            responseProperties = composeTwoResponses({
              status: 500,
              statusText: "Internal Server Error",
              headers: {
                // ensure error are not cached
                "cache-control": "no-store",
                "content-type": "text/plain"
              }
            }, handleErrorReturnValue);
          }
        } else {
          const {
            status = 501,
            statusText,
            statusMessage,
            headers = {},
            body,
            ...rest
          } = handleRequestReturnValue || {};
          responseProperties = {
            status,
            statusText,
            statusMessage,
            headers,
            body,
            ...rest
          };
        }
        if (serverTiming) {
          const responseReadyMeasure = performance.now();
          const timeToStartResponding = responseReadyMeasure - requestReceivedMeasure;
          const serverTiming = {
            ...handleRequestTimings,
            ...responseProperties.timing,
            "time to start responding": timeToStartResponding
          };
          responseProperties.headers = composeTwoHeaders(responseProperties.headers, timingToServerTimingResponseHeaders(serverTiming));
        }
        if (requestWaitingMs) {
          clearTimeout(requestWaitingTimeout);
        }
        if (request.method !== "HEAD" && responseProperties.headers["content-length"] > 0 && !responseProperties.body) {
          addRequestLog(requestNode, {
            type: "warn",
            value: `content-length header is ${responseProperties.headers["content-length"]} but body is empty`
          });
        }
        serviceController.callHooks("injectResponseHeaders", responseProperties, {
          request,
          warn
        }, returnValue => {
          if (returnValue) {
            responseProperties.headers = composeTwoHeaders(responseProperties.headers, returnValue);
          }
        });
        serviceController.callHooks("responseReady", responseProperties, {
          request,
          warn
        });
        return responseProperties;
      };
      const sendResponse = async ({
        signal,
        request,
        requestNode,
        responseStream,
        responseProperties
      }) => {
        // When "pushResponse" is called and the parent response has no body
        // the parent response is immediatly ended. It means child responses (pushed streams)
        // won't get a chance to be pushed.
        // To let a chance to pushed streams we wait a little before sending the response
        const ignoreBody = request.method === "HEAD";
        const bodyIsEmpty = !responseProperties.body || ignoreBody;
        if (bodyIsEmpty && requestNode.children.length > 0) {
          await new Promise(resolve => setTimeout(resolve));
        }
        await writeNodeResponse(responseStream, responseProperties, {
          signal,
          ignoreBody,
          onAbort: () => {
            addRequestLog(requestNode, {
              type: "info",
              value: `response aborted`
            });
            onRequestHandled(requestNode);
          },
          onError: error => {
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage$1(`An error occured while sending response`, {
                "error stack": error.stack
              })
            });
            onRequestHandled(requestNode);
          },
          onHeadersSent: ({
            status,
            statusText
          }) => {
            const statusType = statusToType(status);
            addRequestLog(requestNode, {
              type: status === 404 && request.pathname === "/favicon.ico" ? "debug" : {
                information: "info",
                success: "info",
                redirection: "info",
                client_error: "warn",
                server_error: "error"
              }[statusType],
              value: `${colorizeResponseStatus(status)} ${responseProperties.statusMessage || statusText}`
            });
          },
          onEnd: () => {
            onRequestHandled(requestNode);
          }
        });
      };
      try {
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        const responseProperties = await handleRequest(request, {
          requestNode: rootRequestNode
        });
        nodeRequest.resume();
        if (receiveRequestOperation.signal.aborted) {
          return;
        }

        // the node request readable stream is never closed because
        // the response headers contains "connection: keep-alive"
        // In this scenario we want to disable READABLE_STREAM_TIMEOUT warning
        if (responseProperties.headers.connection === "keep-alive") {
          clearTimeout(request.body.timeout);
        }
        await sendResponse({
          signal: sendResponseOperation.signal,
          request,
          requestNode: rootRequestNode,
          responseStream: nodeResponse,
          responseProperties
        });
      } finally {
        await sendResponseOperation.end();
      }
    };
    const removeRequestListener = listenRequest(nodeServer, requestCallback);
    // ensure we don't try to handle new requests while server is stopping
    stopCallbackList.add(removeRequestListener);
  }
  {
    // https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
    const websocketHandlers = [];
    serviceController.services.forEach(service => {
      const {
        handleWebsocket
      } = service;
      if (handleWebsocket) {
        websocketHandlers.push(handleWebsocket);
      }
    });
    if (websocketHandlers.length > 0) {
      const websocketClients = new Set();
      const {
        WebSocketServer
      } = await import("./js/ws.js?cjs_as_js_module=");
      let websocketServer = new WebSocketServer({
        noServer: true
      });
      const websocketOrigin = https ? `wss://${hostname}:${port}` : `ws://${hostname}:${port}`;
      server.websocketOrigin = websocketOrigin;
      const upgradeCallback = (nodeRequest, socket, head) => {
        websocketServer.handleUpgrade(nodeRequest, socket, head, async websocket => {
          websocketClients.add(websocket);
          websocket.once("close", () => {
            websocketClients.delete(websocket);
          });
          const request = fromNodeRequest(nodeRequest, {
            serverOrigin: websocketOrigin,
            signal: new AbortController().signal,
            requestBodyLifetime
          });
          serviceController.callAsyncHooksUntil("handleWebsocket", websocket, {
            request
          });
        });
      };

      // see server-polyglot.js, upgrade must be listened on https server when used
      const facadeServer = nodeServer._tlsServer || nodeServer;
      const removeUpgradeCallback = listenEvent(facadeServer, "upgrade", upgradeCallback);
      stopCallbackList.add(removeUpgradeCallback);
      stopCallbackList.add(() => {
        websocketClients.forEach(websocketClient => {
          websocketClient.close();
        });
        websocketClients.clear();
        websocketServer.close();
        websocketServer = null;
      });
    }
  }
  if (startLog) {
    if (serverOrigins.network) {
      logger.info(`${serverName} started at ${serverOrigins.local} (${serverOrigins.network})`);
    } else {
      logger.info(`${serverName} started at ${serverOrigins.local}`);
    }
  }
  Object.assign(server, {
    getStatus: () => status,
    port,
    hostname,
    origin: serverOrigin,
    origins: serverOrigins,
    nodeServer,
    stop,
    stoppedPromise,
    addEffect: callback => {
      const cleanup = callback();
      if (typeof cleanup === "function") {
        stopCallbackList.add(cleanup);
      }
    }
  });
  return server;
};
const createNodeServer = async ({
  https,
  redirectHttpToHttps,
  allowHttpRequestOnHttps,
  http2,
  http1Allowed
}) => {
  if (https) {
    const {
      certificate,
      privateKey
    } = https;
    if (redirectHttpToHttps || allowHttpRequestOnHttps) {
      return createPolyglotServer({
        certificate,
        privateKey,
        http2,
        http1Allowed
      });
    }
    const {
      createServer
    } = await import("node:https");
    return createServer({
      cert: certificate,
      key: privateKey
    });
  }
  const {
    createServer
  } = await import("node:http");
  return createServer();
};
const testCanPushStream = http2Stream => {
  if (!http2Stream.pushAllowed) {
    return {
      can: false,
      reason: `stream.pushAllowed is false`
    };
  }

  // See https://nodejs.org/dist/latest-v16.x/docs/api/http2.html#http2sessionstate
  // And https://github.com/google/node-h2-auto-push/blob/67a36c04cbbd6da7b066a4e8d361c593d38853a4/src/index.ts#L100-L106
  const {
    remoteWindowSize
  } = http2Stream.session.state;
  if (remoteWindowSize === 0) {
    return {
      can: false,
      reason: `no more remoteWindowSize`
    };
  }
  return {
    can: true
  };
};
const PROCESS_TEARDOWN_EVENTS_MAP = {
  SIGHUP: STOP_REASON_PROCESS_SIGHUP,
  SIGTERM: STOP_REASON_PROCESS_SIGTERM,
  SIGINT: STOP_REASON_PROCESS_SIGINT,
  beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
  exit: STOP_REASON_PROCESS_EXIT
};

const mediaTypeInfos = {
  "application/json": {
    extensions: ["json"],
    isTextual: true
  },
  "application/importmap+json": {
    extensions: ["importmap"],
    isTextual: true
  },
  "application/manifest+json": {
    extensions: ["webmanifest"],
    isTextual: true
  },
  "application/octet-stream": {},
  "application/pdf": {
    extensions: ["pdf"]
  },
  "application/xml": {
    extensions: ["xml"]
  },
  "application/x-gzip": {
    extensions: ["gz"]
  },
  "application/wasm": {
    extensions: ["wasm"]
  },
  "application/zip": {
    extensions: ["zip"]
  },
  "audio/basic": {
    extensions: ["au", "snd"]
  },
  "audio/mpeg": {
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
  },
  "audio/midi": {
    extensions: ["midi", "mid", "kar", "rmi"]
  },
  "audio/mp4": {
    extensions: ["m4a", "mp4a"]
  },
  "audio/ogg": {
    extensions: ["oga", "ogg", "spx"]
  },
  "audio/webm": {
    extensions: ["weba"]
  },
  "audio/x-wav": {
    extensions: ["wav"]
  },
  "font/ttf": {
    extensions: ["ttf"]
  },
  "font/woff": {
    extensions: ["woff"]
  },
  "font/woff2": {
    extensions: ["woff2"]
  },
  "image/png": {
    extensions: ["png"]
  },
  "image/gif": {
    extensions: ["gif"]
  },
  "image/jpeg": {
    extensions: ["jpg"]
  },
  "image/svg+xml": {
    extensions: ["svg", "svgz"],
    isTextual: true
  },
  "text/plain": {
    extensions: ["txt"]
  },
  "text/html": {
    extensions: ["html"]
  },
  "text/css": {
    extensions: ["css"]
  },
  "text/javascript": {
    extensions: ["js", "cjs", "mjs", "ts", "jsx", "tsx"]
  },
  "text/x-sass": {
    extensions: ["sass"]
  },
  "text/x-scss": {
    extensions: ["scss"]
  },
  "text/cache-manifest": {
    extensions: ["appcache"]
  },
  "video/mp4": {
    extensions: ["mp4", "mp4v", "mpg4"]
  },
  "video/mpeg": {
    extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
  },
  "video/ogg": {
    extensions: ["ogv"]
  },
  "video/webm": {
    extensions: ["webm"]
  }
};

const CONTENT_TYPE = {
  parse: string => {
    const [mediaType, charset] = string.split(";");
    return {
      mediaType: normalizeMediaType(mediaType),
      charset
    };
  },
  stringify: ({
    mediaType,
    charset
  }) => {
    if (charset) {
      return `${mediaType};${charset}`;
    }
    return mediaType;
  },
  asMediaType: value => {
    if (typeof value === "string") {
      return CONTENT_TYPE.parse(value).mediaType;
    }
    if (typeof value === "object") {
      return value.mediaType;
    }
    return null;
  },
  isJson: value => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    return mediaType === "application/json" || /^application\/\w+\+json$/.test(mediaType);
  },
  isTextual: value => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    if (mediaType.startsWith("text/")) {
      return true;
    }
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    if (mediaTypeInfo && mediaTypeInfo.isTextual) {
      return true;
    }
    // catch things like application/manifest+json, application/importmap+json
    if (/^application\/\w+\+json$/.test(mediaType)) {
      return true;
    }
    return false;
  },
  isBinary: value => !CONTENT_TYPE.isTextual(value),
  asFileExtension: value => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },
  fromUrlExtension: url => {
    const {
      pathname
    } = new URL(url);
    const extensionWithDot = extname(pathname);
    if (!extensionWithDot || extensionWithDot === ".") {
      return "application/octet-stream";
    }
    const extension = extensionWithDot.slice(1);
    const mediaTypeFound = Object.keys(mediaTypeInfos).find(mediaType => {
      const mediaTypeInfo = mediaTypeInfos[mediaType];
      return mediaTypeInfo.extensions && mediaTypeInfo.extensions.includes(extension);
    });
    return mediaTypeFound || "application/octet-stream";
  }
};
const normalizeMediaType = value => {
  if (value === "application/javascript") {
    return "text/javascript";
  }
  return value;
};

const isFileSystemPath = value => {
  if (typeof value !== "string") {
    throw new TypeError(`isFileSystemPath first arg must be a string, got ${value}`);
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
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }
  return String(pathToFileURL(value));
};

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
const bufferToEtag = buffer => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`);
  }
  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT;
  }
  const hash = createHash("sha1");
  hash.update(buffer, "utf8");
  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;
  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

const convertFileSystemErrorToResponseProperties = error => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: `EACCES: No permission to read file at ${error.path}`
    };
  }
  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: `EPERM: No permission to read file at ${error.path}`
    };
  }
  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: `ENOENT: File not found at ${error.path}`
    };
  }
  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: `EBUSY: File is busy ${error.path}`,
      headers: {
        "retry-after": 0.01 // retry in 10ms
      }
    };
  }
  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "EMFILE: too many file opened",
      headers: {
        "retry-after": 0.1 // retry in 100ms
      }
    };
  }

  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: `EISDIR: Unexpected directory operation at ${error.path}`
    };
  }
  return null;
};
const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};

const pickAcceptedContent = ({
  availables,
  accepteds,
  getAcceptanceScore
}) => {
  let highestScore = -1;
  let availableWithHighestScore = null;
  let availableIndex = 0;
  while (availableIndex < availables.length) {
    const available = availables[availableIndex];
    availableIndex++;
    let acceptedIndex = 0;
    while (acceptedIndex < accepteds.length) {
      const accepted = accepteds[acceptedIndex];
      acceptedIndex++;
      const score = getAcceptanceScore(accepted, available);
      if (score > highestScore) {
        availableWithHighestScore = available;
        highestScore = score;
      }
    }
  }
  return availableWithHighestScore;
};

const pickContentEncoding = (request, availableEncodings) => {
  const {
    headers = {}
  } = request;
  const requestAcceptEncodingHeader = headers["accept-encoding"];
  if (!requestAcceptEncodingHeader) {
    return null;
  }
  const encodingsAccepted = parseAcceptEncodingHeader(requestAcceptEncodingHeader);
  return pickAcceptedContent({
    accepteds: encodingsAccepted,
    availables: availableEncodings,
    getAcceptanceScore: getEncodingAcceptanceScore
  });
};
const parseAcceptEncodingHeader = acceptEncodingHeaderString => {
  const acceptEncodingHeader = parseMultipleHeader(acceptEncodingHeaderString, {
    validateProperty: ({
      name
    }) => {
      // read only q, anything else is ignored
      return name === "q";
    }
  });
  const encodingsAccepted = [];
  Object.keys(acceptEncodingHeader).forEach(key => {
    const {
      q = 1
    } = acceptEncodingHeader[key];
    const value = key;
    encodingsAccepted.push({
      value,
      quality: q
    });
  });
  encodingsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return encodingsAccepted;
};
const getEncodingAcceptanceScore = ({
  value,
  quality
}, availableEncoding) => {
  if (value === "*") {
    return quality;
  }

  // normalize br to brotli
  if (value === "br") value = "brotli";
  if (availableEncoding === "br") availableEncoding = "brotli";
  if (value === availableEncoding) {
    return quality;
  }
  return -1;
};

const pickContentType = (request, availableContentTypes) => {
  const {
    headers = {}
  } = request;
  const requestAcceptHeader = headers.accept;
  if (!requestAcceptHeader) {
    return null;
  }
  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader);
  return pickAcceptedContent({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore
  });
};
const parseAcceptHeader = acceptHeader => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({
      name
    }) => {
      // read only q, anything else is ignored
      return name === "q";
    }
  });
  const accepts = [];
  Object.keys(acceptHeaderObject).forEach(key => {
    const {
      q = 1
    } = acceptHeaderObject[key];
    const value = key;
    accepts.push({
      value,
      quality: q
    });
  });
  accepts.sort((a, b) => {
    return b.quality - a.quality;
  });
  return accepts;
};
const getContentTypeAcceptanceScore = ({
  value,
  quality
}, availableContentType) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value);
  const [availableType, availableSubtype] = decomposeContentType(availableContentType);
  const typeAccepted = acceptedType === "*" || acceptedType === availableType;
  const subtypeAccepted = acceptedSubtype === "*" || acceptedSubtype === availableSubtype;
  if (typeAccepted && subtypeAccepted) {
    return quality;
  }
  return -1;
};
const decomposeContentType = fullType => {
  const [type, subtype] = fullType.split("/");
  return [type, subtype];
};

const serveDirectory = (url, {
  headers = {},
  rootDirectoryUrl
} = {}) => {
  url = String(url);
  url = url[url.length - 1] === "/" ? url : `${url}/`;
  const directoryContentArray = readdirSync(new URL(url));
  const responseProducers = {
    "application/json": () => {
      const directoryContentJson = JSON.stringify(directoryContentArray);
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": directoryContentJson.length
        },
        body: directoryContentJson
      };
    },
    "text/html": () => {
      const directoryAsHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Directory explorer</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Content of directory ${url}</h1>
    <ul>
      ${directoryContentArray.map(filename => {
        const fileUrl = String(new URL(filename, url));
        const fileUrlRelativeToServer = fileUrl.slice(String(rootDirectoryUrl).length);
        return `<li>
        <a href="/${fileUrlRelativeToServer}">${fileUrlRelativeToServer}</a>
      </li>`;
      }).join(`
      `)}
    </ul>
  </body>
</html>`;
      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(directoryAsHtml)
        },
        body: directoryAsHtml
      };
    }
  };
  const bestContentType = pickContentType({
    headers
  }, Object.keys(responseProducers));
  return responseProducers[bestContentType || "application/json"]();
};

/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */
const fetchFileSystem = async (filesystemUrl, {
  // signal,
  method = "GET",
  headers = {},
  etagEnabled = false,
  etagMemory = true,
  etagMemoryMaxSize = 1000,
  mtimeEnabled = false,
  compressionEnabled = false,
  compressionSizeThreshold = 1024,
  cacheControl = etagEnabled || mtimeEnabled ? "private,max-age=0,must-revalidate" : "no-store",
  canReadDirectory = false,
  rootDirectoryUrl //  = `${pathToFileURL(process.cwd())}/`,
} = {}) => {
  const urlString = asUrlString(filesystemUrl);
  if (!urlString) {
    return create500Response(`fetchFileSystem first parameter must be a file url, got ${filesystemUrl}`);
  }
  if (!urlString.startsWith("file://")) {
    return create500Response(`fetchFileSystem url must use "file://" scheme, got ${filesystemUrl}`);
  }
  if (rootDirectoryUrl) {
    let rootDirectoryUrlString = asUrlString(rootDirectoryUrl);
    if (!rootDirectoryUrlString) {
      return create500Response(`rootDirectoryUrl must be a string or an url, got ${rootDirectoryUrl}`);
    }
    if (!rootDirectoryUrlString.endsWith("/")) {
      rootDirectoryUrlString = `${rootDirectoryUrlString}/`;
    }
    if (!urlString.startsWith(rootDirectoryUrlString)) {
      return create500Response(`fetchFileSystem url must be inside root directory, got ${urlString}`);
    }
    rootDirectoryUrl = rootDirectoryUrlString;
  }

  // here you might be tempted to add || cacheControl === 'no-cache'
  // but no-cache means resource can be cached but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability
  if (cacheControl === "no-store") {
    if (etagEnabled) {
      console.warn(`cannot enable etag when cache-control is ${cacheControl}`);
      etagEnabled = false;
    }
    if (mtimeEnabled) {
      console.warn(`cannot enable mtime when cache-control is ${cacheControl}`);
      mtimeEnabled = false;
    }
  }
  if (etagEnabled && mtimeEnabled) {
    console.warn(`cannot enable both etag and mtime, mtime disabled in favor of etag.`);
    mtimeEnabled = false;
  }
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501
    };
  }
  const sourceUrl = `file://${new URL(urlString).pathname}`;
  try {
    const [readStatTiming, sourceStat] = await timeFunction("file service>read file stat", () => statSync(new URL(sourceUrl)));
    if (sourceStat.isDirectory()) {
      if (canReadDirectory) {
        return serveDirectory(urlString, {
          headers,
          canReadDirectory,
          rootDirectoryUrl
        });
      }
      return {
        status: 403,
        statusText: "not allowed to read directory"
      };
    }
    // not a file, give up
    if (!sourceStat.isFile()) {
      return {
        status: 404,
        timing: readStatTiming
      };
    }
    const clientCacheResponse = await getClientCacheResponse({
      headers,
      etagEnabled,
      etagMemory,
      etagMemoryMaxSize,
      mtimeEnabled,
      sourceStat,
      sourceUrl
    });

    // send 304 (redirect response to client cache)
    // because the response body does not have to be transmitted
    if (clientCacheResponse.status === 304) {
      return composeTwoResponses({
        timing: readStatTiming,
        headers: {
          ...(cacheControl ? {
            "cache-control": cacheControl
          } : {})
        }
      }, clientCacheResponse);
    }
    let response;
    if (compressionEnabled && sourceStat.size >= compressionSizeThreshold) {
      const compressedResponse = await getCompressedResponse({
        headers,
        sourceUrl
      });
      if (compressedResponse) {
        response = compressedResponse;
      }
    }
    if (!response) {
      response = await getRawResponse({
        sourceStat,
        sourceUrl
      });
    }
    const intermediateResponse = composeTwoResponses({
      timing: readStatTiming,
      headers: {
        ...(cacheControl ? {
          "cache-control": cacheControl
        } : {})
        // even if client cache is disabled, server can still
        // send his own cache control but client should just ignore it
        // and keep sending cache-control: 'no-store'
        // if not, uncomment the line below to preserve client
        // desire to ignore cache
        // ...(headers["cache-control"] === "no-store" ? { "cache-control": "no-store" } : {}),
      }
    }, response);
    return composeTwoResponses(intermediateResponse, clientCacheResponse);
  } catch (e) {
    return composeTwoResponses({
      headers: {
        ...(cacheControl ? {
          "cache-control": cacheControl
        } : {})
      }
    }, convertFileSystemErrorToResponseProperties(e) || {});
  }
};
const create500Response = message => {
  return {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(message)
    },
    body: message
  };
};
const getClientCacheResponse = async ({
  headers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  sourceStat,
  sourceUrl
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means resource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (headers["cache-control"] === "no-store" ||
  // let's disable it on no-cache too
  headers["cache-control"] === "no-cache") {
    return {
      status: 200
    };
  }
  if (etagEnabled) {
    return getEtagResponse({
      headers,
      etagMemory,
      etagMemoryMaxSize,
      sourceStat,
      sourceUrl
    });
  }
  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      sourceStat
    });
  }
  return {
    status: 200
  };
};
const getEtagResponse = async ({
  headers,
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat
}) => {
  const [computeEtagTiming, fileContentEtag] = await timeFunction("file service>generate file etag", () => computeEtag({
    etagMemory,
    etagMemoryMaxSize,
    sourceUrl,
    sourceStat
  }));
  const requestHasIfNoneMatchHeader = ("if-none-match" in headers);
  if (requestHasIfNoneMatchHeader && headers["if-none-match"] === fileContentEtag) {
    return {
      status: 304,
      timing: computeEtagTiming
    };
  }
  return {
    status: 200,
    headers: {
      etag: fileContentEtag
    },
    timing: computeEtagTiming
  };
};
const ETAG_MEMORY_MAP = new Map();
const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(sourceUrl);
    if (etagMemoryEntry && fileStatAreTheSame(etagMemoryEntry.sourceStat, sourceStat)) {
      return etagMemoryEntry.eTag;
    }
  }
  const fileContentAsBuffer = await new Promise((resolve, reject) => {
    readFile(new URL(sourceUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
  const eTag = bufferToEtag(fileContentAsBuffer);
  if (etagMemory) {
    if (ETAG_MEMORY_MAP.size >= etagMemoryMaxSize) {
      const firstKey = Array.from(ETAG_MEMORY_MAP.keys())[0];
      ETAG_MEMORY_MAP.delete(firstKey);
    }
    ETAG_MEMORY_MAP.set(sourceUrl, {
      sourceStat,
      eTag
    });
  }
  return eTag;
};

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every(keyToCompare => {
    const leftValue = leftFileStat[keyToCompare];
    const rightValue = rightFileStat[keyToCompare];
    return leftValue === rightValue;
  });
};
const fileStatKeysToCompare = [
// mtime the the most likely to change, check it first
"mtimeMs", "size", "ctimeMs", "ino", "mode", "uid", "gid", "blksize"];
const getMtimeResponse = async ({
  headers,
  sourceStat
}) => {
  if ("if-modified-since" in headers) {
    let cachedModificationDate;
    try {
      cachedModificationDate = new Date(headers["if-modified-since"]);
    } catch (e) {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date"
      };
    }
    const actualModificationDate = dateToSecondsPrecision(sourceStat.mtime);
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304
      };
    }
  }
  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(sourceStat.mtime)
    }
  };
};
const getCompressedResponse = async ({
  sourceUrl,
  headers
}) => {
  const acceptedCompressionFormat = pickContentEncoding({
    headers
  }, Object.keys(availableCompressionFormats));
  if (!acceptedCompressionFormat) {
    return null;
  }
  const fileReadableStream = fileUrlToReadableStream(sourceUrl);
  const body = await availableCompressionFormats[acceptedCompressionFormat](fileReadableStream);
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding"
    },
    body
  };
};
const fileUrlToReadableStream = fileUrl => {
  return createReadStream(new URL(fileUrl), {
    emitClose: true,
    autoClose: true
  });
};
const availableCompressionFormats = {
  br: async fileReadableStream => {
    const {
      createBrotliCompress
    } = await import("node:zlib");
    return fileReadableStream.pipe(createBrotliCompress());
  },
  deflate: async fileReadableStream => {
    const {
      createDeflate
    } = await import("node:zlib");
    return fileReadableStream.pipe(createDeflate());
  },
  gzip: async fileReadableStream => {
    const {
      createGzip
    } = await import("node:zlib");
    return fileReadableStream.pipe(createGzip());
  }
};
const getRawResponse = async ({
  sourceUrl,
  sourceStat
}) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-length": sourceStat.size
    },
    body: fileUrlToReadableStream(sourceUrl)
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = date => date.toUTCString();
const dateToSecondsPrecision = date => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};
const asUrlString = value => {
  if (value instanceof URL) {
    return value.href;
  }
  if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      return fileSystemPathToUrl(value);
    }
    try {
      const urlObject = new URL(value);
      return String(urlObject);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const jsenvServiceErrorHandler = ({
  sendErrorDetails = false
} = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, {
      request
    }) => {
      const serverInternalErrorIsAPrimitive = serverInternalError === null || typeof serverInternalError !== "object" && typeof serverInternalError !== "function";
      if (!serverInternalErrorIsAPrimitive && serverInternalError.asResponse) {
        return serverInternalError.asResponse();
      }
      const dataToSend = serverInternalErrorIsAPrimitive ? {
        code: "VALUE_THROWED",
        value: serverInternalError
      } : {
        code: serverInternalError.code || "UNKNOWN_ERROR",
        ...(sendErrorDetails ? {
          stack: serverInternalError.stack,
          ...serverInternalError
        } : {})
      };
      const availableContentTypes = {
        "text/html": () => {
          const renderHtmlForErrorWithoutDetails = () => {
            return `<p>Details not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).</p>`;
          };
          const renderHtmlForErrorWithDetails = () => {
            if (serverInternalErrorIsAPrimitive) {
              return `<pre>${JSON.stringify(serverInternalError, null, "  ")}</pre>`;
            }
            return `<pre>${serverInternalError.stack}</pre>`;
          };
          const body = `<!DOCTYPE html>
<html>
  <head>
    <title>Internal server error</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Internal server error</h1>
    <p>${serverInternalErrorIsAPrimitive ? `Code inside server has thrown a literal.` : `Code inside server has thrown an error.`}</p>
    <details>
      <summary>See internal error details</summary>
      ${sendErrorDetails ? renderHtmlForErrorWithDetails() : renderHtmlForErrorWithoutDetails()}
    </details>
  </body>
</html>`;
          return {
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body)
            },
            body
          };
        },
        "application/json": () => {
          const body = JSON.stringify(dataToSend);
          return {
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body)
            },
            body
          };
        }
      };
      const bestContentType = pickContentType(request, Object.keys(availableContentTypes));
      return availableContentTypes[bestContentType || "application/json"]();
    }
  };
};

const jsenvAccessControlAllowedHeaders = ["x-requested-with"];
const jsenvAccessControlAllowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const jsenvServiceCORS = ({
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin = false
} = {}) => {
  // TODO: we should check access control params to throw or warn if we find strange values

  const corsEnabled = accessControlAllowRequestOrigin || accessControlAllowedOrigins.length;
  if (!corsEnabled) {
    return [];
  }
  return {
    name: "jsenv:cors",
    handleRequest: request => {
      // when request method is "OPTIONS" we must return a 200 without body
      // So we bypass "requestToResponse" in that scenario using shortcircuitResponse
      if (request.method === "OPTIONS") {
        return {
          status: 200,
          headers: {
            "content-length": 0
          }
        };
      }
      return null;
    },
    injectResponseHeaders: (response, {
      request
    }) => {
      const accessControlHeaders = generateAccessControlHeaders({
        request,
        accessControlAllowedOrigins,
        accessControlAllowRequestOrigin,
        accessControlAllowedMethods,
        accessControlAllowRequestMethod,
        accessControlAllowedHeaders,
        accessControlAllowRequestHeaders,
        accessControlAllowCredentials,
        accessControlMaxAge,
        timingAllowOrigin
      });
      return accessControlHeaders;
    }
  };
};

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: {
    headers
  },
  accessControlAllowedOrigins,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin
} = {}) => {
  const vary = [];
  const allowedOriginArray = [...accessControlAllowedOrigins];
  if (accessControlAllowRequestOrigin) {
    if ("origin" in headers && headers.origin !== "null") {
      allowedOriginArray.push(headers.origin);
      vary.push("origin");
    } else if ("referer" in headers) {
      allowedOriginArray.push(new URL(headers.referer).origin);
      vary.push("referer");
    } else {
      allowedOriginArray.push("*");
    }
  }
  const allowedMethodArray = [...accessControlAllowedMethods];
  if (accessControlAllowRequestMethod && "access-control-request-method" in headers) {
    const requestMethodName = headers["access-control-request-method"];
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }
  const allowedHeaderArray = [...accessControlAllowedHeaders];
  if (accessControlAllowRequestHeaders && "access-control-request-headers" in headers) {
    const requestHeaderNameArray = headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach(headerName => {
      const headerNameLowerCase = headerName.toLowerCase();
      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase);
        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers");
        }
      }
    });
  }
  return {
    "access-control-allow-origin": allowedOriginArray.join(", "),
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials ? {
      "access-control-allow-credentials": true
    } : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin ? {
      "timing-allow-origin": allowedOriginArray.join(", ")
    } : {}),
    ...(vary.length ? {
      vary: vary.join(", ")
    } : {})
  };
};

new Map();

const lookupPackageDirectory = currentUrl => {
  if (currentUrl === "file:///") {
    return null;
  }
  const packageJsonFileUrl = `${currentUrl}package.json`;
  if (existsSync(new URL(packageJsonFileUrl))) {
    return currentUrl;
  }
  return lookupPackageDirectory(getParentUrl$1(currentUrl));
};
const getParentUrl$1 = url => {
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
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
    }
    return `file://${resource.slice(0, slashLastIndex + 1)}`;
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};

const createServerEventsDispatcher = () => {
  const clients = [];
  const MAX_CLIENTS = 100;
  const addClient = client => {
    clients.push(client);
    if (clients.length >= MAX_CLIENTS) {
      const firstClient = clients.shift();
      firstClient.close();
    }
    const removeClient = () => {
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
      }
    };
    client.onclose = () => {
      removeClient();
    };
    return () => {
      client.close();
    };
  };
  return {
    addWebsocket: (websocket, request) => {
      const client = {
        request,
        getReadystate: () => {
          return websocket.readyState;
        },
        sendEvent: event => {
          websocket.send(JSON.stringify(event));
        },
        close: reason => {
          const closePromise = new Promise((resolve, reject) => {
            websocket.onclose = () => {
              websocket.onclose = null;
              websocket.onerror = null;
              resolve();
            };
            websocket.onerror = e => {
              websocket.onclose = null;
              websocket.onerror = null;
              reject(e);
            };
          });
          websocket.close(reason);
          return closePromise;
        },
        destroy: () => {
          websocket.terminate();
        }
      };
      client.sendEvent({
        type: "welcome"
      });
      websocket.onclose = () => {
        client.onclose();
      };
      client.onclose = () => {};
      return addClient(client);
    },
    // we could add "addEventSource" and let clients connect using
    // new WebSocket or new EventSource
    // in practice the new EventSource won't be used
    // so "serverEventsDispatcher.addEventSource" is not implemented
    // addEventSource: (request) => {},
    dispatch: event => {
      clients.forEach(client => {
        if (client.getReadystate() === 1) {
          client.sendEvent(event);
        }
      });
    },
    dispatchToClientsMatching: (event, predicate) => {
      clients.forEach(client => {
        if (client.getReadystate() === 1 && predicate(client)) {
          client.sendEvent(event);
        }
      });
    },
    close: async reason => {
      await Promise.all(clients.map(async client => {
        await client.close(reason);
      }));
    },
    destroy: () => {
      clients.forEach(client => {
        client.destroy();
      });
    }
  };
};

const watchSourceFiles = (sourceDirectoryUrl, callback, {
  sourceFileConfig = {},
  keepProcessAlive,
  cooldownBetweenFileEvents
}) => {
  // Project should use a dedicated directory (usually "src/")
  // passed to the dev server via "sourceDirectoryUrl" param
  // In that case all files inside the source directory should be watched
  // But some project might want to use their root directory as source directory
  // In that case source directory might contain files matching "node_modules/*" or ".git/*"
  // And jsenv should not consider these as source files and watch them (to not hurt performances)
  const watchPatterns = {
    "**/*": true,
    // by default watch everything inside the source directory
    // line below is commented until @jsenv/url-meta fixes the fact that is matches
    // any file with an extension
    "**/.*": false,
    // file starting with a dot -> do not watch
    "**/.*/": false,
    // directory starting with a dot -> do not watch
    "**/node_modules/": false,
    // node_modules directory -> do not watch
    ...sourceFileConfig
  };
  const stopWatchingSourceFiles = registerDirectoryLifecycle(sourceDirectoryUrl, {
    watchPatterns,
    cooldownBetweenFileEvents,
    keepProcessAlive,
    recursive: true,
    added: ({
      relativeUrl
    }) => {
      callback({
        url: new URL(relativeUrl, sourceDirectoryUrl).href,
        event: "added"
      });
    },
    updated: ({
      relativeUrl
    }) => {
      callback({
        url: new URL(relativeUrl, sourceDirectoryUrl).href,
        event: "modified"
      });
    },
    removed: ({
      relativeUrl
    }) => {
      callback({
        url: new URL(relativeUrl, sourceDirectoryUrl).href,
        event: "removed"
      });
    }
  });
  stopWatchingSourceFiles.watchPatterns = watchPatterns;
  return stopWatchingSourceFiles;
};

const urlSpecifierEncoding = {
  encode: reference => {
    const {
      generatedSpecifier
    } = reference;
    if (generatedSpecifier.then) {
      return generatedSpecifier.then(value => {
        reference.generatedSpecifier = value;
        return urlSpecifierEncoding.encode(reference);
      });
    }
    // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)
    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier();
    }
    const formatter = formatters[reference.type];
    const value = formatter ? formatter.encode(generatedSpecifier) : generatedSpecifier;
    if (reference.escape) {
      return reference.escape(value);
    }
    return value;
  },
  decode: reference => {
    const formatter = formatters[reference.type];
    return formatter ? formatter.decode(reference.generatedSpecifier) : reference.generatedSpecifier;
  }
};
const formatters = {
  "js_import": {
    encode: JSON.stringify,
    decode: JSON.parse
  },
  "js_url": {
    encode: JSON.stringify,
    decode: JSON.parse
  },
  "css_@import": {
    encode: JSON.stringify,
    decode: JSON.stringify
  },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
    encode: url => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url);
      // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls
      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
      return url;
    },
    decode: url => {
      const firstChar = url[0];
      const lastChar = url[url.length - 1];
      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1);
      }
      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1);
      }
      return url;
    }
  }
};

const createUrlGraph = ({
  name = "anonymous"
} = {}) => {
  const createUrlInfoCallbackRef = {
    current: () => {}
  };
  const prunedUrlInfosCallbackRef = {
    current: () => {}
  };
  const urlInfoMap = new Map();
  const getUrlInfo = url => urlInfoMap.get(url);
  const deleteUrlInfo = url => {
    const urlInfo = urlInfoMap.get(url);
    if (urlInfo) {
      urlInfoMap.delete(url);
      urlInfo.dependencies.forEach(dependencyUrl => {
        getUrlInfo(dependencyUrl).dependents.delete(url);
      });
      if (urlInfo.sourcemapReference) {
        deleteUrlInfo(urlInfo.sourcemapReference.url);
      }
    }
  };
  const reuseOrCreateUrlInfo = url => {
    const existingUrlInfo = getUrlInfo(url);
    if (existingUrlInfo) return existingUrlInfo;
    const urlInfo = createUrlInfo(url);
    urlInfoMap.set(url, urlInfo);
    createUrlInfoCallbackRef.current(urlInfo);
    return urlInfo;
  };
  const getParentIfInline = urlInfo => {
    return urlInfo.isInline ? getUrlInfo(urlInfo.inlineUrlSite.url) : urlInfo;
  };
  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl);
    if (!parentUrlInfo) {
      return null;
    }
    const seen = [];
    const search = urlInfo => {
      const firstReferenceFound = urlInfo.references.find(reference => {
        return urlSpecifierEncoding.decode(reference) === specifier;
      });
      if (firstReferenceFound) {
        return firstReferenceFound;
      }
      for (const dependencyUrl of parentUrlInfo.dependencies) {
        if (seen.includes(dependencyUrl)) {
          continue;
        }
        seen.push(dependencyUrl);
        const dependencyUrlInfo = getUrlInfo(dependencyUrl);
        if (dependencyUrlInfo.isInline) {
          const firstRef = search(dependencyUrlInfo);
          if (firstRef) {
            return firstRef;
          }
        }
      }
      return null;
    };
    return search(parentUrlInfo);
  };
  const findDependent = (urlInfo, visitor) => {
    const seen = [urlInfo.url];
    let found = null;
    const iterate = currentUrlInfo => {
      for (const dependentUrl of currentUrlInfo.dependents) {
        if (seen.includes(dependentUrl)) {
          continue;
        }
        if (found) {
          break;
        }
        seen.push(dependentUrl);
        const dependentUrlInfo = getUrlInfo(dependentUrl);
        if (visitor(dependentUrlInfo)) {
          found = dependentUrlInfo;
        }
        if (found) {
          break;
        }
        iterate(dependentUrlInfo);
      }
    };
    iterate(urlInfo);
    return found;
  };
  const updateReferences = (urlInfo, references) => {
    const setOfDependencyUrls = new Set();
    const setOfImplicitUrls = new Set();
    references.forEach(reference => {
      if (reference.isResourceHint) {
        // resource hint are a special kind of reference.
        // They are a sort of weak reference to an url.
        // We ignore them so that url referenced only by resource hints
        // have url.dependents.size === 0 and can be considered as not used
        // It means html won't consider url referenced solely
        // by <link> as dependency and it's fine
        return;
      }
      const dependencyUrl = reference.url;
      setOfDependencyUrls.add(dependencyUrl);
      // an implicit reference do not appear in the file but a non-explicited file have an impact on it
      // (package.json on import resolution for instance)
      // in that case:
      // - file depends on the implicit file (it must autoreload if package.json is modified)
      // - cache validity for the file depends on the implicit file (it must be re-cooked in package.json is modified)
      if (reference.isImplicit) {
        setOfImplicitUrls.add(dependencyUrl);
      }
    });
    setOfDependencyUrls.forEach(dependencyUrl => {
      urlInfo.dependencies.add(dependencyUrl);
      const dependencyUrlInfo = reuseOrCreateUrlInfo(dependencyUrl);
      dependencyUrlInfo.dependents.add(urlInfo.url);
    });
    setOfImplicitUrls.forEach(implicitUrl => {
      urlInfo.implicitUrls.add(implicitUrl);
      if (urlInfo.isInline) {
        const parentUrlInfo = getUrlInfo(urlInfo.inlineUrlSite.url);
        parentUrlInfo.implicitUrls.add(implicitUrl);
      }
    });
    const prunedUrlInfos = [];
    const pruneDependency = (urlInfo, urlToClean) => {
      urlInfo.dependencies.delete(urlToClean);
      const dependencyUrlInfo = getUrlInfo(urlToClean);
      if (!dependencyUrlInfo) {
        return;
      }
      dependencyUrlInfo.dependents.delete(urlInfo.url);
      if (dependencyUrlInfo.dependents.size === 0) {
        dependencyUrlInfo.dependencies.forEach(dependencyUrl => {
          pruneDependency(dependencyUrlInfo, dependencyUrl);
        });
        prunedUrlInfos.push(dependencyUrlInfo);
      }
    };
    urlInfo.dependencies.forEach(dependencyUrl => {
      if (!setOfDependencyUrls.has(dependencyUrl)) {
        pruneDependency(urlInfo, dependencyUrl);
      }
    });
    if (prunedUrlInfos.length) {
      prunedUrlInfos.forEach(prunedUrlInfo => {
        prunedUrlInfo.modifiedTimestamp = Date.now();
        if (prunedUrlInfo.isInline) {
          // should we always delete?
          deleteUrlInfo(prunedUrlInfo.url);
        }
      });
      prunedUrlInfosCallbackRef.current(prunedUrlInfos, urlInfo);
    }
    urlInfo.implicitUrls.forEach(implicitUrl => {
      if (!setOfDependencyUrls.has(implicitUrl)) {
        let implicitUrlComesFromInlineContent = false;
        for (const dependencyUrl of urlInfo.dependencies) {
          const dependencyUrlInfo = getUrlInfo(dependencyUrl);
          if (dependencyUrlInfo.isInline && dependencyUrlInfo.implicitUrls.has(implicitUrl)) {
            implicitUrlComesFromInlineContent = true;
            break;
          }
        }
        if (!implicitUrlComesFromInlineContent) {
          urlInfo.implicitUrls.delete(implicitUrl);
        }
        if (urlInfo.isInline) {
          const parentUrlInfo = getUrlInfo(urlInfo.inlineUrlSite.url);
          parentUrlInfo.implicitUrls.delete(implicitUrl);
        }
      }
    });
    urlInfo.references = references;
    return urlInfo;
  };
  const considerModified = (urlInfo, modifiedTimestamp = Date.now()) => {
    const seen = [];
    const iterate = urlInfo => {
      if (seen.includes(urlInfo.url)) {
        return;
      }
      seen.push(urlInfo.url);
      urlInfo.modifiedTimestamp = modifiedTimestamp;
      urlInfo.originalContentEtag = undefined;
      urlInfo.contentEtag = undefined;
      urlInfo.dependents.forEach(dependentUrl => {
        const dependentUrlInfo = getUrlInfo(dependentUrl);
        const {
          hotAcceptDependencies = []
        } = dependentUrlInfo.data;
        if (!hotAcceptDependencies.includes(urlInfo.url)) {
          iterate(dependentUrlInfo);
        }
      });
      urlInfo.dependencies.forEach(dependencyUrl => {
        const dependencyUrlInfo = getUrlInfo(dependencyUrl);
        if (dependencyUrlInfo.isInline) {
          iterate(dependencyUrlInfo);
        }
      });
    };
    iterate(urlInfo);
  };
  return {
    name,
    createUrlInfoCallbackRef,
    prunedUrlInfosCallbackRef,
    urlInfoMap,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    getParentIfInline,
    inferReference,
    updateReferences,
    considerModified,
    findDependent,
    toObject: () => {
      const data = {};
      urlInfoMap.forEach(urlInfo => {
        data[urlInfo.url] = urlInfo;
      });
      return data;
    },
    toJSON: rootDirectoryUrl => {
      const data = {};
      urlInfoMap.forEach(urlInfo => {
        const dependencyUrls = Array.from(urlInfo.dependencies);
        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl);
          data[relativeUrl] = dependencyUrls.map(dependencyUrl => urlToRelativeUrl(dependencyUrl, rootDirectoryUrl));
        }
      });
      return data;
    }
  };
};
const createUrlInfo = url => {
  const urlInfo = {
    error: null,
    modifiedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {},
    // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    implicitUrls: new Set(),
    type: undefined,
    // "html", "css", "js_classic", "js_module", "importmap", "sourcemap", "json", "webmanifest", ...
    subtype: undefined,
    // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    typeHint: undefined,
    subtypeHint: undefined,
    contentType: "",
    // "text/html", "text/css", "text/javascript", "application/json", ...
    url,
    originalUrl: undefined,
    filename: "",
    isEntryPoint: false,
    shouldHandle: undefined,
    originalContent: undefined,
    content: undefined,
    sourcemap: null,
    sourcemapReference: null,
    sourcemapIsWrong: false,
    generatedUrl: null,
    sourcemapGeneratedUrl: null,
    injected: false,
    isInline: false,
    inlineUrlSite: null,
    jsQuote: null,
    // maybe move to inlineUrlSite?

    timing: {},
    headers: {},
    debug: false
  };
  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};

const HOOK_NAMES = ["init", "serve",
// is called only during dev/tests
"resolveUrl", "redirectUrl", "fetchUrlContent", "transformUrlContent", "transformUrlSearchParams", "formatUrl", "finalizeUrlContent", "bundle",
// is called only during build
"optimizeUrlContent",
// is called only during build
"cooked", "augmentResponse",
// is called only during dev/tests
"destroy"];
const createPluginController = kitchenContext => {
  const plugins = [];
  // precompute a list of hooks per hookName for one major reason:
  // - When debugging, there is less iteration
  // also it should increase perf as there is less work to do
  const hookGroups = {};
  const addPlugin = (plugin, {
    position = "start"
  }) => {
    if (plugin === null || typeof plugin !== "object") {
      throw new TypeError(`plugin must be objects, got ${plugin}`);
    }
    if (!testAppliesDuring(plugin) || !initPlugin(plugin)) {
      if (plugin.destroy) {
        plugin.destroy();
      }
      return;
    }
    if (!plugin.name) {
      plugin.name = "anonymous";
    }
    plugins.push(plugin);
    Object.keys(plugin).forEach(key => {
      if (key === "name" || key === "appliesDuring" || key === "init" || key === "serverEvents") {
        return;
      }
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(`Unexpected "${key}" property on "${plugin.name}" plugin`);
      }
      const hookName = key;
      const hookValue = plugin[hookName];
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = []);
        const hook = {
          plugin,
          name: hookName,
          value: hookValue
        };
        if (position === "start") {
          group.push(hook);
        } else {
          group.unshift(hook);
        }
      }
    });
  };
  const testAppliesDuring = plugin => {
    const {
      appliesDuring
    } = plugin;
    if (appliesDuring === undefined) {
      // console.debug(`"appliesDuring" is undefined on ${pluginEntry.name}`)
      return true;
    }
    if (appliesDuring === "*") {
      return true;
    }
    if (typeof appliesDuring === "string") {
      if (appliesDuring !== "dev" && appliesDuring !== "build") {
        throw new TypeError(`"appliesDuring" must be "dev" or "build", got ${appliesDuring}`);
      }
      if (kitchenContext[appliesDuring]) {
        return true;
      }
      return false;
    }
    if (typeof appliesDuring === "object") {
      for (const key of Object.keys(appliesDuring)) {
        if (!appliesDuring[key] && kitchenContext[key]) {
          return false;
        }
        if (appliesDuring[key] && kitchenContext[key]) {
          return true;
        }
      }
      // throw new Error(`"appliesDuring" is empty`)
      return false;
    }
    throw new TypeError(`"appliesDuring" must be an object or a string, got ${appliesDuring}`);
  };
  const initPlugin = plugin => {
    if (plugin.init) {
      const initReturnValue = plugin.init(kitchenContext);
      if (initReturnValue === false) {
        return false;
      }
      if (typeof initReturnValue === "function" && !plugin.destroy) {
        plugin.destroy = initReturnValue;
      }
    }
    return true;
  };
  const pushPlugin = plugin => {
    addPlugin(plugin, {
      position: "start"
    });
  };
  const unshiftPlugin = plugin => {
    addPlugin(plugin, {
      position: "end"
    });
  };
  let lastPluginUsed = null;
  let currentPlugin = null;
  let currentHookName = null;
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance$1.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = hookFn(info, context);
    currentPlugin = null;
    currentHookName = null;
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] = performance$1.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook.name, valueReturned);
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance$1.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = await hookFn(info, context);
    currentPlugin = null;
    currentHookName = null;
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] = performance$1.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook.name, valueReturned);
    return valueReturned;
  };
  const callHooks = (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context);
        if (returnValue && callback) {
          callback(returnValue, hook.plugin);
        }
      }
    }
  };
  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      await hooks.reduce(async (previous, hook) => {
        await previous;
        const returnValue = await callAsyncHook(hook, info, context);
        if (returnValue && callback) {
          await callback(returnValue, hook.plugin);
        }
      }, Promise.resolve());
    }
  };
  const callHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context);
        if (returnValue) {
          return returnValue;
        }
      }
    }
    return null;
  };
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName];
    if (!hooks) {
      return null;
    }
    if (hooks.length === 0) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const visit = index => {
        if (index >= hooks.length) {
          return resolve();
        }
        const hook = hooks[index];
        const returnValue = callAsyncHook(hook, info, context);
        return Promise.resolve(returnValue).then(output => {
          if (output) {
            return resolve(output);
          }
          return visit(index + 1);
        }, reject);
      };
      visit(0);
    });
  };
  return {
    plugins,
    pushPlugin,
    unshiftPlugin,
    getHookFunction,
    callHook,
    callAsyncHook,
    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,
    getLastPluginUsed: () => lastPluginUsed,
    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName
  };
};
const getHookFunction = (hook,
// can be undefined, reference, or urlInfo
info = {}) => {
  const hookValue = hook.value;
  if (typeof hookValue === "object") {
    const hookForType = hookValue[info.type] || hookValue["*"];
    if (!hookForType) {
      return null;
    }
    return hookForType;
  }
  return hookValue;
};
const assertAndNormalizeReturnValue = (hookName, returnValue) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue;
  }
  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hookName)) {
      continue;
    }
    const assertionResult = returnValueAssertion.assertion(returnValue);
    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult;
      break;
    }
  }
  return returnValue;
};
const returnValueAssertions = [{
  name: "url_assertion",
  appliesTo: ["resolveUrl", "redirectUrl"],
  assertion: valueReturned => {
    if (valueReturned instanceof URL) {
      return valueReturned.href;
    }
    if (typeof valueReturned === "string") {
      return undefined;
    }
    throw new Error(`Unexpected value returned by plugin: it must be a string; got ${valueReturned}`);
  }
}, {
  name: "content_assertion",
  appliesTo: ["fetchUrlContent", "transformUrlContent", "finalizeUrlContent", "optimizeUrlContent"],
  assertion: valueReturned => {
    if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
      return {
        content: valueReturned
      };
    }
    if (typeof valueReturned === "object") {
      const {
        shouldHandle,
        content,
        body
      } = valueReturned;
      if (shouldHandle === false) {
        return undefined;
      }
      if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
        throw new Error(`Unexpected "content" returned by plugin: it must be a string or a buffer; got ${content}`);
      }
      return undefined;
    }
    throw new Error(`Unexpected value returned by plugin: it must be a string, a buffer or an object; got ${valueReturned}`);
  }
}];

const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  urlGraph,
  injectSourcemapPlaceholder,
  foundSourcemap
}) => {
  if (sourcemapsSourcesProtocol === undefined) {
    sourcemapsSourcesProtocol = "file:///";
  }
  if (sourcemapsSourcesContent === undefined) {
    sourcemapsSourcesContent = true;
  }
  const sourcemapsEnabled = sourcemaps === "inline" || sourcemaps === "file" || sourcemaps === "programmatic";
  const normalizeSourcemap = (urlInfo, sourcemap) => {
    let {
      sources
    } = sourcemap;
    if (sources) {
      sources = sources.map(source => {
        if (source && isFileSystemPath$1(source)) {
          return String(pathToFileURL(source));
        }
        return source;
      });
    }
    const wantSourcesContent =
    // for inline content (<script> insdide html)
    // chrome won't be able to fetch the file as it does not exists
    // so sourcemap must contain sources
    sourcemapsSourcesContent || urlInfo.isInline || sources && sources.some(source => !source || !source.startsWith("file:"));
    if (sources && sources.length > 1) {
      sourcemap.sources = sources.map(source => new URL(source, urlInfo.originalUrl).href);
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined;
      }
      return sourcemap;
    }
    sourcemap.sources = [urlInfo.originalUrl];
    sourcemap.sourcesContent = [urlInfo.originalContent];
    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined;
    }
    return sourcemap;
  };
  const initTransformations = async (urlInfo, context) => {
    urlInfo.originalContentEtag = urlInfo.originalContentEtag || bufferToEtag$1(Buffer.from(urlInfo.originalContent));
    if (!sourcemapsEnabled) {
      return;
    }
    if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
      return;
    }
    if (urlInfo.generatedUrl.startsWith("data:")) {
      return;
    }
    // sourcemap is a special kind of reference:
    // It's a reference to a content generated dynamically the content itself.
    // For this reason sourcemap are not added to urlInfo.references
    // Instead they are stored into urlInfo.sourcemapReference
    // create a placeholder reference for the sourcemap that will be generated
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    const generatedUrlObject = new URL(urlInfo.generatedUrl);
    generatedUrlObject.searchParams.delete("js_module_fallback");
    generatedUrlObject.searchParams.delete("as_js_module");
    generatedUrlObject.searchParams.delete("as_js_classic");
    const urlForSourcemap = generatedUrlObject.href;
    urlInfo.sourcemapGeneratedUrl = generateSourcemapFileUrl(urlForSourcemap);

    // already loaded during "load" hook (happens during build)
    if (urlInfo.sourcemap) {
      const [sourcemapReference, sourcemapUrlInfo] = injectSourcemapPlaceholder({
        urlInfo,
        specifier: urlInfo.sourcemapGeneratedUrl
      });
      sourcemapUrlInfo.isInline = sourcemaps === "inline";
      urlInfo.sourcemapReference = sourcemapReference;
      urlInfo.sourcemap = normalizeSourcemap(urlInfo, urlInfo.sourcemap);
      return;
    }

    // check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content
    });
    if (sourcemapFound) {
      const {
        type,
        line,
        column,
        specifier
      } = sourcemapFound;
      const [sourcemapReference, sourcemapUrlInfo] = foundSourcemap({
        urlInfo,
        type,
        specifier,
        specifierLine: line,
        specifierColumn: column
      });
      try {
        await context.cook(sourcemapUrlInfo, {
          reference: sourcemapReference
        });
        const sourcemapRaw = JSON.parse(sourcemapUrlInfo.content);
        const sourcemap = normalizeSourcemap(urlInfo, sourcemapRaw);
        urlInfo.sourcemap = sourcemap;
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    } else {
      const [, sourcemapUrlInfo] = injectSourcemapPlaceholder({
        urlInfo,
        specifier: urlInfo.sourcemapGeneratedUrl
      });
      sourcemapUrlInfo.isInline = sourcemaps === "inline";
    }
  };
  const applyIntermediateTransformations = (urlInfo, transformations) => {
    if (!transformations) {
      return;
    }
    const {
      type,
      contentType,
      content,
      sourcemap,
      sourcemapIsWrong
    } = transformations;
    if (type) {
      urlInfo.type = type;
    }
    if (contentType) {
      urlInfo.contentType = contentType;
    }
    if (content) {
      urlInfo.content = content;
    }
    if (sourcemapsEnabled && sourcemap) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      const finalSourcemap = composeTwoSourcemaps(urlInfo.sourcemap, sourcemapNormalized);
      const finalSourcemapNormalized = normalizeSourcemap(urlInfo, finalSourcemap);
      urlInfo.sourcemap = finalSourcemapNormalized;
      // A plugin is allowed to modify url content
      // without returning a sourcemap
      // This is the case for preact and react plugins.
      // They are currently generating wrong source mappings
      // when used.
      // Generating the correct sourcemap in this situation
      // is a nightmare no-one could solve in years so
      // jsenv won't emit a warning and use the following strategy:
      // "no sourcemap is better than wrong sourcemap"
      urlInfo.sourcemapIsWrong = urlInfo.sourcemapIsWrong || sourcemapIsWrong;
    }
  };
  const applyFinalTransformations = (urlInfo, transformations) => {
    if (transformations) {
      applyIntermediateTransformations(urlInfo, transformations);
    }
    if (urlInfo.sourcemapReference) {
      if (sourcemapsEnabled && urlInfo.sourcemap && !urlInfo.generatedUrl.startsWith("data:")) {
        // during build this function can be called after the file is cooked
        // - to update content and sourcemap after "optimize" hook
        // - to inject versioning into the entry point content
        // in this scenarion we don't want to call injectSourcemap
        // just update the content and the
        const sourcemapReference = urlInfo.sourcemapReference;
        const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url);
        sourcemapUrlInfo.contentType = "application/json";
        const sourcemap = urlInfo.sourcemap;
        if (sourcemapsSourcesRelative) {
          sourcemap.sources = sourcemap.sources.map(source => {
            const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
            return sourceRelative || ".";
          });
        }
        if (sourcemapsSourcesProtocol !== "file:///") {
          sourcemap.sources = sourcemap.sources.map(source => {
            if (source.startsWith("file:///")) {
              return `${sourcemapsSourcesProtocol}${source.slice("file:///".length)}`;
            }
            return source;
          });
        }
        sourcemapUrlInfo.content = JSON.stringify(sourcemap, null, "  ");
        if (!urlInfo.sourcemapIsWrong) {
          if (sourcemaps === "inline") {
            sourcemapReference.generatedSpecifier = generateSourcemapDataUrl(sourcemap);
          }
          if (sourcemaps === "file" || sourcemaps === "inline") {
            urlInfo.content = SOURCEMAP.writeComment({
              contentType: urlInfo.contentType,
              content: urlInfo.content,
              specifier: sourcemaps === "file" && sourcemapsSourcesRelative ? urlToRelativeUrl(sourcemapReference.url, urlInfo.url) : sourcemapReference.generatedSpecifier
            });
          }
        }
      } else {
        // in the end we don't use the sourcemap placeholder
        urlGraph.deleteUrlInfo(urlInfo.sourcemapReference.url);
      }
    }
    urlInfo.contentEtag = urlInfo.content === urlInfo.originalContent ? urlInfo.originalContentEtag : bufferToEtag$1(Buffer.from(urlInfo.content));
  };
  return {
    initTransformations,
    applyIntermediateTransformations,
    applyFinalTransformations
  };
};

const versionFromValue = value => {
  if (typeof value === "number") {
    return numberToVersion(value);
  }
  if (typeof value === "string") {
    return stringToVersion(value);
  }
  throw new TypeError(`version must be a number or a string, got ${value}`);
};
const numberToVersion = number => {
  return {
    major: number,
    minor: 0,
    patch: 0
  };
};
const stringToVersion = string => {
  if (string.indexOf(".") > -1) {
    const parts = string.split(".");
    return {
      major: Number(parts[0]),
      minor: parts[1] ? Number(parts[1]) : 0,
      patch: parts[2] ? Number(parts[2]) : 0
    };
  }
  if (isNaN(string)) {
    return {
      major: 0,
      minor: 0,
      patch: 0
    };
  }
  return {
    major: Number(string),
    minor: 0,
    patch: 0
  };
};

const compareTwoVersions = (versionA, versionB) => {
  const semanticVersionA = versionFromValue(versionA);
  const semanticVersionB = versionFromValue(versionB);
  const majorDiff = semanticVersionA.major - semanticVersionB.major;
  if (majorDiff > 0) {
    return majorDiff;
  }
  if (majorDiff < 0) {
    return majorDiff;
  }
  const minorDiff = semanticVersionA.minor - semanticVersionB.minor;
  if (minorDiff > 0) {
    return minorDiff;
  }
  if (minorDiff < 0) {
    return minorDiff;
  }
  const patchDiff = semanticVersionA.patch - semanticVersionB.patch;
  if (patchDiff > 0) {
    return patchDiff;
  }
  if (patchDiff < 0) {
    return patchDiff;
  }
  return 0;
};

const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return compareTwoVersions(versionSupposedBelow, versionSupposedAbove) < 0;
};

const findHighestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`);
  return values.reduce((highestVersion, value) => {
    if (versionIsBelow(highestVersion, value)) {
      return value;
    }
    return highestVersion;
  });
};

const featuresCompatMap = {
  script_type_module: {
    edge: "16",
    firefox: "60",
    chrome: "61",
    safari: "10.1",
    opera: "48",
    ios: "10.3",
    android: "61",
    samsung: "8.2"
  },
  document_current_script: {
    edge: "12",
    firefox: "4",
    chrome: "29",
    safari: "8",
    opera: "16",
    android: "4.4",
    samsung: "4"
  },
  // https://caniuse.com/?search=import.meta
  import_meta: {
    android: "9",
    chrome: "64",
    edge: "79",
    firefox: "62",
    ios: "12",
    opera: "51",
    safari: "11.1",
    samsung: "9.2"
  },
  import_meta_resolve: {
    chrome: "107",
    edge: "105",
    firefox: "106"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#browser_compatibility
  import_dynamic: {
    android: "8",
    chrome: "63",
    edge: "79",
    firefox: "67",
    ios: "11.3",
    opera: "50",
    safari: "11.3",
    samsung: "8.0",
    node: "13.2"
  },
  top_level_await: {
    edge: "89",
    chrome: "89",
    firefox: "89",
    opera: "75",
    safari: "15",
    samsung: "15",
    ios: "15",
    node: "14.8"
  },
  // https://caniuse.com/import-maps
  importmap: {
    edge: "89",
    chrome: "89",
    opera: "76",
    samsung: "15",
    firefox: "108",
    safari: "16.4"
  },
  import_type_json: {
    chrome: "91",
    edge: "91"
  },
  import_type_css: {
    chrome: "93",
    edge: "93"
  },
  import_type_text: {},
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet#browser_compatibility
  new_stylesheet: {
    chrome: "73",
    edge: "79",
    opera: "53",
    android: "73"
  },
  // https://caniuse.com/?search=worker
  worker: {
    ie: "10",
    edge: "12",
    firefox: "3.5",
    chrome: "4",
    opera: "11.5",
    safari: "4",
    ios: "5",
    android: "4.4"
  },
  // https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#browser_compatibility
  worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80"
  },
  worker_importmap: {},
  service_worker: {
    edge: "17",
    firefox: "44",
    chrome: "40",
    safari: "11.1",
    opera: "27",
    ios: "11.3",
    android: "12.12"
  },
  service_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80"
  },
  shared_worker: {
    chrome: "4",
    edge: "79",
    firefox: "29",
    opera: "10.6"
  },
  shared_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis#browser_compatibility
  global_this: {
    edge: "79",
    firefox: "65",
    chrome: "71",
    safari: "12.1",
    opera: "58",
    ios: "12.2",
    android: "94",
    node: "12"
  },
  async_generator_function: {
    chrome: "63",
    opera: "50",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    electron: "3"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#browser_compatibility
  template_literals: {
    chrome: "41",
    edge: "12",
    firefox: "34",
    opera: "28",
    safari: "9",
    ios: "9",
    android: "4",
    node: "4"
  },
  arrow_function: {
    chrome: "47",
    opera: "34",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  const_bindings: {
    chrome: "41",
    opera: "28",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    electron: "0.22"
  },
  object_properties_shorthand: {
    chrome: "43",
    opera: "30",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.28"
  },
  reserved_words: {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  },
  symbols: {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    ios: "9",
    samsung: "4",
    node: "0.12"
  }
};

const RUNTIME_COMPAT = {
  featuresCompatMap,
  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeCompat = {
      ...originalRuntimeCompat
    };
    Object.keys(originalRuntimeCompat).forEach(runtimeName => {
      const secondVersion = featureCompat[runtimeName]; // the version supported by the feature
      if (secondVersion) {
        const firstVersion = originalRuntimeCompat[runtimeName];
        runtimeCompat[runtimeName] = findHighestVersion(firstVersion, secondVersion);
      }
    });
    return runtimeCompat;
  },
  isSupported: (runtimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeNames = Object.keys(runtimeCompat);
    const runtimeWithoutCompat = runtimeNames.find(runtimeName => {
      const runtimeVersion = runtimeCompat[runtimeName];
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity";
      const highestVersion = findHighestVersion(runtimeVersion, runtimeVersionCompatible);
      return highestVersion !== runtimeVersion;
    });
    return !runtimeWithoutCompat;
  }
};
const getFeatureCompat = feature => {
  if (typeof feature === "string") {
    const compat = featuresCompatMap[feature];
    if (!compat) {
      throw new Error(`"${feature}" feature is unknown`);
    }
    return compat;
  }
  if (typeof feature !== "object") {
    throw new TypeError(`feature must be a string or an object, got ${feature}`);
  }
  return feature;
};

const createResolveUrlError = ({
  pluginController,
  reference,
  error
}) => {
  const createFailedToResolveUrlError = ({
    code = error.code || "RESOLVE_URL_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(createDetailedMessage$1(`Failed to resolve url reference`, {
      reason,
      ...details,
      "specifier": `"${reference.specifier}"`,
      "specifier trace": reference.trace.message,
      ...detailsFromPluginController(pluginController)
    }));
    resolveError.name = "RESOLVE_URL_ERROR";
    resolveError.code = code;
    resolveError.reason = reason;
    resolveError.asResponse = error.asResponse;
    return resolveError;
  };
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    error.message = createDetailedMessage$1(error.message, {
      "reference trace": reference.trace.message
    });
    return error;
  }
  return createFailedToResolveUrlError({
    reason: `An error occured during specifier resolution`,
    ...detailsFromValueThrown(error)
  });
};
const createFetchUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  const createFailedToFetchUrlContentError = ({
    code = error.code || "FETCH_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const fetchError = new Error(createDetailedMessage$1(`Failed to fetch url content`, {
      reason,
      ...details,
      "url": urlInfo.url,
      "url reference trace": reference.trace.message,
      ...detailsFromPluginController(pluginController)
    }));
    fetchError.name = "FETCH_URL_CONTENT_ERROR";
    fetchError.code = code;
    fetchError.reason = reason;
    fetchError.url = urlInfo.url;
    if (code === "PARSE_ERROR") {
      fetchError.traceUrl = error.traceUrl;
      fetchError.traceLine = error.traceLine;
      fetchError.traceColumn = error.traceColumn;
      fetchError.traceMessage = error.traceMessage;
    } else {
      fetchError.traceUrl = reference.trace.url;
      fetchError.traceLine = reference.trace.line;
      fetchError.traceColumn = reference.trace.column;
      fetchError.traceMessage = reference.trace.message;
    }
    fetchError.asResponse = error.asResponse;
    return fetchError;
  };
  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return createFailedToFetchUrlContentError({
      code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
      reason: `found a directory on filesystem`
    });
  }
  if (error.code === "ENOENT") {
    return createFailedToFetchUrlContentError({
      code: "NOT_FOUND",
      reason: "no entry on filesystem"
    });
  }
  if (error.code === "PARSE_ERROR") {
    return createFailedToFetchUrlContentError({
      "code": "PARSE_ERROR",
      "reason": error.reason,
      "parse error message": error.cause.message,
      "parse error trace": error.traceMessage
    });
  }
  return createFailedToFetchUrlContentError({
    reason: `An error occured during "fetchUrlContent"`,
    ...detailsFromValueThrown(error)
  });
};
const createTransformUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return error;
  }
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const transformError = new Error(createDetailedMessage$1(`"transformUrlContent" error on "${urlInfo.type}"`, {
      reason,
      ...details,
      "url": urlInfo.url,
      "url reference trace": reference.trace.message,
      ...detailsFromPluginController(pluginController)
    }));
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR";
    transformError.code = code;
    transformError.reason = reason;
    transformError.stack = error.stack;
    transformError.url = urlInfo.url;
    transformError.traceUrl = reference.trace.url;
    transformError.traceLine = reference.trace.line;
    transformError.traceColumn = reference.trace.column;
    transformError.traceMessage = reference.trace.message;
    if (code === "PARSE_ERROR") {
      transformError.reason = `parse error on ${urlInfo.type}`;
      transformError.cause = error;
      if (urlInfo.isInline) {
        transformError.traceLine = reference.trace.line + error.line - 1;
        transformError.traceColumn = reference.trace.column + error.column;
        transformError.traceMessage = stringifyUrlSite({
          url: urlInfo.inlineUrlSite.url,
          line: transformError.traceLine,
          column: transformError.traceColumn,
          content: urlInfo.inlineUrlSite.content
        });
      } else {
        transformError.traceLine = error.line;
        transformError.traceColumn = error.column;
        transformError.traceMessage = stringifyUrlSite({
          url: urlInfo.url,
          line: error.line - 1,
          column: error.column,
          content: urlInfo.content
        });
      }
    }
    transformError.asResponse = error.asResponse;
    return transformError;
  };
  return createFailedToTransformError({
    reason: `"transformUrlContent" error on "${urlInfo.type}"`,
    ...detailsFromValueThrown(error)
  });
};
const createFinalizeUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  const finalizeError = new Error(createDetailedMessage$1(`"finalizeUrlContent" error on "${urlInfo.type}"`, {
    ...detailsFromValueThrown(error),
    "url": urlInfo.url,
    "url reference trace": reference.trace.message,
    ...detailsFromPluginController(pluginController)
  }));
  if (error && error instanceof Error) {
    finalizeError.cause = error;
  }
  finalizeError.name = "FINALIZE_URL_CONTENT_ERROR";
  finalizeError.reason = `"finalizeUrlContent" error on "${urlInfo.type}"`;
  finalizeError.asResponse = error.asResponse;
  return finalizeError;
};
const detailsFromPluginController = pluginController => {
  const currentPlugin = pluginController.getCurrentPlugin();
  if (!currentPlugin) {
    return null;
  }
  return {
    "plugin name": `"${currentPlugin.name}"`
  };
};
const detailsFromValueThrown = valueThrownByPlugin => {
  if (valueThrownByPlugin && valueThrownByPlugin instanceof Error) {
    return {
      "error stack": valueThrownByPlugin.stack
    };
  }
  if (valueThrownByPlugin === undefined) {
    return {
      error: "undefined"
    };
  }
  return {
    error: JSON.stringify(valueThrownByPlugin)
  };
};

const isSupportedAlgorithm = algo => {
  return SUPPORTED_ALGORITHMS.includes(algo);
};

// https://www.w3.org/TR/SRI/#priority
const getPrioritizedHashFunction = (firstAlgo, secondAlgo) => {
  const firstIndex = SUPPORTED_ALGORITHMS.indexOf(firstAlgo);
  const secondIndex = SUPPORTED_ALGORITHMS.indexOf(secondAlgo);
  if (firstIndex === secondIndex) {
    return "";
  }
  if (firstIndex < secondIndex) {
    return secondAlgo;
  }
  return firstAlgo;
};
const applyAlgoToRepresentationData = (algo, data) => {
  const base64Value = crypto.createHash(algo).update(data).digest("base64");
  return base64Value;
};

// keep this ordered by collision resistance as it is also used by "getPrioritizedHashFunction"
const SUPPORTED_ALGORITHMS = ["sha256", "sha384", "sha512"];

// see https://w3c.github.io/webappsec-subresource-integrity/#parse-metadata
const parseIntegrity = string => {
  const integrityMetadata = {};
  string.trim().split(/\s+/).forEach(token => {
    const {
      isValid,
      algo,
      base64Value,
      optionExpression
    } = parseAsHashWithOptions(token);
    if (!isValid) {
      return;
    }
    if (!isSupportedAlgorithm(algo)) {
      return;
    }
    const metadataList = integrityMetadata[algo];
    const metadata = {
      base64Value,
      optionExpression
    };
    integrityMetadata[algo] = metadataList ? [...metadataList, metadata] : [metadata];
  });
  return integrityMetadata;
};

// see https://w3c.github.io/webappsec-subresource-integrity/#the-integrity-attribute
const parseAsHashWithOptions = token => {
  const dashIndex = token.indexOf("-");
  if (dashIndex === -1) {
    return {
      isValid: false
    };
  }
  const beforeDash = token.slice(0, dashIndex);
  const afterDash = token.slice(dashIndex + 1);
  const questionIndex = afterDash.indexOf("?");
  const algo = beforeDash;
  if (questionIndex === -1) {
    const base64Value = afterDash;
    const isValid = BASE64_REGEX.test(afterDash);
    return {
      isValid,
      algo,
      base64Value
    };
  }
  const base64Value = afterDash.slice(0, questionIndex);
  const optionExpression = afterDash.slice(questionIndex + 1);
  const isValid = BASE64_REGEX.test(afterDash) && VCHAR_REGEX.test(optionExpression);
  return {
    isValid,
    algo,
    base64Value,
    optionExpression
  };
};
const BASE64_REGEX = /^[A-Za-z0-9+\/=+]+$/;
const VCHAR_REGEX = /^[\x21-\x7E]+$/;

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
const validateResponseIntegrity = ({
  url,
  type,
  dataRepresentation
}, integrity) => {
  if (!isResponseEligibleForIntegrityValidation({
    type
  })) {
    return false;
  }
  const integrityMetadata = parseIntegrity(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return true;
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach(algoCandidate => {
    strongestAlgo = getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const metadataList = integrityMetadata[strongestAlgo];
  const actualBase64Value = applyAlgoToRepresentationData(strongestAlgo, dataRepresentation);
  const acceptedBase64Values = metadataList.map(metadata => metadata.base64Value);
  const someIsMatching = acceptedBase64Values.includes(actualBase64Value);
  if (someIsMatching) {
    return true;
  }
  const error = new Error(`Integrity validation failed for resource "${url}". The integrity found for this resource is "${strongestAlgo}-${actualBase64Value}"`);
  error.code = "EINTEGRITY";
  error.algorithm = strongestAlgo;
  error.found = actualBase64Value;
  throw error;
};

// https://www.w3.org/TR/SRI/#is-response-eligible-for-integrity-validation
const isResponseEligibleForIntegrityValidation = response => {
  return ["basic", "cors", "default"].includes(response.type);
};

const assertFetchedContentCompliance = ({
  reference,
  urlInfo
}) => {
  const {
    expectedContentType
  } = reference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(`Unexpected content-type on url: "${expectedContentType}" was expected but got "${urlInfo.contentType}`);
  }
  const {
    expectedType
  } = reference;
  if (expectedType && urlInfo.type !== expectedType) {
    throw new Error(`Unexpected type on url: "${expectedType}" was expected but got "${urlInfo.type}"`);
  }
  const {
    integrity
  } = reference;
  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: urlInfo.content
    });
  }
};

// the following apis are creating js entry points:
// - new Worker()
// - new SharedWorker()
// - navigator.serviceWorker.register()
const isWebWorkerEntryPointReference = reference => {
  if (reference.subtype === "new_url_first_arg") {
    return ["worker", "service_worker", "shared_worker"].includes(reference.expectedSubtype);
  }
  return ["new_worker_first_arg", "new_shared_worker_first_arg", "service_worker_register_first_arg"].includes(reference.subtype);
};
const isWebWorkerUrlInfo = urlInfo => {
  return urlInfo.subtype === "worker" || urlInfo.subtype === "service_worker" || urlInfo.subtype === "shared_worker";
};

// export const isEntryPoint = (urlInfo, urlGraph) => {
//   if (urlInfo.data.isEntryPoint) {
//     return true
//   }
//   if (isWebWorker(urlInfo)) {
//     // - new Worker("a.js") -> "a.js" is an entry point
//     // - self.importScripts("b.js") -> "b.js" is not an entry point
//     // So the following logic applies to infer if the file is a web worker entry point
//     // "When a non-webworker file references a worker file, the worker file is an entry point"
//     const dependents = Array.from(urlInfo.dependents)
//     return dependents.some((dependentUrl) => {
//       const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl)
//       return !isWebWorker(dependentUrlInfo)
//     })
//   }
//   return false
// }

const createKitchen = ({
  signal,
  logLevel,
  rootDirectoryUrl,
  mainFilePath,
  urlGraph,
  dev = false,
  build = false,
  runtimeCompat,
  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  systemJsTranspilation,
  plugins,
  minification,
  sourcemaps = dev ? "inline" : "none",
  // "programmatic" and "file" also allowed
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  outDirectoryUrl
}) => {
  const logger = createLogger({
    logLevel
  });
  const kitchenContext = {
    signal,
    logger,
    rootDirectoryUrl,
    mainFilePath,
    urlGraph,
    dev,
    build,
    runtimeCompat,
    clientRuntimeCompat,
    systemJsTranspilation,
    isSupportedOnCurrentClients: feature => {
      return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature);
    },
    isSupportedOnFutureClients: feature => {
      return RUNTIME_COMPAT.isSupported(runtimeCompat, feature);
    },
    minification,
    sourcemaps,
    outDirectoryUrl
  };
  const pluginController = createPluginController(kitchenContext);
  const pushPlugins = plugins => {
    plugins.forEach(pluginEntry => {
      if (Array.isArray(pluginEntry)) {
        pushPlugins(pluginEntry);
      } else {
        pluginController.pushPlugin(pluginEntry);
      }
    });
  };
  pushPlugins(plugins);

  /*
   *  * - "http_request"
   * - "entry_point"
   * - "link_href"
   * - "style"
   * - "script"
   * - "a_href"
   * - "iframe_src
   * - "img_src"
   * - "img_srcset"
   * - "source_src"
   * - "source_srcset"
   * - "image_href"
   * - "use_href"
   * - "css_@import"
   * - "css_url"
   * - "js_import"
   * - "js_import_script"
   * - "js_url"
   * - "js_inline_content"
   * - "sourcemap_comment"
   * - "webmanifest_icon_src"
   * - "package_json"
   * */
  const createReference = ({
    data = {},
    node,
    trace,
    parentUrl,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filename,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    baseUrl,
    isOriginalPosition,
    shouldHandle,
    isEntryPoint = false,
    isResourceHint = false,
    isImplicit = false,
    hasVersioningEffect = false,
    injected = false,
    isInline = false,
    content,
    contentType,
    assert,
    assertNode,
    typePropertyNode,
    leadsToADirectory = false,
    debug = false
  }) => {
    if (typeof specifier !== "string") {
      if (specifier instanceof URL) {
        specifier = specifier.href;
      } else {
        throw new TypeError(`"specifier" must be a string, got ${specifier}`);
      }
    }
    const reference = {
      original: null,
      prev: null,
      next: null,
      data,
      node,
      trace,
      parentUrl,
      url: null,
      searchParams: null,
      generatedUrl: null,
      generatedSpecifier: null,
      type,
      subtype,
      expectedContentType,
      expectedType,
      expectedSubtype,
      filename,
      integrity,
      crossorigin,
      specifier,
      specifierStart,
      specifierEnd,
      specifierLine,
      specifierColumn,
      isOriginalPosition,
      baseUrl,
      shouldHandle,
      isEntryPoint,
      isResourceHint,
      isImplicit,
      hasVersioningEffect,
      version: null,
      injected,
      timing: {},
      // for inline resources the reference contains the content
      isInline,
      content,
      contentType,
      escape: null,
      // import assertions (maybe move to data?)
      assert,
      assertNode,
      typePropertyNode,
      leadsToADirectory,
      mutation: null,
      debug
    };
    // Object.preventExtensions(reference) // useful to ensure all properties are declared here
    return reference;
  };
  const updateReference = (reference, newReference) => {
    reference.next = newReference;
    newReference.original = reference.original || reference;
    newReference.prev = reference;
  };
  const resolveReference = (reference, context = kitchenContext) => {
    const referenceContext = {
      ...context,
      resolveReference: (reference, context = referenceContext) => resolveReference(reference, context)
    };
    try {
      let resolvedUrl = pluginController.callHooksUntil("resolveUrl", reference, referenceContext);
      if (!resolvedUrl) {
        throw new Error(`NO_RESOLVE`);
      }
      if (resolvedUrl.includes("?debug")) {
        reference.debug = true;
      }
      resolvedUrl = normalizeUrl(resolvedUrl);
      let referencedUrlObject;
      let searchParams;
      const onReferenceUrlChange = referenceUrl => {
        referencedUrlObject = new URL(referenceUrl);
        searchParams = referencedUrlObject.searchParams;
        reference.url = referenceUrl;
        reference.searchParams = searchParams;
      };
      onReferenceUrlChange(resolvedUrl);
      if (reference.debug) {
        logger.debug(`url resolved by "${pluginController.getLastPluginUsed().name}"
${ANSI.color(reference.specifier, ANSI.GREY)} ->
${ANSI.color(reference.url, ANSI.YELLOW)}
`);
      }
      pluginController.callHooks("redirectUrl", reference, referenceContext, (returnValue, plugin) => {
        const normalizedReturnValue = normalizeUrl(returnValue);
        if (normalizedReturnValue === reference.url) {
          return;
        }
        if (reference.debug) {
          logger.debug(`url redirected by "${plugin.name}"
${ANSI.color(reference.url, ANSI.GREY)} ->
${ANSI.color(normalizedReturnValue, ANSI.YELLOW)}
`);
        }
        const prevReference = {
          ...reference
        };
        updateReference(prevReference, reference);
        onReferenceUrlChange(normalizedReturnValue);
      });
      reference.generatedUrl = reference.url;
      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url);
      applyReferenceEffectsOnUrlInfo(reference, urlInfo, context);

      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      pluginController.callHooks("transformUrlSearchParams", reference, referenceContext, returnValue => {
        Object.keys(returnValue).forEach(key => {
          searchParams.set(key, returnValue[key]);
        });
        reference.generatedUrl = normalizeUrl(referencedUrlObject.href);
      });
      const returnValue = pluginController.callHooksUntil("formatUrl", reference, referenceContext);
      reference.generatedSpecifier = returnValue || reference.generatedUrl;
      reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      return [reference, urlInfo];
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error
      });
    }
  };
  kitchenContext.resolveReference = resolveReference;
  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    sourcemapsSourcesRelative,
    clientRuntimeCompat,
    injectSourcemapPlaceholder: ({
      urlInfo,
      specifier
    }) => {
      const [sourcemapReference, sourcemapUrlInfo] = resolveReference(createReference({
        trace: {
          message: `sourcemap comment placeholder`,
          url: urlInfo.url
        },
        type: "sourcemap_comment",
        expectedType: "sourcemap",
        subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
        parentUrl: urlInfo.url,
        specifier
      }));
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    },
    foundSourcemap: ({
      urlInfo,
      type,
      specifier,
      specifierLine,
      specifierColumn
    }) => {
      const sourcemapUrlSite = adjustUrlSite(urlInfo, {
        urlGraph,
        url: urlInfo.url,
        line: specifierLine,
        column: specifierColumn
      });
      const [sourcemapReference, sourcemapUrlInfo] = resolveReference(createReference({
        trace: traceFromUrlSite(sourcemapUrlSite),
        type,
        expectedType: "sourcemap",
        parentUrl: urlInfo.url,
        specifier,
        specifierLine,
        specifierColumn
      }));
      if (sourcemapReference.isInline) {
        sourcemapUrlInfo.isInline = true;
      }
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    }
  });
  const fetchUrlContent = async (urlInfo, {
    reference,
    contextDuringFetch
  }) => {
    try {
      const fetchUrlContentReturnValue = await pluginController.callAsyncHooksUntil("fetchUrlContent", urlInfo, contextDuringFetch);
      if (!fetchUrlContentReturnValue) {
        logger.warn(createDetailedMessage$1(`no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`, {
          "url": urlInfo.url,
          "url reference trace": reference.trace.message
        }));
        return;
      }
      let {
        content,
        contentType,
        data,
        type,
        subtype,
        originalUrl,
        originalContent = content,
        sourcemap,
        filename,
        status = 200,
        headers = {},
        body,
        isEntryPoint
      } = fetchUrlContentReturnValue;
      if (status !== 200) {
        throw new Error(`unexpected status, ${status}`);
      }
      if (content === undefined) {
        content = body;
      }
      if (contentType === undefined) {
        contentType = headers["content-type"] || "application/octet-stream";
      }
      urlInfo.contentType = contentType;
      urlInfo.headers = headers;
      urlInfo.type = type || reference.expectedType || inferUrlInfoType(urlInfo);
      urlInfo.subtype = subtype || reference.expectedSubtype || urlInfo.subtypeHint || "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl || urlInfo.originalUrl;
      if (originalContent !== urlInfo.originalContent) {
        urlInfo.originalContentEtag = undefined; // set by "initTransformations"
      }

      if (content !== urlInfo.content) {
        urlInfo.contentEtag = undefined; // set by "applyFinalTransformations"
      }

      urlInfo.originalContent = originalContent;
      urlInfo.content = content;
      urlInfo.sourcemap = sourcemap;
      if (data) {
        Object.assign(urlInfo.data, data);
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint;
      }
      if (filename) {
        urlInfo.filename = filename;
      }
      assertFetchedContentCompliance({
        reference,
        urlInfo
      });
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        reference,
        error
      });
    }
    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      urlInfo,
      context: contextDuringFetch
    });
    await urlInfoTransformer.initTransformations(urlInfo, contextDuringFetch);
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;
  const _cook = async (urlInfo, dishContext) => {
    const context = {
      ...kitchenContext,
      ...dishContext
    };
    const {
      cookDuringCook = cook
    } = dishContext;
    context.cook = (urlInfo, nestedDishContext) => {
      return cookDuringCook(urlInfo, {
        ...dishContext,
        ...nestedDishContext
      });
    };
    context.fetchUrlContent = (urlInfo, {
      reference
    }) => {
      return fetchUrlContent(urlInfo, {
        reference,
        contextDuringFetch: context
      });
    };
    if (urlInfo.shouldHandle) {
      // references
      const references = [];
      context.referenceUtils = {
        _references: references,
        find: predicate => references.find(predicate),
        readGeneratedSpecifier,
        add: props => {
          const [reference, referencedUrlInfo] = resolveReference(createReference({
            parentUrl: urlInfo.url,
            ...props
          }), context);
          references.push(reference);
          return [reference, referencedUrlInfo];
        },
        found: ({
          trace,
          ...rest
        }) => {
          if (trace === undefined) {
            trace = traceFromUrlSite(adjustUrlSite(urlInfo, {
              urlGraph,
              url: urlInfo.url,
              line: rest.specifierLine,
              column: rest.specifierColumn
            }));
          }
          // console.log(trace.message)
          return context.referenceUtils.add({
            trace,
            ...rest
          });
        },
        foundInline: ({
          isOriginalPosition,
          specifierLine,
          specifierColumn,
          ...rest
        }) => {
          const parentUrl = isOriginalPosition ? urlInfo.url : urlInfo.generatedUrl;
          const parentContent = isOriginalPosition ? urlInfo.originalContent : urlInfo.content;
          return context.referenceUtils.add({
            trace: traceFromUrlSite({
              url: parentUrl,
              content: parentContent,
              line: specifierLine,
              column: specifierColumn
            }),
            isOriginalPosition,
            specifierLine,
            specifierColumn,
            isInline: true,
            ...rest
          });
        },
        update: (currentReference, newReferenceParams) => {
          const index = references.indexOf(currentReference);
          if (index === -1) {
            throw new Error(`reference do not exists`);
          }
          const [newReference, newUrlInfo] = resolveReference(createReference({
            ...currentReference,
            ...newReferenceParams
          }), context);
          updateReference(currentReference, newReference);
          references[index] = newReference;
          const currentUrlInfo = context.urlGraph.getUrlInfo(currentReference.url);
          if (currentUrlInfo && currentUrlInfo !== newUrlInfo && currentUrlInfo.dependents.size === 0) {
            context.urlGraph.deleteUrlInfo(currentReference.url);
          }
          return [newReference, newUrlInfo];
        },
        inject: ({
          trace,
          ...rest
        }) => {
          if (trace === undefined) {
            const {
              url,
              line,
              column
            } = getCallerPosition();
            trace = traceFromUrlSite({
              url,
              line,
              column
            });
          }
          return context.referenceUtils.add({
            trace,
            injected: true,
            ...rest
          });
        },
        becomesInline: (reference, {
          isOriginalPosition,
          specifier,
          specifierLine,
          specifierColumn,
          contentType,
          content
        }) => {
          const parentUrl = isOriginalPosition ? urlInfo.url : urlInfo.generatedUrl;
          const parentContent = isOriginalPosition ? urlInfo.originalContent : urlInfo.content;
          return context.referenceUtils.update(reference, {
            trace: traceFromUrlSite({
              url: parentUrl,
              content: parentContent,
              line: specifierLine,
              column: specifierColumn
            }),
            isOriginalPosition,
            isInline: true,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content
          });
        },
        becomesExternal: () => {
          throw new Error("not implemented yet");
        }
      };

      // "fetchUrlContent" hook
      await fetchUrlContent(urlInfo, {
        reference: context.reference,
        contextDuringFetch: context
      });

      // "transform" hook
      try {
        await pluginController.callAsyncHooks("transformUrlContent", urlInfo, context, async transformReturnValue => {
          await urlInfoTransformer.applyIntermediateTransformations(urlInfo, transformReturnValue);
        });
      } catch (error) {
        urlGraph.updateReferences(urlInfo, references); // ensure reference are updated even in case of error
        const transformError = createTransformUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error
        });
        urlInfo.error = transformError;
        throw transformError;
      }
      // after "transform" all references from originalContent
      // and the one injected by plugin are known
      urlGraph.updateReferences(urlInfo, references);

      // "finalize" hook
      try {
        const finalizeReturnValue = await pluginController.callAsyncHooksUntil("finalizeUrlContent", urlInfo, context);
        await urlInfoTransformer.applyFinalTransformations(urlInfo, finalizeReturnValue);
      } catch (error) {
        throw createFinalizeUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error
        });
      }
    }

    // "cooked" hook
    pluginController.callHooks("cooked", urlInfo, context, cookedReturnValue => {
      if (typeof cookedReturnValue === "function") {
        const removePrunedCallback = urlGraph.prunedCallbackList.add(({
          prunedUrlInfos,
          firstUrlInfo
        }) => {
          const pruned = prunedUrlInfos.find(prunedUrlInfo => prunedUrlInfo.url === urlInfo.url);
          if (pruned) {
            removePrunedCallback();
            cookedReturnValue(firstUrlInfo);
          }
        });
      }
    });
  };
  const cook = memoizeCook(async (urlInfo, context) => {
    if (!outDirectoryUrl) {
      await _cook(urlInfo, context);
      return;
    }
    // writing result inside ".jsenv" directory (debug purposes)
    try {
      await _cook(urlInfo, context);
    } finally {
      const {
        generatedUrl
      } = urlInfo;
      if (generatedUrl && generatedUrl.startsWith("file:")) {
        if (urlInfo.type === "directory") ; else if (urlInfo.content === null) ; else {
          let contentIsInlined = urlInfo.isInline;
          if (contentIsInlined && context.supervisor && urlGraph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html") {
            contentIsInlined = false;
          }
          if (!contentIsInlined) {
            writeFileSync(new URL(generatedUrl), urlInfo.content);
          }
          const {
            sourcemapGeneratedUrl,
            sourcemap
          } = urlInfo;
          if (sourcemapGeneratedUrl && sourcemap) {
            writeFileSync(new URL(sourcemapGeneratedUrl), JSON.stringify(sourcemap, null, "  "));
          }
        }
      }
    }
  });
  kitchenContext.cook = cook;
  const prepareEntryPoint = params => {
    return resolveReference(createReference({
      ...params,
      isEntryPoint: true
    }));
  };
  kitchenContext.prepareEntryPoint = prepareEntryPoint;
  const injectReference = params => {
    return resolveReference(createReference(params));
  };
  kitchenContext.injectReference = injectReference;
  const getWithoutSearchParam = ({
    urlInfo,
    reference,
    context,
    searchParam,
    expectedType
  }) => {
    const urlObject = new URL(urlInfo.url);
    const {
      searchParams
    } = urlObject;
    if (!searchParams.has(searchParam)) {
      return [null, null];
    }
    searchParams.delete(searchParam);
    const originalRef = reference || context.reference.original || context.reference;
    const referenceWithoutSearchParam = {
      ...originalRef,
      original: originalRef,
      searchParams,
      data: {
        ...originalRef.data
      },
      expectedType,
      specifier: originalRef.specifier.replace(`?${searchParam}`, "").replace(`&${searchParam}`, ""),
      url: normalizeUrl(urlObject.href),
      generatedSpecifier: null,
      generatedUrl: null,
      filename: null
    };
    const urlInfoWithoutSearchParam = context.urlGraph.reuseOrCreateUrlInfo(referenceWithoutSearchParam.url);
    if (urlInfoWithoutSearchParam.originalUrl === undefined) {
      applyReferenceEffectsOnUrlInfo(referenceWithoutSearchParam, urlInfoWithoutSearchParam, context);
    }
    return [referenceWithoutSearchParam, urlInfoWithoutSearchParam];
  };
  kitchenContext.getWithoutSearchParam = getWithoutSearchParam;
  return {
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    kitchenContext,
    cook,
    createReference,
    injectReference
  };
};

// "formatReferencedUrl" can be async BUT this is an exception
// for most cases it will be sync. We want to favor the sync signature to keep things simpler
// The only case where it needs to be async is when
// the specifier is a `data:*` url
// in this case we'll wait for the promise returned by
// "formatReferencedUrl"

const readGeneratedSpecifier = reference => {
  if (reference.generatedSpecifier.then) {
    return reference.generatedSpecifier.then(value => {
      reference.generatedSpecifier = value;
      return value;
    });
  }
  return reference.generatedSpecifier;
};
const memoizeCook = cook => {
  const pendingDishes = new Map();
  return async (urlInfo, context) => {
    const {
      url,
      modifiedTimestamp
    } = urlInfo;
    const pendingDish = pendingDishes.get(url);
    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      pendingDishes.delete(url);
    }
    const timestamp = Date.now();
    const promise = cook(urlInfo, context);
    pendingDishes.set(url, {
      timestamp,
      promise
    });
    try {
      await promise;
    } finally {
      pendingDishes.delete(url);
    }
  };
};
const traceFromUrlSite = urlSite => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column
  };
};
const applyReferenceEffectsOnUrlInfo = (reference, urlInfo, context) => {
  if (reference.shouldHandle) {
    urlInfo.shouldHandle = true;
  } else {
    urlInfo.shouldHandle = false;
  }
  urlInfo.originalUrl = urlInfo.originalUrl || reference.url;
  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    urlInfo.isEntryPoint = true;
  }
  Object.assign(urlInfo.data, reference.data);
  Object.assign(urlInfo.timing, reference.timing);
  if (reference.injected) {
    urlInfo.injected = true;
  }
  if (reference.filename && !urlInfo.filename) {
    urlInfo.filename = reference.filename;
  }
  if (reference.isInline) {
    urlInfo.isInline = true;
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
    urlInfo.inlineUrlSite = {
      url: parentUrlInfo.url,
      content: reference.isOriginalPosition ? parentUrlInfo.originalContent : parentUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn
    };
    urlInfo.contentType = reference.contentType;
    urlInfo.originalContent = context.build ? urlInfo.originalContent === undefined ? reference.content : urlInfo.originalContent : reference.content;
    urlInfo.content = reference.content;
  }
  if (reference.debug) {
    urlInfo.debug = true;
  }
  if (reference.expectedType) {
    urlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    urlInfo.subtypeHint = reference.expectedSubtype;
  }
};
const adjustUrlSite = (urlInfo, {
  urlGraph,
  url,
  line,
  column
}) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url);
    return adjust({
      isOriginal: true,
      url: inlineUrlSite.url,
      content: inlineUrlSite.content,
      line: inlineUrlSite.line === undefined ? urlSite.line : inlineUrlSite.line + urlSite.line,
      column: inlineUrlSite.column === undefined ? urlSite.column : inlineUrlSite.column + urlSite.column
    }, parentUrlInfo);
  };
  return adjust({
    isOriginal,
    url,
    content: isOriginal ? urlInfo.originalContent : urlInfo.content,
    line,
    column
  }, urlInfo);
};
const inferUrlInfoType = urlInfo => {
  const {
    type
  } = urlInfo;
  if (type === "sourcemap") {
    return "sourcemap";
  }
  const {
    contentType
  } = urlInfo;
  if (contentType === "text/html") {
    return "html";
  }
  if (contentType === "text/css") {
    return "css";
  }
  if (contentType === "text/javascript") {
    if (urlInfo.typeHint === "js_classic") return "js_classic";
    return "js_module";
  }
  if (contentType === "application/importmap+json") {
    return "importmap";
  }
  if (contentType === "application/manifest+json") {
    return "webmanifest";
  }
  if (contentType === "image/svg+xml") {
    return "svg";
  }
  if (CONTENT_TYPE.isJson(contentType)) {
    return "json";
  }
  if (CONTENT_TYPE.isTextual(contentType)) {
    return "text";
  }
  return "other";
};
const determineFileUrlForOutDirectory = ({
  urlInfo,
  context
}) => {
  if (!context.outDirectoryUrl) {
    return urlInfo.url;
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url;
  }
  let url = urlInfo.url;
  if (!urlIsInsideOf(urlInfo.url, context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url);
    url = `${context.rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
  }
  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename);
  }
  return moveUrl({
    url,
    from: context.rootDirectoryUrl,
    to: context.outDirectoryUrl
  });
};

const createUrlGraphLoader = context => {
  const promises = [];
  const promiseMap = new Map();
  const load = (urlInfo, dishContext, {
    ignoreRessourceHint = true,
    ignoreDynamicImport = false
  } = {}) => {
    const promiseFromData = promiseMap.get(urlInfo);
    if (promiseFromData) return promiseFromData;
    const promise = (async () => {
      await context.cook(urlInfo, {
        cookDuringCook: load,
        ...dishContext
      });
      loadReferencedUrlInfos(urlInfo, {
        ignoreRessourceHint,
        ignoreDynamicImport
      });
    })();
    promises.push(promise);
    promiseMap.set(urlInfo, promise);
    return promise;
  };
  const loadReferencedUrlInfos = (urlInfo, {
    ignoreRessourceHint,
    ignoreDynamicImport
  }) => {
    const {
      references
    } = urlInfo;
    references.forEach(reference => {
      // we don't cook resource hints
      // because they might refer to resource that will be modified during build
      // It also means something else have to reference that url in order to cook it
      // so that the preload is deleted by "resync_resource_hints.js" otherwise
      if (ignoreRessourceHint && reference.isResourceHint) {
        return;
      }
      if (ignoreDynamicImport && reference.subtype === "import_dynamic") {
        return;
      }
      // we use reference.generatedUrl to mimic what a browser would do:
      // do a fetch to the specifier as found in the file
      const referencedUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(reference.generatedUrl);
      load(referencedUrlInfo, {
        reference,
        ignoreRessourceHint,
        ignoreDynamicImport
      });
    });
  };
  const getAllLoadDonePromise = async operation => {
    const waitAll = async () => {
      if (operation) {
        operation.throwIfAborted();
      }
      if (promises.length === 0) {
        return;
      }
      const promisesToWait = promises.slice();
      promises.length = 0;
      await Promise.all(promisesToWait);
      await waitAll();
    };
    await waitAll();
    promiseMap.clear();
  };
  return {
    load,
    loadReferencedUrlInfos,
    getAllLoadDonePromise
  };
};

const createUrlGraphSummary = (urlGraph, {
  title = "graph summary"
} = {}) => {
  const graphReport = createUrlGraphReport(urlGraph);
  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
--------------------`;
};
const createUrlGraphReport = urlGraph => {
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0
  };
  urlGraph.urlInfoMap.forEach(urlInfo => {
    if (urlInfo.url.startsWith("data:")) {
      return;
    }
    // ignore:
    // - inline files: they are already taken into account in the file where they appear
    // - ignored files: we don't know their content
    if (urlInfo.isInline || !urlInfo.shouldHandle) {
      return;
    }
    // file loaded via import assertion are already inside the graph
    // their js module equivalent are ignored to avoid counting it twice
    // in the build graph the file targeted by import assertion will likely be gone
    // and only the js module remain (likely bundled)
    const urlObject = new URL(urlInfo.url);
    if (urlObject.searchParams.has("as_json_module") || urlObject.searchParams.has("as_css_module") || urlObject.searchParams.has("as_text_module")) {
      return;
    }
    const urlContentSize = Buffer.byteLength(urlInfo.content);
    const category = determineCategory(urlInfo);
    if (category === "sourcemap") {
      countGroups.sourcemaps++;
      sizeGroups.sourcemaps += urlContentSize;
      return;
    }
    countGroups.total++;
    sizeGroups.total += urlContentSize;
    if (category === "html") {
      countGroups.html++;
      sizeGroups.html += urlContentSize;
      return;
    }
    if (category === "css") {
      countGroups.css++;
      sizeGroups.css += urlContentSize;
      return;
    }
    if (category === "js") {
      countGroups.js++;
      sizeGroups.js += urlContentSize;
      return;
    }
    if (category === "json") {
      countGroups.json++;
      sizeGroups.json += urlContentSize;
      return;
    }
    countGroups.other++;
    sizeGroups.other += urlContentSize;
    return;
  });
  const sizesToDistribute = {};
  Object.keys(sizeGroups).forEach(groupName => {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  });
  const percentageGroups = distributePercentages(sizesToDistribute);
  return {
    // sourcemaps are special, there size are ignored
    // so there is no "percentage" associated
    sourcemaps: {
      count: countGroups.sourcemaps,
      size: sizeGroups.sourcemaps,
      percentage: undefined
    },
    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100
    }
  };
};
const determineCategory = urlInfo => {
  if (urlInfo.type === "sourcemap") {
    return "sourcemap";
  }
  if (urlInfo.type === "html") {
    return "html";
  }
  if (urlInfo.type === "css") {
    return "css";
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js";
  }
  if (urlInfo.type === "json") {
    return "json";
  }
  return "other";
};
const createRepartitionMessage = ({
  html,
  css,
  js,
  json,
  other,
  total
}) => {
  const addPart = (name, {
    count,
    size,
    percentage
  }) => {
    parts.push(`${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${byteAsFileSize(size)} / ${percentage} %)`);
  };
  const parts = [];
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${byteAsFileSize(sourcemaps.size)})`,
  //   )
  // }
  if (html.count) {
    addPart("html ", html);
  }
  if (css.count) {
    addPart("css  ", css);
  }
  if (js.count) {
    addPart("js   ", js);
  }
  if (json.count) {
    addPart("json ", json);
  }
  if (other.count) {
    addPart("other", other);
  }
  addPart("total", total);
  return `- ${parts.join(`
- `)}`;
};

const jsenvPluginReferenceExpectedTypes = () => {
  const redirectJsUrls = reference => {
    const urlObject = new URL(reference.url);
    const {
      searchParams
    } = urlObject;
    if (searchParams.has("entry_point")) {
      reference.isEntryPoint = true;
    }
    if (searchParams.has("js_classic")) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("js_module_fallback") || searchParams.has("as_js_classic")) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("as_js_module")) {
      reference.expectedType = "js_module";
    } else if (searchParams.has("js_module")) {
      reference.expectedType = "js_module";
    } else if (reference.type === "js_url" && reference.expectedType === undefined && CONTENT_TYPE.fromUrlExtension(reference.url) === "text/javascript") {
      // by default, js referenced by new URL is considered as "js_module"
      // in case this is not desired code must use "?js_classic" like
      // new URL('./file.js?js_classic', import.meta.url)
      reference.expectedType = "js_module";
    }
    if (searchParams.has("worker")) {
      reference.expectedSubtype = "worker";
    } else if (searchParams.has("service_worker")) {
      reference.expectedSubtype = "service_worker";
    } else if (searchParams.has("shared_worker")) {
      reference.expectedSubtype = "shared_worker";
    }
    return urlObject.href;
  };
  return {
    name: "jsenv:reference_expected_types",
    appliesDuring: "*",
    redirectUrl: {
      script: redirectJsUrls,
      js_url: redirectJsUrls,
      js_import: redirectJsUrls
    }
  };
};

const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.originalUrl;
  const content = urlInfo.content;
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: context.dev
  });
  const mentions = visitHtmlUrls({
    url,
    htmlAst
  });
  const mutations = [];
  const actions = [];
  for (const mention of mentions) {
    const {
      type,
      subtype,
      expectedType,
      line,
      column,
      originalLine,
      originalColumn,
      node,
      attributeName,
      debug,
      specifier
    } = mention;
    const {
      crossorigin,
      integrity
    } = readFetchMetas(node);
    const isResourceHint = ["preconnect", "dns-prefetch", "prefetch", "preload", "modulepreload"].includes(subtype);
    const [reference] = context.referenceUtils.found({
      type,
      subtype,
      expectedType,
      originalLine,
      originalColumn,
      specifier,
      specifierLine: line,
      specifierColumn: column,
      isResourceHint,
      crossorigin,
      integrity,
      debug
    });
    actions.push(async () => {
      await context.referenceUtils.readGeneratedSpecifier(reference);
      mutations.push(() => {
        setHtmlNodeAttributes(node, {
          [attributeName]: reference.generatedSpecifier
        });
      });
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map(action => action()));
  }
  if (mutations.length === 0) {
    return null;
  }
  mutations.forEach(mutation => mutation());
  return stringifyHtmlAst(htmlAst);
};
const crossOriginCompatibleTagNames = ["script", "link", "img", "source"];
const integrityCompatibleTagNames = ["script", "link", "img", "source"];
const readFetchMetas = node => {
  const meta = {};
  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossorigin = getHtmlNodeAttribute(node, "crossorigin") !== undefined;
    meta.crossorigin = crossorigin;
  }
  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrity = getHtmlNodeAttribute(node, "integrity");
    meta.integrity = integrity;
  }
  return meta;
};
const visitHtmlUrls = ({
  url,
  htmlAst
}) => {
  const mentions = [];
  const finalizeCallbacks = [];
  const addMention = ({
    type,
    subtype,
    expectedType,
    node,
    attributeName,
    specifier
  }) => {
    let position;
    if (getHtmlNodeAttribute(node, "jsenv-cooked-by")) {
      // when generated from inline content,
      // line, column is not "src" nor "inlined-from-src" but "original-position"
      position = getHtmlNodePosition(node);
    } else {
      position = getHtmlNodeAttributePosition(node, attributeName);
    }
    const {
      line,
      column
      // originalLine, originalColumn
    } = position;
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
    const mention = {
      type,
      subtype,
      expectedType,
      line,
      column,
      // originalLine, originalColumn
      specifier,
      node,
      attributeName,
      debug
    };
    mentions.push(mention);
    return mention;
  };
  const visitAttributeAsUrlSpecifier = ({
    node,
    attributeName,
    ...rest
  }) => {
    const value = getHtmlNodeAttribute(node, attributeName);
    if (value) {
      if (getHtmlNodeAttribute(node, "jsenv-inlined-by") === "jsenv:importmap") {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return null;
      }
      return addMention({
        ...rest,
        node,
        attributeName,
        specifier: attributeName === "inlined-from-src" || attributeName === "inlined-from-href" ? new URL(value, url).href : value
      });
    }
    if (attributeName === "src") {
      return visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-src"
      });
    }
    if (attributeName === "href") {
      return visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-href"
      });
    }
    return null;
  };
  const visitSrcset = ({
    type,
    node
  }) => {
    const srcset = getHtmlNodeAttribute(node, "srcset");
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset);
      srcCandidates.forEach(srcCandidate => {
        addMention({
          type,
          node,
          attributeName: "srcset",
          specifier: srcCandidate.specifier
        });
      });
    }
  };
  visitHtmlNodes(htmlAst, {
    link: node => {
      const rel = getHtmlNodeAttribute(node, "rel");
      const type = getHtmlNodeAttribute(node, "type");
      const mention = visitAttributeAsUrlSpecifier({
        type: "link_href",
        subtype: rel,
        node,
        attributeName: "href",
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
        expectedContentType: type
      });
      if (mention) {
        finalizeCallbacks.push(() => {
          mention.expectedType = decideLinkExpectedType(mention, mentions);
        });
      }
    },
    // style: () => {},
    script: node => {
      const {
        type
      } = analyzeScriptNode(node);
      if (type === "text") {
        // ignore <script type="whatever" src="./file.js">
        // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
        // this will be handled by jsenv_plugin_html_inline_content_analysis
        return;
      }
      visitAttributeAsUrlSpecifier({
        type: "script",
        subtype: type,
        expectedType: type,
        node,
        attributeName: "src"
      });
    },
    a: node => {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href"
      });
    },
    iframe: node => {
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src"
      });
    },
    img: node => {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src"
      });
      visitSrcset({
        type: "img_srcset",
        node
      });
    },
    source: node => {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src"
      });
      visitSrcset({
        type: "source_srcset",
        node
      });
    },
    // svg <image> tag
    image: node => {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href"
      });
    },
    use: node => {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href"
      });
    }
  });
  finalizeCallbacks.forEach(finalizeCallback => {
    finalizeCallback();
  });
  return mentions;
};
const decideLinkExpectedType = (linkMention, mentions) => {
  const rel = getHtmlNodeAttribute(linkMention.node, "rel");
  if (rel === "webmanifest") {
    return "webmanifest";
  }
  if (rel === "modulepreload") {
    return "js_module";
  }
  if (rel === "stylesheet") {
    return "css";
  }
  if (rel === "preload") {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
    const as = getHtmlNodeAttribute(linkMention.node, "as");
    if (as === "document") {
      return "html";
    }
    if (as === "style") {
      return "css";
    }
    if (as === "script") {
      const firstScriptOnThisUrl = mentions.find(mentionCandidate => mentionCandidate.url === linkMention.url && mentionCandidate.type === "script");
      if (firstScriptOnThisUrl) {
        return firstScriptOnThisUrl.expectedType;
      }
      return undefined;
    }
  }
  return undefined;
};

/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */
const parseAndTransformCssUrls = async (urlInfo, context) => {
  const cssUrls = await parseCssUrls({
    css: urlInfo.content,
    url: urlInfo.originalUrl
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const cssUrl of cssUrls) {
    const [reference] = context.referenceUtils.found({
      type: cssUrl.type,
      specifier: cssUrl.specifier,
      specifierStart: cssUrl.start,
      specifierEnd: cssUrl.end,
      specifierLine: cssUrl.line,
      specifierColumn: cssUrl.column
    });
    actions.push(async () => {
      const replacement = await context.referenceUtils.readGeneratedSpecifier(reference);
      magicSource.replace({
        start: cssUrl.start,
        end: cssUrl.end,
        replacement
      });
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map(action => action()));
  }
  return magicSource.toContentAndSourcemap();
};

const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo)
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const jsMention of jsMentions) {
    if (jsMention.subtype === "import_static" || jsMention.subtype === "import_dynamic") {
      urlInfo.data.usesImport = true;
    }
    const [reference] = context.referenceUtils.found({
      node: jsMention.node,
      type: jsMention.type,
      subtype: jsMention.subtype,
      expectedType: jsMention.expectedType,
      expectedSubtype: jsMention.expectedSubtype || urlInfo.subtype,
      specifier: jsMention.specifier,
      specifierStart: jsMention.start,
      specifierEnd: jsMention.end,
      specifierLine: jsMention.line,
      specifierColumn: jsMention.column,
      data: jsMention.data,
      baseUrl: {
        "StringLiteral": jsMention.baseUrl,
        "window.location": urlInfo.url,
        "window.origin": context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url
      }[jsMention.baseUrlType],
      assert: jsMention.assert,
      assertNode: jsMention.assertNode,
      typePropertyNode: jsMention.typePropertyNode
    });
    actions.push(async () => {
      const replacement = await context.referenceUtils.readGeneratedSpecifier(reference);
      magicSource.replace({
        start: jsMention.start,
        end: jsMention.end,
        replacement
      });
      if (reference.mutation) {
        reference.mutation(magicSource);
      }
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map(action => action()));
  }
  const {
    content,
    sourcemap
  } = magicSource.toContentAndSourcemap();
  return {
    content,
    sourcemap
  };
};

const parseAndTransformWebmanifestUrls = async (urlInfo, context) => {
  const content = urlInfo.content;
  const manifest = JSON.parse(content);
  const actions = [];
  const {
    icons = []
  } = manifest;
  icons.forEach(icon => {
    const [reference] = context.referenceUtils.found({
      type: "webmanifest_icon_src",
      specifier: icon.src
    });
    actions.push(async () => {
      icon.src = await context.referenceUtils.readGeneratedSpecifier(reference);
    });
  });
  if (actions.length === 0) {
    return null;
  }
  await Promise.all(actions.map(action => action()));
  return JSON.stringify(manifest, null, "  ");
};

const jsenvPluginUrlAnalysis = ({
  rootDirectoryUrl,
  include,
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"]
}) => {
  // eslint-disable-next-line no-unused-vars
  let getIncludeInfo = url => undefined;
  if (include) {
    const associations = URL_META.resolveAssociations({
      include
    }, rootDirectoryUrl);
    getIncludeInfo = url => {
      const {
        include
      } = URL_META.applyAssociations({
        url,
        associations
      });
      return include;
    };
  }
  return [{
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: reference => {
      if (reference.shouldHandle !== undefined) {
        return;
      }
      if (reference.specifier[0] === "#" &&
      // For Html, css and in general "#" refer to a resource in the page
      // so that urls must be kept intact
      // However for js import specifiers they have a different meaning and we want
      // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
      reference.type !== "js_import") {
        reference.shouldHandle = false;
        return;
      }
      const includeInfo = getIncludeInfo(reference.url);
      if (includeInfo === true) {
        reference.shouldHandle = true;
        return;
      }
      if (includeInfo === false) {
        reference.shouldHandle = false;
        return;
      }
      const {
        protocol
      } = new URL(reference.url);
      const protocolIsSupported = supportedProtocols.some(supportedProtocol => protocol === supportedProtocol);
      if (protocolIsSupported) {
        reference.shouldHandle = true;
      }
    },
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
      directory: (urlInfo, context) => {
        const originalDirectoryReference = findOriginalDirectoryReference(urlInfo, context);
        const directoryRelativeUrl = urlToRelativeUrl(urlInfo.url, context.rootDirectoryUrl);
        JSON.parse(urlInfo.content).forEach(directoryEntryName => {
          context.referenceUtils.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: directoryEntryName,
            trace: {
              message: `"${directoryRelativeUrl}${directoryEntryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`
            }
          });
        });
      }
    }
  }, jsenvPluginReferenceExpectedTypes()];
};
const findOriginalDirectoryReference = (urlInfo, context) => {
  const findNonFileSystemAncestor = urlInfo => {
    for (const dependentUrl of urlInfo.dependents) {
      const dependentUrlInfo = context.urlGraph.getUrlInfo(dependentUrl);
      if (dependentUrlInfo.type !== "directory") {
        return [dependentUrlInfo, urlInfo];
      }
      const found = findNonFileSystemAncestor(dependentUrlInfo);
      if (found) {
        return found;
      }
    }
    return [];
  };
  const [ancestor, child] = findNonFileSystemAncestor(urlInfo);
  if (!ancestor) {
    return null;
  }
  const ref = ancestor.references.find(ref => ref.url === child.url);
  return ref;
};

const jsenvPluginInliningAsDataUrl = () => {
  return {
    name: "jsenv:inlining_as_data_url",
    appliesDuring: "*",
    formatUrl: {
      // if the referenced url is a worker we could use
      // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
      // but maybe we should rather use ?object_url
      // or people could do this:
      // import workerText from './worker.js?text'
      // const blob = new Blob(workerText, { type: 'text/javascript' })
      // window.URL.createObjectURL(blob)
      // in any case the recommended way is to use an url
      // to benefit from shared worker and reuse worker between tabs
      "*": (reference, context) => {
        if (!reference.original || !reference.original.searchParams.has("inline")) {
          return null;
        }
        // <link rel="stylesheet"> and <script> can be inlined in the html
        if (reference.type === "link_href" && reference.subtype === "stylesheet") {
          return null;
        }
        if (reference.type === "script") {
          return null;
        }
        return (async () => {
          const urlInfo = context.urlGraph.getUrlInfo(reference.url);
          await context.cook(urlInfo, {
            reference
          });
          const contentAsBase64 = Buffer.from(urlInfo.content).toString("base64");
          const specifier = DATA_URL.stringify({
            mediaType: urlInfo.contentType,
            base64Flag: true,
            data: contentAsBase64
          });
          context.referenceUtils.becomesInline(reference, {
            line: reference.line,
            column: reference.column,
            isOriginal: reference.isOriginal,
            specifier,
            content: contentAsBase64,
            contentType: urlInfo.contentType
          });
          return specifier;
        })();
      }
    }
  };
};

const jsenvPluginInliningIntoHtml = () => {
  return {
    name: "jsenv:inlining_into_html",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        const actions = [];
        const onStyleSheet = (linkNode, {
          href
        }) => {
          const linkReference = context.referenceUtils.find(ref => ref.generatedSpecifier === href && ref.type === "link_href" && ref.subtype === "stylesheet");
          if (!linkReference.original || !linkReference.original.searchParams.has("inline")) {
            return;
          }
          const linkUrlInfo = context.urlGraph.getUrlInfo(linkReference.url);
          actions.push(async () => {
            await context.cook(linkUrlInfo, {
              reference: linkReference
            });
            const {
              line,
              column,
              isOriginal
            } = getHtmlNodePosition(linkNode, {
              preferOriginal: true
            });
            context.referenceUtils.becomesInline(linkReference, {
              line: line - 1,
              column,
              isOriginal,
              specifier: linkReference.generatedSpecifier,
              content: linkUrlInfo.content,
              contentType: linkUrlInfo.contentType
            });
            mutations.push(() => {
              setHtmlNodeAttributes(linkNode, {
                "inlined-from-href": href,
                "href": undefined,
                "rel": undefined,
                "type": undefined,
                "as": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html"
              });
              linkNode.nodeName = "style";
              linkNode.tagName = "style";
              setHtmlNodeText(linkNode, linkUrlInfo.content, {
                indentation: "auto"
              });
            });
          });
        };
        const onScriptWithSrc = (scriptNode, {
          src
        }) => {
          const scriptReference = context.referenceUtils.find(ref => ref.generatedSpecifier === src && ref.type === "script");
          if (!scriptReference.original || !scriptReference.original.searchParams.has("inline")) {
            return;
          }
          const scriptUrlInfo = context.urlGraph.getUrlInfo(scriptReference.url);
          actions.push(async () => {
            await context.cook(scriptUrlInfo, {
              reference: scriptReference
            });
            const {
              line,
              column,
              isOriginal
            } = getHtmlNodePosition(scriptNode, {
              preferOriginal: true
            });
            context.referenceUtils.becomesInline(scriptReference, {
              line: line - 1,
              column,
              isOriginal,
              specifier: scriptReference.generatedSpecifier,
              content: scriptUrlInfo.content,
              contentType: scriptUrlInfo.contentType
            });
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html"
              });
              setHtmlNodeText(scriptNode, scriptUrlInfo.content, {
                indentation: "auto"
              });
            });
          });
        };
        visitHtmlNodes(htmlAst, {
          link: linkNode => {
            const rel = getHtmlNodeAttribute(linkNode, "rel");
            if (rel !== "stylesheet") {
              return;
            }
            const href = getHtmlNodeAttribute(linkNode, "href");
            if (!href) {
              return;
            }
            onStyleSheet(linkNode, {
              href
            });
          },
          script: scriptNode => {
            const {
              type
            } = analyzeScriptNode(scriptNode);
            const scriptNodeText = getHtmlNodeText(scriptNode);
            if (scriptNodeText) {
              return;
            }
            const src = getHtmlNodeAttribute(scriptNode, "src");
            if (!src) {
              return;
            }
            onScriptWithSrc(scriptNode, {
              type,
              src
            });
          }
        });
        if (actions.length > 0) {
          await Promise.all(actions.map(action => action()));
        }
        mutations.forEach(mutation => mutation());
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      }
    }
  };
};

const jsenvPluginInlining = () => {
  return [{
    name: "jsenv:inlining",
    appliesDuring: "*",
    redirectUrl: reference => {
      const {
        searchParams
      } = reference;
      if (searchParams.has("inline")) {
        const urlObject = new URL(reference.url);
        urlObject.searchParams.delete("inline");
        return urlObject.href;
      }
      return null;
    }
  }, jsenvPluginInliningAsDataUrl(), jsenvPluginInliningIntoHtml()];
};

/*
 * This plugin ensure content inlined inside HTML is cooked (inline <script> for instance)
 * For <script hot-accept> the script content will be moved to a virtual file
 * to enable hot reloading
 */
const jsenvPluginHtmlInlineContentAnalysis = ({
  analyzeConvertedScripts
}) => {
  const cookInlineContent = async ({
    context,
    inlineContentUrlInfo,
    inlineContentReference
  }) => {
    try {
      await context.cook(inlineContentUrlInfo, {
        reference: inlineContentReference
      });
    } catch (e) {
      if (e.code === "PARSE_ERROR") {
        // When something like <style> or <script> contains syntax error
        // the HTML in itself it still valid
        // keep the syntax error and continue with the HTML
        const messageStart = inlineContentUrlInfo.type === "css" ? `Syntax error on css declared inside <style>` : `Syntax error on js declared inside <script>`;
        context.logger.error(`${messageStart}: ${e.cause.reasonCode}
${e.traceMessage}`);
      } else {
        throw e;
      }
    }
  };
  return {
    name: "jsenv:html_inline_content_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        const actions = [];
        visitHtmlNodes(htmlAst, {
          style: styleNode => {
            const styleNodeText = getHtmlNodeText(styleNode);
            if (!styleNodeText) {
              return;
            }
            const {
              line,
              column,
              lineEnd,
              columnEnd,
              isOriginal
            } = getHtmlNodePosition(styleNode, {
              preferOriginal: true
            });
            const inlineStyleUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: ".css",
              line,
              column,
              lineEnd,
              columnEnd
            });
            const debug = getHtmlNodeAttribute(styleNode, "jsenv-debug") !== undefined;
            const [inlineStyleReference, inlineStyleUrlInfo] = context.referenceUtils.foundInline({
              node: styleNode,
              type: "style",
              expectedType: "css",
              isOriginalPosition: isOriginal,
              // we remove 1 to the line because imagine the following html:
              // <style>body { color: red; }</style>
              // -> content starts same line as <style>
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineStyleUrl,
              contentType: "text/css",
              content: styleNodeText,
              debug
            });
            actions.push(async () => {
              await cookInlineContent({
                context,
                inlineContentUrlInfo: inlineStyleUrlInfo,
                inlineContentReference: inlineStyleReference
              });
            });
            mutations.push(() => {
              setHtmlNodeText(styleNode, inlineStyleUrlInfo.content, {
                indentation: false // indentation would decrease strack trace precision
              });

              setHtmlNodeAttributes(styleNode, {
                "jsenv-cooked-by": "jsenv:html_inline_content_analysis"
              });
            });
          },
          script: scriptNode => {
            const scriptNodeText = getHtmlNodeText(scriptNode);
            if (!scriptNodeText) {
              return;
            }
            // If the inline script was already handled by an other plugin, ignore it
            // - we want to preserve inline scripts generated by html supervisor during dev
            // - we want to avoid cooking twice a script during build
            if (!analyzeConvertedScripts && getHtmlNodeAttribute(scriptNode, "jsenv-injected-by") === "jsenv:js_module_fallback") {
              return;
            }
            const hotAccept = getHtmlNodeAttribute(scriptNode, "hot-accept") !== undefined;
            const {
              type,
              contentType,
              extension
            } = analyzeScriptNode(scriptNode);
            const {
              line,
              column,
              lineEnd,
              columnEnd,
              isOriginal
            } = getHtmlNodePosition(scriptNode, {
              preferOriginal: true
            });
            let inlineScriptUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: extension || CONTENT_TYPE.asFileExtension(contentType),
              line,
              column,
              lineEnd,
              columnEnd
            });
            const debug = getHtmlNodeAttribute(scriptNode, "jsenv-debug") !== undefined;
            const [inlineScriptReference, inlineScriptUrlInfo] = context.referenceUtils.foundInline({
              node: scriptNode,
              type: "script",
              expectedType: type,
              // we remove 1 to the line because imagine the following html:
              // <script>console.log('ok')</script>
              // -> content starts same line as <script>
              specifierLine: line - 1,
              specifierColumn: column,
              isOriginalPosition: isOriginal,
              specifier: inlineScriptUrl,
              contentType,
              content: scriptNodeText,
              debug
            });
            actions.push(async () => {
              await cookInlineContent({
                context,
                inlineContentUrlInfo: inlineScriptUrlInfo,
                inlineContentReference: inlineScriptReference
              });
              mutations.push(() => {
                const attributes = {
                  "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
                  // 1. <script type="jsx"> becomes <script>
                  // 2. <script type="module/jsx"> becomes <script type="module">
                  ...(extension ? {
                    type: type === "js_module" ? "module" : undefined
                  } : {})
                };
                if (hotAccept) {
                  removeHtmlNodeText(scriptNode);
                  setHtmlNodeAttributes(scriptNode, {
                    ...attributes
                  });
                } else {
                  setHtmlNodeText(scriptNode, inlineScriptUrlInfo.content, {
                    indentation: false // indentation would decrease stack trace precision
                  });

                  setHtmlNodeAttributes(scriptNode, {
                    ...attributes
                  });
                }
              });
            });
          }
        });
        if (actions.length > 0) {
          await Promise.all(actions.map(action => action()));
        }
        if (mutations.length === 0) {
          return null;
        }
        mutations.forEach(mutation => mutation());
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      }
    }
  };
};

const isEscaped = (i, string) => {
  let backslashBeforeCount = 0;
  while (i--) {
    const previousChar = string[i];
    if (previousChar === "\\") {
      backslashBeforeCount++;
    }
    break;
  }
  const isEven = backslashBeforeCount % 2 === 0;
  return !isEven;
};

const JS_QUOTES = {
  pickBest: (string, {
    canUseTemplateString,
    defaultQuote = DOUBLE
  } = {}) => {
    // check default first, once tested do no re-test it
    if (!string.includes(defaultQuote)) {
      return defaultQuote;
    }
    if (defaultQuote !== DOUBLE && !string.includes(DOUBLE)) {
      return DOUBLE;
    }
    if (defaultQuote !== SINGLE && !string.includes(SINGLE)) {
      return SINGLE;
    }
    if (canUseTemplateString && defaultQuote !== BACKTICK && !string.includes(BACKTICK)) {
      return BACKTICK;
    }
    return defaultQuote;
  },
  escapeSpecialChars: (string, {
    quote = "pickBest",
    canUseTemplateString,
    defaultQuote,
    allowEscapeForVersioning = false
  }) => {
    quote = quote === "pickBest" ? JS_QUOTES.pickBest(string, {
      canUseTemplateString,
      defaultQuote
    }) : quote;
    const replacements = JS_QUOTE_REPLACEMENTS[quote];
    let result = "";
    let last = 0;
    let i = 0;
    while (i < string.length) {
      const char = string[i];
      i++;
      if (isEscaped(i - 1, string)) continue;
      const replacement = replacements[char];
      if (replacement) {
        if (allowEscapeForVersioning && char === quote && string.slice(i, i + 6) === "+__v__") {
          let isVersioningConcatenation = false;
          let j = i + 6; // start after the +
          while (j < string.length) {
            const lookAheadChar = string[j];
            j++;
            if (lookAheadChar === "+" && string[j] === quote && !isEscaped(j - 1, string)) {
              isVersioningConcatenation = true;
              break;
            }
          }
          if (isVersioningConcatenation) {
            // it's a concatenation
            // skip until the end of concatenation (the second +)
            // and resume from there
            i = j + 1;
            continue;
          }
        }
        if (last === i - 1) {
          result += replacement;
        } else {
          result += `${string.slice(last, i - 1)}${replacement}`;
        }
        last = i;
      }
    }
    if (last !== string.length) {
      result += string.slice(last);
    }
    return `${quote}${result}${quote}`;
  }
};
const DOUBLE = `"`;
const SINGLE = `'`;
const BACKTICK = "`";
const lineEndingEscapes = {
  "\n": "\\n",
  "\r": "\\r",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
const JS_QUOTE_REPLACEMENTS = {
  [DOUBLE]: {
    '"': '\\"',
    ...lineEndingEscapes
  },
  [SINGLE]: {
    "'": "\\'",
    ...lineEndingEscapes
  },
  [BACKTICK]: {
    "`": "\\`",
    "$": "\\$"
  }
};

const jsenvPluginJsInlineContentAnalysis = ({
  allowEscapeForVersioning
}) => {
  const parseAndTransformInlineContentCalls = async (urlInfo, context) => {
    const inlineContentInfos = await parseJsInlineContentInfos({
      js: urlInfo.content,
      url: urlInfo.originalUrl,
      isJsModule: urlInfo.type === "js_module"
    });
    if (inlineContentInfos.length === 0) {
      return null;
    }
    const magicSource = createMagicSource(urlInfo.content);
    await inlineContentInfos.reduce(async (previous, inlineContentInfo) => {
      await previous;
      const inlineUrl = generateInlineContentUrl({
        url: urlInfo.url,
        extension: CONTENT_TYPE.asFileExtension(inlineContentInfo.contentType),
        line: inlineContentInfo.line,
        column: inlineContentInfo.column,
        lineEnd: inlineContentInfo.lineEnd,
        columnEnd: inlineContentInfo.columnEnd
      });
      let {
        quote
      } = inlineContentInfo;
      if (quote === "`" && !context.isSupportedOnCurrentClients("template_literals")) {
        // if quote is "`" and template literals are not supported
        // we'll use a regular string (single or double quote)
        // when rendering the string
        quote = JS_QUOTES.pickBest(inlineContentInfo.content);
      }
      const [inlineReference, inlineUrlInfo] = context.referenceUtils.foundInline({
        type: "js_inline_content",
        subtype: inlineContentInfo.type,
        // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
        isOriginalPosition: urlInfo.content === urlInfo.originalContent,
        specifierLine: inlineContentInfo.line,
        specifierColumn: inlineContentInfo.column,
        specifier: inlineUrl,
        contentType: inlineContentInfo.contentType,
        content: inlineContentInfo.content
      });
      inlineUrlInfo.jsQuote = quote;
      inlineReference.escape = value => JS_QUOTES.escapeSpecialChars(value.slice(1, -1), {
        quote
      });
      await context.cook(inlineUrlInfo, {
        reference: inlineReference
      });
      magicSource.replace({
        start: inlineContentInfo.start,
        end: inlineContentInfo.end,
        replacement: JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
          quote,
          allowEscapeForVersioning
        })
      });
    }, Promise.resolve());
    return magicSource.toContentAndSourcemap();
  };
  return {
    name: "jsenv:js_inline_content_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: parseAndTransformInlineContentCalls,
      js_module: parseAndTransformInlineContentCalls
    }
  };
};
const parseJsInlineContentInfos = async ({
  js,
  url,
  isJsModule
}) => {
  if (!js.includes("InlineContent") && !js.includes("new Blob(") && !js.includes("JSON.parse(")) {
    return [];
  }
  const {
    metadata
  } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataInlineContents],
    urlInfo: {
      originalUrl: url,
      type: isJsModule ? "js_module" : "js_classic",
      content: js
    }
  });
  return metadata.inlineContentInfos;
};
const babelPluginMetadataInlineContents = () => {
  return {
    name: "metadata-inline-contents",
    visitor: {
      Program: (programPath, state) => {
        const inlineContentInfos = [];
        const onInlineContentInfo = inlineContentInfo => {
          inlineContentInfos.push(inlineContentInfo);
        };
        programPath.traverse({
          NewExpression: path => {
            if (isNewInlineContentCall(path)) {
              analyzeNewInlineContentCall(path.node, {
                onInlineContentInfo
              });
              return;
            }
            if (isNewBlobCall(path.node)) {
              analyzeNewBlobCall(path.node, {
                onInlineContentInfo
              });
              return;
            }
          },
          CallExpression: path => {
            const node = path.node;
            if (isJSONParseCall(node)) {
              analyzeJsonParseCall(node, {
                onInlineContentInfo
              });
            }
          }
        });
        state.file.metadata.inlineContentInfos = inlineContentInfos;
      }
    }
  };
};
const isNewInlineContentCall = path => {
  const node = path.node;
  if (node.callee.type === "Identifier") {
    // terser rename import to use a shorter name
    const name = getOriginalName(path, node.callee.name);
    return name === "InlineContent";
  }
  if (node.callee.id && node.callee.id.type === "Identifier") {
    const name = getOriginalName(path, node.callee.id.name);
    return name === "InlineContent";
  }
  return false;
};
const analyzeNewInlineContentCall = (node, {
  onInlineContentInfo
}) => {
  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: node.arguments[0],
    type: "new_inline_content_first_arg"
  });
};
const isNewBlobCall = node => {
  return node.callee.type === "Identifier" && node.callee.name === "Blob";
};
const analyzeNewBlobCall = (node, {
  onInlineContentInfo
}) => {
  const firstArg = node.arguments[0];
  if (!firstArg) {
    return;
  }
  if (firstArg.type !== "ArrayExpression") {
    return;
  }
  if (firstArg.elements.length !== 1) {
    return;
  }
  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: firstArg.elements[0],
    type: "new_blob_first_arg"
  });
};
const analyzeArguments = ({
  node,
  onInlineContentInfo,
  nodeHoldingContent,
  type
}) => {
  if (node.arguments.length !== 2) {
    return;
  }
  const [, secondArg] = node.arguments;
  const typePropertyNode = getTypePropertyNode(secondArg);
  if (!typePropertyNode) {
    return;
  }
  const typePropertyValueNode = typePropertyNode.value;
  if (typePropertyValueNode.type !== "StringLiteral") {
    return;
  }
  const contentType = typePropertyValueNode.value;
  const contentDetails = extractContentDetails(nodeHoldingContent);
  if (contentDetails) {
    onInlineContentInfo({
      node: nodeHoldingContent,
      ...getNodePosition(nodeHoldingContent),
      type,
      contentType,
      ...contentDetails
    });
  }
};
const extractContentDetails = node => {
  if (node.type === "StringLiteral") {
    return {
      nodeType: "StringLiteral",
      quote: node.extra.raw[0],
      content: node.value
    };
  }
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis;
    if (quasis.length !== 1) {
      return null;
    }
    const templateElementNode = quasis[0];
    return {
      nodeType: "TemplateLiteral",
      quote: "`",
      content: templateElementNode.value.cooked
    };
  }
  return null;
};
const isJSONParseCall = node => {
  const callee = node.callee;
  return callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "JSON" && callee.property.type === "Identifier" && callee.property.name === "parse";
};
const analyzeJsonParseCall = (node, {
  onInlineContentInfo
}) => {
  const firstArgNode = node.arguments[0];
  const contentDetails = extractContentDetails(firstArgNode);
  if (contentDetails) {
    onInlineContentInfo({
      node: firstArgNode,
      ...getNodePosition(firstArgNode),
      type: "json_parse_first_arg",
      contentType: "application/json",
      ...contentDetails
    });
  }
};
const getNodePosition = node => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column
  };
};
const getOriginalName = (path, name) => {
  const binding = path.scope.getBinding(name);
  if (!binding) {
    return name;
  }
  if (binding.path.type === "ImportSpecifier") {
    const importedName = binding.path.node.imported.name;
    if (name === importedName) {
      return name;
    }
    return getOriginalName(path, importedName);
  }
  if (binding.path.type === "VariableDeclarator") {
    const {
      node
    } = binding.path;
    const {
      init
    } = node;
    if (init && init.type === "Identifier") {
      const previousName = init.name;
      return getOriginalName(path, previousName);
    }
    if (node.id && node.id.type === "Identifier") {
      const {
        constantViolations
      } = binding;
      if (constantViolations && constantViolations.length > 0) {
        const lastViolation = constantViolations[constantViolations.length - 1];
        if (lastViolation && lastViolation.node.type === "AssignmentExpression" && lastViolation.node.right.type === "MemberExpression" && lastViolation.node.right.property.type === "Identifier") {
          return lastViolation.node.right.property.name;
        }
      }
    }
  }
  return name;
};
const getTypePropertyNode = node => {
  if (node.type !== "ObjectExpression") {
    return null;
  }
  const {
    properties
  } = node;
  return properties.find(property => {
    return property.type === "ObjectProperty" && property.key.type === "Identifier" && property.key.name === "type";
  });
};

const jsenvPluginDataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolveUrl: reference => {
      if (!reference.specifier.startsWith("data:")) {
        return null;
      }
      return reference.specifier;
    },
    fetchUrlContent: urlInfo => {
      if (!urlInfo.url.startsWith("data:")) {
        return null;
      }
      const {
        contentType,
        base64Flag,
        data: urlData
      } = DATA_URL.parse(urlInfo.url);
      urlInfo.data.base64Flag = base64Flag;
      return {
        content: contentFromUrlData({
          contentType,
          base64Flag,
          urlData
        }),
        contentType
      };
    },
    formatUrl: (reference, context) => {
      if (!reference.generatedUrl.startsWith("data:")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      return (async () => {
        const urlInfo = context.urlGraph.getUrlInfo(reference.url);
        await context.cook(urlInfo, {
          reference
        });
        if (urlInfo.originalContent === urlInfo.content) {
          return reference.generatedUrl;
        }
        const specifier = DATA_URL.stringify({
          contentType: urlInfo.contentType,
          base64Flag: urlInfo.data.base64Flag,
          data: urlInfo.data.base64Flag ? dataToBase64(urlInfo.content) : String(urlInfo.content)
        });
        return specifier;
      })();
    }
  };
};
const contentFromUrlData = ({
  contentType,
  base64Flag,
  urlData
}) => {
  if (CONTENT_TYPE.isTextual(contentType)) {
    if (base64Flag) {
      return base64ToString(urlData);
    }
    return urlData;
  }
  if (base64Flag) {
    return base64ToBuffer(urlData);
  }
  return Buffer.from(urlData);
};
const base64ToBuffer = base64String => Buffer.from(base64String, "base64");
const base64ToString = base64String => Buffer.from(base64String, "base64").toString("utf8");
const dataToBase64 = data => Buffer.from(data).toString("base64");

const jsenvPluginInlineContentAnalysis = ({
  fetchInlineUrls = true,
  analyzeConvertedScripts = false,
  allowEscapeForVersioning = false
} = {}) => {
  return [...(fetchInlineUrls ? [jsenvPluginInlineContentFetcher()] : []), jsenvPluginHtmlInlineContentAnalysis({
    analyzeConvertedScripts
  }), jsenvPluginJsInlineContentAnalysis({
    allowEscapeForVersioning
  }), jsenvPluginDataUrls()];
};
const jsenvPluginInlineContentFetcher = () => {
  return {
    name: "jsenv:inline_content_fetcher",
    appliesDuring: "*",
    fetchUrlContent: urlInfo => {
      if (!urlInfo.isInline) {
        return null;
      }
      return {
        // we want to fetch the original content otherwise we might re-cook
        // content already cooked
        content: urlInfo.originalContent,
        contentType: urlInfo.contentType
      };
    }
  };
};

const requireFromJsenv = createRequire(import.meta.url);

const babelPluginPackagePath = requireFromJsenv.resolve("@jsenv/babel-plugins");
const babelPluginPackageUrl = pathToFileURL(babelPluginPackagePath);
const requireBabelPlugin = createRequire(babelPluginPackageUrl);

const babelPluginTransformImportMetaUrl = babel => {
  return {
    name: "transform-import-meta-url",
    visitor: {
      Program: programPath => {
        const currentUrlIdentifier = programPath.scope.generateUidIdentifier("currentUrl");
        let used = false;
        programPath.traverse({
          MemberExpression: path => {
            const node = path.node;
            if (node.object.type === "MetaProperty" && node.object.property.name === "meta" && node.property.name === "url") {
              // const node = babel.types.valueToNode(10)
              const identifier = babel.types.identifier(currentUrlIdentifier.name);
              const expressionStatement = babel.types.expressionStatement(identifier);
              path.replaceWith(expressionStatement);
              used = true;
            }
          }
        });
        if (used) {
          const ast = generateExpressionAst(`document.currentScript.src`);
          programPath.scope.push({
            id: currentUrlIdentifier,
            init: ast
          });
        }
      }
    }
  };
};
const generateExpressionAst = (expression, options) => {
  const {
    parseExpression
  } = babelParser;
  const ast = parseExpression(expression, options);
  return ast;
};

const babelPluginTransformImportMetaResolve = () => {
  return {
    name: "transform-import-meta-resolve",
    visitor: {
      Program: programPath => {
        programPath.traverse({
          MemberExpression: path => {
            const node = path.node;
            if (node.object.type === "MetaProperty" && node.object.property.name === "meta" && node.property.name === "resolve") {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === "StringLiteral") {
                path.replaceWithSourceString(`new URL(${firstArg.value}, document.currentScript.src).href`);
              }
            }
          }
        });
      }
    }
  };
};

// eslint-disable-next-line import/no-default-export
const helpers_string_1 = '// A type of promise-like that resolves synchronously and supports only one observer\nexport const _Pact = /*#__PURE__*/(function() {\n\tfunction _Pact() {}\n\t_Pact.prototype.then = function(onFulfilled, onRejected) {\n\t\tconst result = new _Pact();\n\t\tconst state = this.s;\n\t\tif (state) {\n\t\t\tconst callback = state & 1 ? onFulfilled : onRejected;\n\t\t\tif (callback) {\n\t\t\t\ttry {\n\t\t\t\t\t_settle(result, 1, callback(this.v));\n\t\t\t\t} catch (e) {\n\t\t\t\t\t_settle(result, 2, e);\n\t\t\t\t}\n\t\t\t\treturn result;\n\t\t\t} else {\n\t\t\t\treturn this;\n\t\t\t}\n\t\t}\n\t\tthis.o = function(_this) {\n\t\t\ttry {\n\t\t\t\tconst value = _this.v;\n\t\t\t\tif (_this.s & 1) {\n\t\t\t\t\t_settle(result, 1, onFulfilled ? onFulfilled(value) : value);\n\t\t\t\t} else if (onRejected) {\n\t\t\t\t\t_settle(result, 1, onRejected(value));\n\t\t\t\t} else {\n\t\t\t\t\t_settle(result, 2, value);\n\t\t\t\t}\n\t\t\t} catch (e) {\n\t\t\t\t_settle(result, 2, e);\n\t\t\t}\n\t\t};\n\t\treturn result;\n\t}\n\treturn _Pact;\n})();\n\n// Settles a pact synchronously\nexport function _settle(pact, state, value) {\n\tif (!pact.s) {\n\t\tif (value instanceof _Pact) {\n\t\t\tif (value.s) {\n\t\t\t\tif (state & 1) {\n\t\t\t\t\tstate = value.s;\n\t\t\t\t}\n\t\t\t\tvalue = value.v;\n\t\t\t} else {\n\t\t\t\tvalue.o = _settle.bind(null, pact, state);\n\t\t\t\treturn;\n\t\t\t}\n\t\t}\n\t\tif (value && value.then) {\n\t\t\tvalue.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));\n\t\t\treturn;\n\t\t}\n\t\tpact.s = state;\n\t\tpact.v = value;\n\t\tconst observer = pact.o;\n\t\tif (observer) {\n\t\t\tobserver(pact);\n\t\t}\n\t}\n}\n\nexport function _isSettledPact(thenable) {\n\treturn thenable instanceof _Pact && thenable.s & 1;\n}\n\n// Converts argument to a function that always returns a Promise\nexport function _async(f) {\n\treturn function() {\n\t\tfor (var args = [], i = 0; i < arguments.length; i++) {\n\t\t\targs[i] = arguments[i];\n\t\t}\n\t\ttry {\n\t\t\treturn Promise.resolve(f.apply(this, args));\n\t\t} catch(e) {\n\t\t\treturn Promise.reject(e);\n\t\t}\n\t}\n}\n\n// Awaits on a value that may or may not be a Promise (equivalent to the await keyword in ES2015, with continuations passed explicitly)\nexport function _await(value, then, direct) {\n\tif (direct) {\n\t\treturn then ? then(value) : value;\n\t}\n\tif (!value || !value.then) {\n\t\tvalue = Promise.resolve(value);\n\t}\n\treturn then ? value.then(then) : value;\n}\n\n// Awaits on a value that may or may not be a Promise, then ignores it\nexport function _awaitIgnored(value, direct) {\n\tif (!direct) {\n\t\treturn value && value.then ? value.then(_empty) : Promise.resolve();\n\t}\n}\n\n// Proceeds after a value has resolved, or proceeds immediately if the value is not thenable\nexport function _continue(value, then) {\n\treturn value && value.then ? value.then(then) : then(value);\n}\n\n// Proceeds after a value has resolved, or proceeds immediately if the value is not thenable\nexport function _continueIgnored(value) {\n\tif (value && value.then) {\n\t\treturn value.then(_empty);\n\t}\n}\n\n// Asynchronously iterate through an object that has a length property, passing the index as the first argument to the callback (even as the length property changes)\nexport function _forTo(array, body, check) {\n\tvar i = -1, pact, reject;\n\tfunction _cycle(result) {\n\t\ttry {\n\t\t\twhile (++i < array.length && (!check || !check())) {\n\t\t\t\tresult = body(i);\n\t\t\t\tif (result && result.then) {\n\t\t\t\t\tif (_isSettledPact(result)) {\n\t\t\t\t\t\tresult = result.v;\n\t\t\t\t\t} else {\n\t\t\t\t\t\tresult.then(_cycle, reject || (reject = _settle.bind(null, pact = new _Pact(), 2)));\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t\tif (pact) {\n\t\t\t\t_settle(pact, 1, result);\n\t\t\t} else {\n\t\t\t\tpact = result;\n\t\t\t}\n\t\t} catch (e) {\n\t\t\t_settle(pact || (pact = new _Pact()), 2, e);\n\t\t}\n\t}\n\t_cycle();\n\treturn pact;\n}\n\n// Asynchronously iterate through an object\'s properties (including properties inherited from the prototype)\n// Uses a snapshot of the object\'s properties\nexport function _forIn(target, body, check) {\n\tvar keys = [];\n\tfor (var key in target) {\n\t\tkeys.push(key);\n\t}\n\treturn _forTo(keys, function(i) { return body(keys[i]); }, check);\n}\n\n// Asynchronously iterate through an object\'s own properties (excluding properties inherited from the prototype)\n// Uses a snapshot of the object\'s properties\nexport function _forOwn(target, body, check) {\n\tvar keys = [];\n\tfor (var key in target) {\n\t\tif (Object.prototype.hasOwnProperty.call(target, key)) {\n\t\t\tkeys.push(key);\n\t\t}\n\t}\n\treturn _forTo(keys, function(i) { return body(keys[i]); }, check);\n}\n\nexport const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";\n\n// Asynchronously iterate through an object\'s values\n// Uses for...of if the runtime supports it, otherwise iterates until length on a copy\nexport function _forOf(target, body, check) {\n\tif (typeof target[_iteratorSymbol] === "function") {\n\t\tvar iterator = target[_iteratorSymbol](), step, pact, reject;\n\t\tfunction _cycle(result) {\n\t\t\ttry {\n\t\t\t\twhile (!(step = iterator.next()).done && (!check || !check())) {\n\t\t\t\t\tresult = body(step.value);\n\t\t\t\t\tif (result && result.then) {\n\t\t\t\t\t\tif (_isSettledPact(result)) {\n\t\t\t\t\t\t\tresult = result.v;\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tresult.then(_cycle, reject || (reject = _settle.bind(null, pact = new _Pact(), 2)));\n\t\t\t\t\t\t\treturn;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tif (pact) {\n\t\t\t\t\t_settle(pact, 1, result);\n\t\t\t\t} else {\n\t\t\t\t\tpact = result;\n\t\t\t\t}\n\t\t\t} catch (e) {\n\t\t\t\t_settle(pact || (pact = new _Pact()), 2, e);\n\t\t\t}\n\t\t}\n\t\t_cycle();\n\t\tif (iterator.return) {\n\t\t\tvar _fixup = function(value) {\n\t\t\t\ttry {\n\t\t\t\t\tif (!step.done) {\n\t\t\t\t\t\titerator.return();\n\t\t\t\t\t}\n\t\t\t\t} catch(e) {\n\t\t\t\t}\n\t\t\t\treturn value;\n\t\t\t}\n\t\t\tif (pact && pact.then) {\n\t\t\t\treturn pact.then(_fixup, function(e) {\n\t\t\t\t\tthrow _fixup(e);\n\t\t\t\t});\n\t\t\t}\n\t\t\t_fixup();\n\t\t}\n\t\treturn pact;\n\t}\n\t// No support for Symbol.iterator\n\tif (!("length" in target)) {\n\t\tthrow new TypeError("Object is not iterable");\n\t}\n\t// Handle live collections properly\n\tvar values = [];\n\tfor (var i = 0; i < target.length; i++) {\n\t\tvalues.push(target[i]);\n\t}\n\treturn _forTo(values, function(i) { return body(values[i]); }, check);\n}\n\nexport const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";\n\n// Asynchronously iterate on a value using it\'s async iterator if present, or its synchronous iterator if missing\nexport function _forAwaitOf(target, body, check) {\n\tif (typeof target[_asyncIteratorSymbol] === "function") {\n\t\tvar pact = new _Pact();\n\t\tvar iterator = target[_asyncIteratorSymbol]();\n\t\titerator.next().then(_resumeAfterNext).then(void 0, _reject);\n\t\treturn pact;\n\t\tfunction _resumeAfterBody(result) {\n\t\t\tif (check && check()) {\n\t\t\t\treturn _settle(pact, 1, iterator.return ? iterator.return().then(function() { return result; }) : result);\n\t\t\t}\n\t\t\titerator.next().then(_resumeAfterNext).then(void 0, _reject);\n\t\t}\n\t\tfunction _resumeAfterNext(step) {\n\t\t\tif (step.done) {\n\t\t\t\t_settle(pact, 1);\n\t\t\t} else {\n\t\t\t\tPromise.resolve(body(step.value)).then(_resumeAfterBody).then(void 0, _reject);\n\t\t\t}\n\t\t}\n\t\tfunction _reject(error) {\n\t\t\t_settle(pact, 2, iterator.return ? iterator.return().then(function() { return error; }) : error);\n\t\t}\n\t}\n\treturn Promise.resolve(_forOf(target, function(value) { return Promise.resolve(value).then(body); }, check));\n}\n\n// Asynchronously implement a generic for loop\nexport function _for(test, update, body) {\n\tvar stage;\n\tfor (;;) {\n\t\tvar shouldContinue = test();\n\t\tif (_isSettledPact(shouldContinue)) {\n\t\t\tshouldContinue = shouldContinue.v;\n\t\t}\n\t\tif (!shouldContinue) {\n\t\t\treturn result;\n\t\t}\n\t\tif (shouldContinue.then) {\n\t\t\tstage = 0;\n\t\t\tbreak;\n\t\t}\n\t\tvar result = body();\n\t\tif (result && result.then) {\n\t\t\tif (_isSettledPact(result)) {\n\t\t\t\tresult = result.s;\n\t\t\t} else {\n\t\t\t\tstage = 1;\n\t\t\t\tbreak;\n\t\t\t}\n\t\t}\n\t\tif (update) {\n\t\t\tvar updateValue = update();\n\t\t\tif (updateValue && updateValue.then && !_isSettledPact(updateValue)) {\n\t\t\t\tstage = 2;\n\t\t\t\tbreak;\n\t\t\t}\n\t\t}\n\t}\n\tvar pact = new _Pact();\n\tvar reject = _settle.bind(null, pact, 2);\n\t(stage === 0 ? shouldContinue.then(_resumeAfterTest) : stage === 1 ? result.then(_resumeAfterBody) : updateValue.then(_resumeAfterUpdate)).then(void 0, reject);\n\treturn pact;\n\tfunction _resumeAfterBody(value) {\n\t\tresult = value;\n\t\tdo {\n\t\t\tif (update) {\n\t\t\t\tupdateValue = update();\n\t\t\t\tif (updateValue && updateValue.then && !_isSettledPact(updateValue)) {\n\t\t\t\t\tupdateValue.then(_resumeAfterUpdate).then(void 0, reject);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t}\n\t\t\tshouldContinue = test();\n\t\t\tif (!shouldContinue || (_isSettledPact(shouldContinue) && !shouldContinue.v)) {\n\t\t\t\t_settle(pact, 1, result);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tif (shouldContinue.then) {\n\t\t\t\tshouldContinue.then(_resumeAfterTest).then(void 0, reject);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tresult = body();\n\t\t\tif (_isSettledPact(result)) {\n\t\t\t\tresult = result.v;\n\t\t\t}\n\t\t} while (!result || !result.then);\n\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t}\n\tfunction _resumeAfterTest(shouldContinue) {\n\t\tif (shouldContinue) {\n\t\t\tresult = body();\n\t\t\tif (result && result.then) {\n\t\t\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t\t\t} else {\n\t\t\t\t_resumeAfterBody(result);\n\t\t\t}\n\t\t} else {\n\t\t\t_settle(pact, 1, result);\n\t\t}\n\t}\n\tfunction _resumeAfterUpdate() {\n\t\tif (shouldContinue = test()) {\n\t\t\tif (shouldContinue.then) {\n\t\t\t\tshouldContinue.then(_resumeAfterTest).then(void 0, reject);\n\t\t\t} else {\n\t\t\t\t_resumeAfterTest(shouldContinue);\n\t\t\t}\n\t\t} else {\n\t\t\t_settle(pact, 1, result);\n\t\t}\n\t}\n}\n\n// Asynchronously implement a do ... while loop\nexport function _do(body, test) {\n\tvar awaitBody;\n\tdo {\n\t\tvar result = body();\n\t\tif (result && result.then) {\n\t\t\tif (_isSettledPact(result)) {\n\t\t\t\tresult = result.v;\n\t\t\t} else {\n\t\t\t\tawaitBody = true;\n\t\t\t\tbreak;\n\t\t\t}\n\t\t}\n\t\tvar shouldContinue = test();\n\t\tif (_isSettledPact(shouldContinue)) {\n\t\t\tshouldContinue = shouldContinue.v;\n\t\t}\n\t\tif (!shouldContinue) {\n\t\t\treturn result;\n\t\t}\n\t} while (!shouldContinue.then);\n\tconst pact = new _Pact();\n\tconst reject = _settle.bind(null, pact, 2);\n\t(awaitBody ? result.then(_resumeAfterBody) : shouldContinue.then(_resumeAfterTest)).then(void 0, reject);\n\treturn pact;\n\tfunction _resumeAfterBody(value) {\n\t\tresult = value;\n\t\tfor (;;) {\n\t\t\tshouldContinue = test();\n\t\t\tif (_isSettledPact(shouldContinue)) {\n\t\t\t\tshouldContinue = shouldContinue.v;\n\t\t\t}\n\t\t\tif (!shouldContinue) {\n\t\t\t\tbreak;\n\t\t\t}\n\t\t\tif (shouldContinue.then) {\n\t\t\t\tshouldContinue.then(_resumeAfterTest).then(void 0, reject);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tresult = body();\n\t\t\tif (result && result.then) {\n\t\t\t\tif (_isSettledPact(result)) {\n\t\t\t\t\tresult = result.v;\n\t\t\t\t} else {\n\t\t\t\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t\t_settle(pact, 1, result);\n\t}\n\tfunction _resumeAfterTest(shouldContinue) {\n\t\tif (shouldContinue) {\n\t\t\tdo {\n\t\t\t\tresult = body();\n\t\t\t\tif (result && result.then) {\n\t\t\t\t\tif (_isSettledPact(result)) {\n\t\t\t\t\t\tresult = result.v;\n\t\t\t\t\t} else {\n\t\t\t\t\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tshouldContinue = test();\n\t\t\t\tif (_isSettledPact(shouldContinue)) {\n\t\t\t\t\tshouldContinue = shouldContinue.v;\n\t\t\t\t}\n\t\t\t\tif (!shouldContinue) {\n\t\t\t\t\t_settle(pact, 1, result);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t} while (!shouldContinue.then);\n\t\t\tshouldContinue.then(_resumeAfterTest).then(void 0, reject);\n\t\t} else {\n\t\t\t_settle(pact, 1, result);\n\t\t}\n\t}\n}\n\n// Asynchronously implement a switch statement\nexport function _switch(discriminant, cases) {\n\tvar dispatchIndex = -1;\n\tvar awaitBody;\n\touter: {\n\t\tfor (var i = 0; i < cases.length; i++) {\n\t\t\tvar test = cases[i][0];\n\t\t\tif (test) {\n\t\t\t\tvar testValue = test();\n\t\t\t\tif (testValue && testValue.then) {\n\t\t\t\t\tbreak outer;\n\t\t\t\t}\n\t\t\t\tif (testValue === discriminant) {\n\t\t\t\t\tdispatchIndex = i;\n\t\t\t\t\tbreak;\n\t\t\t\t}\n\t\t\t} else {\n\t\t\t\t// Found the default case, set it as the pending dispatch case\n\t\t\t\tdispatchIndex = i;\n\t\t\t}\n\t\t}\n\t\tif (dispatchIndex !== -1) {\n\t\t\tdo {\n\t\t\t\tvar body = cases[dispatchIndex][1];\n\t\t\t\twhile (!body) {\n\t\t\t\t\tdispatchIndex++;\n\t\t\t\t\tbody = cases[dispatchIndex][1];\n\t\t\t\t}\n\t\t\t\tvar result = body();\n\t\t\t\tif (result && result.then) {\n\t\t\t\t\tawaitBody = true;\n\t\t\t\t\tbreak outer;\n\t\t\t\t}\n\t\t\t\tvar fallthroughCheck = cases[dispatchIndex][2];\n\t\t\t\tdispatchIndex++;\n\t\t\t} while (fallthroughCheck && !fallthroughCheck());\n\t\t\treturn result;\n\t\t}\n\t}\n\tconst pact = new _Pact();\n\tconst reject = _settle.bind(null, pact, 2);\n\t(awaitBody ? result.then(_resumeAfterBody) : testValue.then(_resumeAfterTest)).then(void 0, reject);\n\treturn pact;\n\tfunction _resumeAfterTest(value) {\n\t\tfor (;;) {\n\t\t\tif (value === discriminant) {\n\t\t\t\tdispatchIndex = i;\n\t\t\t\tbreak;\n\t\t\t}\n\t\t\tif (++i === cases.length) {\n\t\t\t\tif (dispatchIndex !== -1) {\n\t\t\t\t\tbreak;\n\t\t\t\t} else {\n\t\t\t\t\t_settle(pact, 1, result);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t}\n\t\t\ttest = cases[i][0];\n\t\t\tif (test) {\n\t\t\t\tvalue = test();\n\t\t\t\tif (value && value.then) {\n\t\t\t\t\tvalue.then(_resumeAfterTest).then(void 0, reject);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t} else {\n\t\t\t\tdispatchIndex = i;\n\t\t\t}\n\t\t}\n\t\tdo {\n\t\t\tvar body = cases[dispatchIndex][1];\n\t\t\twhile (!body) {\n\t\t\t\tdispatchIndex++;\n\t\t\t\tbody = cases[dispatchIndex][1];\n\t\t\t}\n\t\t\tvar result = body();\n\t\t\tif (result && result.then) {\n\t\t\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tvar fallthroughCheck = cases[dispatchIndex][2];\n\t\t\tdispatchIndex++;\n\t\t} while (fallthroughCheck && !fallthroughCheck());\n\t\t_settle(pact, 1, result);\n\t}\n\tfunction _resumeAfterBody(result) {\n\t\tfor (;;) {\n\t\t\tvar fallthroughCheck = cases[dispatchIndex][2];\n\t\t\tif (!fallthroughCheck || fallthroughCheck()) {\n\t\t\t\tbreak;\n\t\t\t}\n\t\t\tdispatchIndex++;\n\t\t\tvar body = cases[dispatchIndex][1];\n\t\t\twhile (!body) {\n\t\t\t\tdispatchIndex++;\n\t\t\t\tbody = cases[dispatchIndex][1];\n\t\t\t}\n\t\t\tresult = body();\n\t\t\tif (result && result.then) {\n\t\t\t\tresult.then(_resumeAfterBody).then(void 0, reject);\n\t\t\t\treturn;\n\t\t\t}\n\t\t}\n\t\t_settle(pact, 1, result);\n\t}\n}\n\n// Asynchronously call a function and pass the result to explicitly passed continuations\nexport function _call(body, then, direct) {\n\tif (direct) {\n\t\treturn then ? then(body()) : body();\n\t}\n\ttry {\n\t\tvar result = Promise.resolve(body());\n\t\treturn then ? result.then(then) : result;\n\t} catch (e) {\n\t\treturn Promise.reject(e);\n\t}\n}\n\n// Asynchronously call a function and swallow the result\nexport function _callIgnored(body, direct) {\n\treturn _call(body, _empty, direct);\n}\n\n// Asynchronously call a function and pass the result to explicitly passed continuations\nexport function _invoke(body, then) {\n\tvar result = body();\n\tif (result && result.then) {\n\t\treturn result.then(then);\n\t}\n\treturn then(result);\n}\n\n// Asynchronously call a function and swallow the result\nexport function _invokeIgnored(body) {\n\tvar result = body();\n\tif (result && result.then) {\n\t\treturn result.then(_empty);\n\t}\n}\n\n// Asynchronously call a function and send errors to recovery continuation\nexport function _catch(body, recover) {\n\ttry {\n\t\tvar result = body();\n\t} catch(e) {\n\t\treturn recover(e);\n\t}\n\tif (result && result.then) {\n\t\treturn result.then(void 0, recover);\n\t}\n\treturn result;\n}\n\n// Asynchronously await a promise and pass the result to a finally continuation\nexport function _finallyRethrows(body, finalizer) {\n\ttry {\n\t\tvar result = body();\n\t} catch (e) {\n\t\treturn finalizer(true, e);\n\t}\n\tif (result && result.then) {\n\t\treturn result.then(finalizer.bind(null, false), finalizer.bind(null, true));\n\t}\n\treturn finalizer(false, result);\n}\n\n// Asynchronously await a promise and invoke a finally continuation that always overrides the result\nexport function _finally(body, finalizer) {\n\ttry {\n\t\tvar result = body();\n\t} catch (e) {\n\t\treturn finalizer();\n\t}\n\tif (result && result.then) {\n\t\treturn result.then(finalizer, finalizer);\n\t}\n\treturn finalizer();\n}\n\n// Rethrow or return a value from a finally continuation\nexport function _rethrow(thrown, value) {\n\tif (thrown)\n\t\tthrow value;\n\treturn value;\n}\n\n// Empty function to implement break and other control flow that ignores asynchronous results\nexport function _empty() {\n}\n\n// Sentinel value for early returns in generators \nexport const _earlyReturn = /*#__PURE__*/ {};\n\n// Asynchronously call a function and send errors to recovery continuation, skipping early returns\nexport function _catchInGenerator(body, recover) {\n\treturn _catch(body, function(e) {\n\t\tif (e === _earlyReturn) {\n\t\t\tthrow e;\n\t\t}\n\t\treturn recover(e);\n\t});\n}\n\n// Asynchronous generator class; accepts the entrypoint of the generator, to which it passes itself when the generator should start\nexport const _AsyncGenerator = /*#__PURE__*/(function() {\n\tfunction _AsyncGenerator(entry) {\n\t\tthis._entry = entry;\n\t\tthis._pact = null;\n\t\tthis._resolve = null;\n\t\tthis._return = null;\n\t\tthis._promise = null;\n\t}\n\n\tfunction _wrapReturnedValue(value) {\n\t\treturn { value: value, done: true };\n\t}\n\tfunction _wrapYieldedValue(value) {\n\t\treturn { value: value, done: false };\n\t}\n\n\t_AsyncGenerator.prototype._yield = function(value) {\n\t\t// Yield the value to the pending next call\n\t\tthis._resolve(value && value.then ? value.then(_wrapYieldedValue) : _wrapYieldedValue(value));\n\t\t// Return a pact for an upcoming next/return/throw call\n\t\treturn this._pact = new _Pact();\n\t};\n\t_AsyncGenerator.prototype.next = function(value) {\n\t\t// Advance the generator, starting it if it has yet to be started\n\t\tconst _this = this;\n\t\treturn _this._promise = new Promise(function (resolve) {\n\t\t\tconst _pact = _this._pact;\n\t\t\tif (_pact === null) {\n\t\t\t\tconst _entry = _this._entry;\n\t\t\t\tif (_entry === null) {\n\t\t\t\t\t// Generator is started, but not awaiting a yield expression\n\t\t\t\t\t// Abandon the next call!\n\t\t\t\t\treturn resolve(_this._promise);\n\t\t\t\t}\n\t\t\t\t// Start the generator\n\t\t\t\t_this._entry = null;\n\t\t\t\t_this._resolve = resolve;\n\t\t\t\tfunction returnValue(value) {\n\t\t\t\t\t_this._resolve(value && value.then ? value.then(_wrapReturnedValue) : _wrapReturnedValue(value));\n\t\t\t\t\t_this._pact = null;\n\t\t\t\t\t_this._resolve = null;\n\t\t\t\t}\n\t\t\t\tvar result = _entry(_this);\n\t\t\t\tif (result && result.then) {\n\t\t\t\t\tresult.then(returnValue, function(error) {\n\t\t\t\t\t\tif (error === _earlyReturn) {\n\t\t\t\t\t\t\treturnValue(_this._return);\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tconst pact = new _Pact();\n\t\t\t\t\t\t\t_this._resolve(pact);\n\t\t\t\t\t\t\t_this._pact = null;\n\t\t\t\t\t\t\t_this._resolve = null;\n\t\t\t\t\t\t\t_resolve(pact, 2, error);\n\t\t\t\t\t\t}\n\t\t\t\t\t});\n\t\t\t\t} else {\n\t\t\t\t\treturnValue(result);\n\t\t\t\t}\n\t\t\t} else {\n\t\t\t\t// Generator is started and a yield expression is pending, settle it\n\t\t\t\t_this._pact = null;\n\t\t\t\t_this._resolve = resolve;\n\t\t\t\t_settle(_pact, 1, value);\n\t\t\t}\n\t\t});\n\t};\n\t_AsyncGenerator.prototype.return = function(value) {\n\t\t// Early return from the generator if started, otherwise abandons the generator\n\t\tconst _this = this;\n\t\treturn _this._promise = new Promise(function (resolve) {\n\t\t\tconst _pact = _this._pact;\n\t\t\tif (_pact === null) {\n\t\t\t\tif (_this._entry === null) {\n\t\t\t\t\t// Generator is started, but not awaiting a yield expression\n\t\t\t\t\t// Abandon the return call!\n\t\t\t\t\treturn resolve(_this._promise);\n\t\t\t\t}\n\t\t\t\t// Generator is not started, abandon it and return the specified value\n\t\t\t\t_this._entry = null;\n\t\t\t\treturn resolve(value && value.then ? value.then(_wrapReturnedValue) : _wrapReturnedValue(value));\n\t\t\t}\n\t\t\t// Settle the yield expression with a rejected "early return" value\n\t\t\t_this._return = value;\n\t\t\t_this._resolve = resolve;\n\t\t\t_this._pact = null;\n\t\t\t_settle(_pact, 2, _earlyReturn);\n\t\t});\n\t};\n\t_AsyncGenerator.prototype.throw = function(error) {\n\t\t// Inject an exception into the pending yield expression\n\t\tconst _this = this;\n\t\treturn _this._promise = new Promise(function (resolve, reject) {\n\t\t\tconst _pact = _this._pact;\n\t\t\tif (_pact === null) {\n\t\t\t\tif (_this._entry === null) {\n\t\t\t\t\t// Generator is started, but not awaiting a yield expression\n\t\t\t\t\t// Abandon the throw call!\n\t\t\t\t\treturn resolve(_this._promise);\n\t\t\t\t}\n\t\t\t\t// Generator is not started, abandon it and return a rejected Promise containing the error\n\t\t\t\t_this._entry = null;\n\t\t\t\treturn reject(error);\n\t\t\t}\n\t\t\t// Settle the yield expression with the value as a rejection\n\t\t\t_this._resolve = resolve;\n\t\t\t_this._pact = null;\n\t\t\t_settle(_pact, 2, error);\n\t\t});\n\t};\n\n\t_AsyncGenerator.prototype[_asyncIteratorSymbol] = function() {\n\t\treturn this;\n\t};\n\t\n\treturn _AsyncGenerator;\n})();\n';

const require = createRequire(import.meta.url);
const defaultConfigValues = {
  externalHelpers: false,
  hoist: false,
  inlineHelpers: false,
  minify: false,
  target: "es5",
  topLevelAwait: "disabled",
  asyncAwait: true
};
function readConfigKey(config, key) {
  if (Object.hasOwnProperty.call(config, key)) {
    const result = config[key];
    if (typeof result !== "undefined") {
      return result;
    }
  }
  return defaultConfigValues[key];
}
function discardingIntrinsics(node) {
  if (node.type == "V8IntrinsicIdentifier") {
    throw new Error(`Expected either an expression or a statement, got a ${node.type}!`);
  }
  return node;
}
function clearDeclarationData(declaration) {
  let path = declaration;
  while (path) {
    if (path.getData("declaration:var:2") == declaration) {
      path.setData("declaration:var:2", null);
    }
    path = path.parentPath;
  }
}
const constantFunctionMethods = {
  "call": false,
  "apply": false,
  "bind": false
};
const constantStaticMethods = {
  "Object": Object.assign({
    "assign": true,
    "create": true,
    "defineProperty": true,
    "defineProperties": true,
    "entries": true,
    "freeze": true,
    "fromEntries": true,
    "getOwnPropertyDescriptor": true,
    "getOwnPropertyDescriptors": true,
    "getOwnPropertyNames": true,
    "getOwnPropertySymbols": true,
    "getPrototypeOf": true,
    "is": true,
    "isExtensible": true,
    "isFrozen": true,
    "isSealed": true,
    "keys": true,
    "preventExtensions": true,
    "seal": true,
    "setPrototypeOf": true,
    "values": true
  }, constantFunctionMethods),
  "Function": constantFunctionMethods,
  "Boolean": constantFunctionMethods,
  "Number": Object.assign({
    "isNaN": true,
    "isFinite": true,
    "isInteger": true,
    "isSafeInteger": true,
    "parseFloat": true,
    "parseInteger": true
  }, constantFunctionMethods),
  "Array": Object.assign({
    "from": true,
    "isArray": true,
    "of": true
  }, constantFunctionMethods),
  "Date": Object.assign({
    "now": true,
    "parse": true,
    "UTC": true
  }, constantFunctionMethods),
  "RegExp": constantFunctionMethods,
  "Error": constantFunctionMethods,
  "TypeError": constantFunctionMethods,
  "Map": constantFunctionMethods,
  "Set": constantFunctionMethods,
  "WeakMap": constantFunctionMethods,
  "WeakSet": constantFunctionMethods,
  "Promise": Object.assign({
    "all": true,
    "race": true,
    "resolve": true,
    "reject": true
  }, constantFunctionMethods),
  "Math": {
    "abs": true,
    "acos": true,
    "asin": true,
    "atan": true,
    "atan2": true,
    "ceil": true,
    "cos": true,
    "exp": true,
    "floor": true,
    "log": true,
    "max": true,
    "min": true,
    "pow": true,
    "random": true,
    "round": true,
    "sin": true,
    "sqrt": true,
    "tan": true
  },
  "JSON": {
    "parse": true,
    "stringify": true
  },
  "URL": Object.assign({
    "createObjectURL": true,
    "revokeObjectURL": true
  }, constantFunctionMethods),
  "console": {
    "assert": true,
    "clear": true,
    "count": true,
    "error": true,
    "info": true,
    "log": true,
    "warn": true
  },
  "document": {
    "createComment": true,
    "createElement": true,
    "createTextNode": true,
    "getElementsByClassName": true,
    "getElementsByTagName": true,
    "getElementsByName": true,
    "getElementById": true,
    "querySelector": true,
    "querySelectorAll": true,
    "write": true,
    "writeln": true
  },
  "XMLHttpRequest": constantFunctionMethods,
  "WebSocket": constantFunctionMethods,
  "Image": constantFunctionMethods,
  "alert": constantFunctionMethods,
  "confirm": constantFunctionMethods,
  "open": constantFunctionMethods,
  "prompt": constantFunctionMethods,
  "eval": constantFunctionMethods,
  "isFinite": constantFunctionMethods,
  "isNaN": constantFunctionMethods,
  "parseInt": constantFunctionMethods,
  "parseFloat": constantFunctionMethods,
  "decodeURI": constantFunctionMethods,
  "decodeURIComponent": constantFunctionMethods,
  "encodeURI": constantFunctionMethods,
  "encodeURIComponent": constantFunctionMethods,
  "escape": constantFunctionMethods,
  "unescape": constantFunctionMethods,
  "$": constantFunctionMethods
};
const originalNodeMap = new WeakMap();
const skipNodeSet = new WeakSet();
const breakIdentifierMap = new WeakMap();
const isHelperDefinitionSet = new WeakSet();
const helperNameMap = new WeakMap();
const nodeIsAsyncSet = new WeakSet();
let helpers;
const alwaysTruthy = Object.keys(constantStaticMethods);
const numberNames = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
function default_1({
  types,
  traverse,
  transformFromAst,
  version
}) {
  const isNewBabel = !/^6\./.test(version);
  function cloneNode(node) {
    const result = types.cloneDeep(node);
    if (types.isIdentifier(node) || types.isMemberExpression(node)) {
      const helperName = helperNameMap.get(node);
      if (helperName !== undefined) {
        helperNameMap.set(result, helperName);
      }
    }
    return result;
  }
  function wrapNodeInStatement(node) {
    if (types.isStatement(node)) {
      return types.blockStatement([node]);
    }
    if (types.isExpression(node)) {
      return types.expressionStatement(node);
    }
    throw new Error(`Expected either an expression or a statement, got a ${node.type}!`);
  }
  function pathForNewNode(node, parentPath) {
    let contextPath = parentPath;
    while (contextPath != null) {
      if (contextPath.context) {
        const result = contextPath.context.create(parentPath.node, [node], 0, "dummy");
        result.setContext(contextPath.context);
        return result;
      }
      contextPath = contextPath.parentPath;
    }
    throw parentPath.buildCodeFrameError(`Unable to find a context upon which to traverse!`, TypeError);
  }
  function pathsPassTest(matchingNodeTest, referenceOriginalNodes) {
    function visit(path, result, state) {
      if (referenceOriginalNodes) {
        const originalNode = originalNodeMap.get(path.node);
        if (originalNode) {
          traverse(wrapNodeInStatement(originalNode), visitor, path.scope, {
            match: result,
            state
          }, path);
          return false;
        }
      }
      const doesMatch = matchingNodeTest(path);
      if (doesMatch) {
        result.any = true;
        result.all = !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isBreakStatement()) {
        const label = path.node.label;
        if (!label) {
          state.unnamedBreak = true;
        } else if (state.breakingLabels.indexOf(label.name) === -1) {
          state.breakingLabels.push(label.name);
        }
      }
      if (path.isLabeledStatement()) {
        const index = state.breakingLabels.indexOf(path.node.label.name);
        if (index !== -1) {
          state.breakingLabels.splice(index, 1);
        }
      }
      if (path.isLoop()) {
        state.unnamedBreak = false;
      }
      if (doesMatch) {
        return false;
      }
      if (path.isConditional()) {
        const test = match(path.get("test"), state);
        const consequent = match(path.get("consequent"), state);
        const alternate = match(path.get("alternate"), state);
        result.any = result.any || test.any || consequent.any || alternate.any;
        return result.all = (test.all || consequent.all && alternate.all) && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isSwitchStatement()) {
        const discriminant = match(path.get("discriminant"), state);
        const cases = path.get("cases");
        const caseMatches = cases.map((switchCase, i) => {
          const newState = {
            unnamedBreak: false,
            breakingLabels: state.breakingLabels
          };
          const newResult = match(switchCase, newState);
          for (i++; (!newResult.all || pathsBreakReturnOrThrow(switchCase).all) && i < cases.length; i++) {
            const tailMatch = match(cases[i], newState);
            newResult.all = (newResult.all || tailMatch.all) && !(state.breakingLabels.length || state.unnamedBreak);
            newResult.any = newResult.any || tailMatch.any;
          }
          return newResult;
        });
        result.any = result.any || discriminant.any || caseMatches.some(caseMatch => caseMatch.any);
        return result.all = (discriminant.all || cases.some(switchCase => !switchCase.node.test) && caseMatches.every(caseMatch => caseMatch.all)) && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isDoWhileStatement()) {
        const body = match(path.get("body"), {
          unnamedBreak: false,
          breakingLabels: state.breakingLabels
        });
        const test = match(path.get("test"), state);
        result.any = result.any || body.any || test.any;
        return result.all = (body.all || test.all) && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isWhileStatement()) {
        const testPath = path.get("test");
        const test = match(testPath, state);
        const body = match(path.get("body"), {
          unnamedBreak: false,
          breakingLabels: state.breakingLabels
        });
        result.any = result.any || test.any || body.any;
        return result.all = (test.all || body.all && extractLooseBooleanValue(testPath.node) === true) && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isForXStatement()) {
        const right = match(path.get("right"), state);
        const body = match(path.get("body"), {
          unnamedBreak: false,
          breakingLabels: state.breakingLabels
        });
        result.any = result.any || right.any || body.any;
        return result.all = right.all && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isForStatement()) {
        const init = match(path.get("init"), state);
        const test = match(path.get("test"), state);
        const body = match(path.get("body"), {
          unnamedBreak: false,
          breakingLabels: state.breakingLabels
        });
        const update = match(path.get("update"), state);
        result.any = result.any || init.any || test.any || body.any || update.any;
        return result.all = (init.all || test.all) && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isLogicalExpression()) {
        const left = match(path.get("left"), state);
        const right = match(path.get("right"), state);
        result.any = result.any || left.any || right.any;
        return result.all = left.all && !(state.breakingLabels.length || state.unnamedBreak);
      }
      if (path.isReturnStatement()) {
        return true;
      }
      if (path.isBreakStatement()) {
        return true;
      }
      if (path.isContinueStatement()) {
        return true;
      }
      if (path.isThrowStatement()) {
        return true;
      }
      if (path.isTryStatement()) {
        const blockMatch = match(path.get("block"), state);
        const finalizer = path.get("finalizer");
        const finalizerMatch = match(finalizer, state);
        const handler = path.get("handler");
        const handlerMatch = match(handler, state);
        result.any = result.any || blockMatch.any || handlerMatch.any || finalizerMatch.any;
        if (finalizerMatch.all) {
          return result.all = !(state.breakingLabels.length || state.unnamedBreak);
        } else if (!finalizer.node) {
          return result.all = handlerMatch.all && blockMatch.all && !(state.breakingLabels.length || state.unnamedBreak);
        }
        return false;
      }
      if (path.isFunction()) {
        return false;
      }
    }
    const visitor = {
      enter(path) {
        switch (visit(path, this.match, this.state)) {
          case true:
            path.stop();
            break;
          case false:
            path.skip();
            break;
        }
      }
    };
    function match(path, state) {
      const match = {
        all: false,
        any: false
      };
      if (path && path.node) {
        if (typeof visit(path, match, state) === "undefined") {
          path.traverse(visitor, {
            match,
            state
          });
        }
      }
      return match;
    }
    return path => match(path, {
      breakingLabels: [],
      unnamedBreak: false
    });
  }
  function pathsReachNodeTypes(matchingNodeTypes, referenceOriginalNodes) {
    return pathsPassTest(path => path.type !== null && path.type !== undefined && matchingNodeTypes.indexOf(path.type) !== -1, referenceOriginalNodes);
  }
  const pathsReturn = pathsReachNodeTypes(["ReturnStatement"], true);
  const pathsReturnOrThrow = pathsReachNodeTypes(["ReturnStatement", "ThrowStatement"], true);
  const pathsReturnOrThrowCurrentNodes = pathsReachNodeTypes(["ReturnStatement", "ThrowStatement"], false);
  const pathsBreak = pathsReachNodeTypes(["BreakStatement"], true);
  const pathsBreakReturnOrThrow = pathsReachNodeTypes(["ReturnStatement", "ThrowStatement", "BreakStatement"], true);
  function isNonEmptyStatement(statement) {
    return !types.isEmptyStatement(statement);
  }
  function expressionInSingleReturnStatement(target) {
    const body = target.body;
    if (types.isBlockStatement(body)) {
      const statements = body.body.filter(isNonEmptyStatement);
      if (statements.length === 0) {
        return voidExpression();
      } else {
        const firstStatement = statements[0];
        if (types.isReturnStatement(firstStatement)) {
          return firstStatement.argument || voidExpression();
        }
      }
    } else {
      return body;
    }
  }
  function propertyNameOfMemberExpression(node) {
    const property = node.property;
    if (node.computed) {
      if (types.isStringLiteral(property)) {
        return property.value;
      }
    } else {
      if (types.isIdentifier(property)) {
        return property.name;
      }
    }
  }
  function identifiersInForToLengthStatement(statement) {
    const init = statement.get("init");
    if (init.isVariableDeclaration() && init.node.declarations.length === 1) {
      const declaration = init.get("declarations")[0];
      if (types.isNumericLiteral(declaration.node.init) && declaration.node.init.value === 0) {
        const i = declaration.node.id;
        const test = statement.get("test");
        if (types.isIdentifier(i) && test.isBinaryExpression() && test.node.operator === "<" && types.isIdentifier(test.node.left) && test.node.left.name === i.name) {
          const right = test.get("right");
          if (right.isMemberExpression()) {
            const object = right.node.object;
            if (types.isIdentifier(object) && propertyNameOfMemberExpression(right.node) === "length") {
              const update = statement.get("update");
              if (update.isUpdateExpression() && update.node.operator == "++" && types.isIdentifier(update.node.argument) && update.node.argument.name === i.name) {
                const binding = statement.scope.getBinding(i.name);
                if (binding) {
                  const updateArgument = update.get("argument");
                  if (!binding.constantViolations.some(cv => cv !== updateArgument && cv !== update)) {
                    return {
                      i,
                      array: object
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  function extractForOwnBodyPath(path) {
    let left = path.get("left");
    if (left.isVariableDeclaration()) {
      left = left.get("declarations")[0].get("id");
    }
    const right = path.get("right");
    if (left.isIdentifier() && right.isIdentifier()) {
      const rightBinding = path.scope.getBinding(right.node.name);
      if (rightBinding && rightBinding.constant) {
        let body = path.get("body");
        for (;;) {
          let statements;
          if (body.isBlockStatement()) {
            statements = body.get("body");
          } else if (body.isReturnStatement()) {
            const argument = body.get("argument");
            if (argument.isCallExpression() && invokeTypeOfExpression(argument) && argument.get("arguments").length === 1) {
              const firstArgument = argument.get("arguments")[0];
              if (firstArgument.isFunctionExpression()) {
                statements = firstArgument.get("body").get("body");
              } else {
                break;
              }
            } else {
              break;
            }
          } else {
            break;
          }
          if (statements.length !== 1) {
            return;
          }
          body = statements[0];
        }
        if (body.isIfStatement() && !body.node.alternate) {
          const test = body.get("test");
          if (test.isCallExpression() && test.node.arguments.length === 2) {
            const args = test.get("arguments");
            const firstArg = args[0];
            const secondArg = args[1];
            if (firstArg.isIdentifier() && firstArg.node.name === right.node.name && secondArg.isIdentifier() && secondArg.node.name === left.node.name) {
              const callee = test.get("callee");
              if (callee.isMemberExpression() && propertyNameOfMemberExpression(callee.node) === "call") {
                let method = callee.get("object");
                if (method.isMemberExpression() && propertyNameOfMemberExpression(method.node) === "hasOwnProperty") {
                  let target = method.get("object");
                  if (target.isObjectExpression() && target.node.properties.length === 0) {
                    return body.get("consequent");
                  }
                  if (target.isMemberExpression() && propertyNameOfMemberExpression(target.node) === "prototype") {
                    target = target.get("object");
                  }
                  if (target.isIdentifier() && target.node.name === "Object") {
                    return body.get("consequent");
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  function isContinuation(possible) {
    return types.isFunctionExpression(possible) && possible.id === null || types.isArrowFunctionExpression(possible);
  }
  function isPassthroughContinuation(continuation) {
    if (continuation) {
      if (isContinuation(continuation) && continuation.params.length === 1) {
        const expression = expressionInSingleReturnStatement(continuation);
        if (expression) {
          const firstParam = continuation.params[0];
          if (types.isIdentifier(firstParam)) {
            const valueName = firstParam.name;
            if (types.isIdentifier(expression) && expression.name === valueName) {
              return true;
            }
            if (types.isConditionalExpression(expression) && types.isIdentifier(expression.test) && types.isIdentifier(expression.consequent) && expression.consequent.name === valueName && types.isIdentifier(expression.alternate) && expression.alternate.name === valueName) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  function isEmptyContinuation(continuation) {
    if (types.isIdentifier(continuation)) {
      return helperNameMap.get(continuation) === "_empty";
    }
    if (isContinuation(continuation)) {
      const body = continuation.body;
      if (types.isBlockStatement(body)) {
        return body.body.length === 0;
      }
    }
    return false;
  }
  function voidExpression(arg) {
    return types.unaryExpression("void", arg || types.numericLiteral(0));
  }
  function simplifyWithIdentifier(expression, identifier, truthy) {
    if (types.isCallExpression(expression)) {
      switch (promiseCallExpressionType(expression)) {
        case "all":
        case "race":
        case "reject":
        case "resolve":
          {
            const firstArgument = expression.arguments[0];
            if (types.isExpression(firstArgument)) {
              const simplified = simplifyWithIdentifier(firstArgument, identifier, truthy);
              return simplified === expression.arguments[0] ? expression : types.callExpression(expression.callee, [simplified]);
            }
          }
        case "then":
          {
            const callee = expression.callee;
            if (types.isMemberExpression(callee)) {
              const thenArgument = expression.arguments[0];
              const object = callee.object;
              if (types.isCallExpression(object)) {
                const valueArgument = object.arguments[0];
                if (types.isExpression(valueArgument) && types.isExpression(thenArgument)) {
                  const simplified = simplifyWithIdentifier(valueArgument, identifier, truthy);
                  return simplified === valueArgument ? expression : callThenMethod(types.callExpression(object.callee, [simplified]), thenArgument);
                }
              }
            }
          }
      }
      if (expression.arguments.length === 1 && types.isIdentifier(expression.callee) || isContinuation(expression.callee)) {
        const firstArgument = expression.arguments[0];
        if (types.isExpression(firstArgument)) {
          const simplified = simplifyWithIdentifier(firstArgument, identifier, truthy);
          return simplified === expression.arguments[0] ? expression : types.callExpression(expression.callee, [simplified]);
        }
      }
    }
    if (types.isConditionalExpression(expression) && types.isIdentifier(expression.test) && expression.test.name === identifier.name) {
      return truthy ? expression.consequent : expression.alternate;
    }
    if (types.isLogicalExpression(expression) && types.isIdentifier(expression.left) && expression.left.name === identifier.name) {
      if (expression.operator === "&&") {
        return truthy ? expression.right : expression.left;
      }
      if (expression.operator === "||") {
        return truthy ? expression.left : expression.right;
      }
    }
    return expression;
  }
  function isIdentifierOrLiteral(expression) {
    return types.isIdentifier(expression) || types.isLiteral(expression);
  }
  function simpleExpressionForContinuation(continuation, value) {
    if (isContinuation(continuation)) {
      let expression = expressionInSingleReturnStatement(continuation);
      if (expression) {
        switch (continuation.params.length) {
          case 0:
            if (types.isConditionalExpression(expression) && isIdentifierOrLiteral(expression.test) && isIdentifierOrLiteral(expression.consequent) && isIdentifierOrLiteral(expression.alternate) || (types.isLogicalExpression(expression) || types.isBinaryExpression(expression)) && isIdentifierOrLiteral(expression.left) && isIdentifierOrLiteral(expression.right) || types.isUnaryExpression(expression) && isIdentifierOrLiteral(expression.argument) || types.isCallExpression(expression) && isIdentifierOrLiteral(expression.callee) && expression.arguments.length === 0 || isIdentifierOrLiteral(expression)) {
              return expression;
            }
            break;
          case 1:
            {
              if (!value) {
                return;
              }
              const firstParam = continuation.params[0];
              const replace = expr => types.isIdentifier(firstParam) && types.isIdentifier(expr) && expr.name === firstParam.name ? value : discardingIntrinsics(expr);
              if (isIdentifierOrLiteral(expression)) {
                return replace(expression);
              }
              if (types.isConditionalExpression(expression) && isIdentifierOrLiteral(expression.test) && isIdentifierOrLiteral(expression.consequent) && isIdentifierOrLiteral(expression.alternate)) {
                return types.conditionalExpression(replace(expression.test), replace(expression.consequent), replace(expression.alternate));
              }
              if (types.isLogicalExpression(expression) && isIdentifierOrLiteral(expression.left) && isIdentifierOrLiteral(expression.right)) {
                return types.logicalExpression(expression.operator, replace(expression.left), replace(expression.right));
              }
              if (types.isBinaryExpression(expression) && isIdentifierOrLiteral(expression.left) && isIdentifierOrLiteral(expression.right)) {
                return types.binaryExpression(expression.operator, replace(expression.left), replace(expression.right));
              }
              if (types.isCallExpression(expression) && isIdentifierOrLiteral(expression.callee) && expression.arguments.length === 0) {
                return types.callExpression(replace(expression.callee), expression.arguments);
              }
            }
        }
      }
    }
  }
  function awaitAndContinue(state, path, value, continuation, directExpression) {
    const declarators = [];
    if (continuation) {
      if (isPassthroughContinuation(continuation)) {
        continuation = undefined;
      } else {
        continuation = unwrapReturnCallWithPassthroughArgument(continuation, path.scope);
      }
    }
    if (!continuation && directExpression && extractLooseBooleanValue(directExpression) === true) {
      return {
        declarators,
        expression: value
      };
    }
    if (types.isCallExpression(value) && value.arguments.length === 0 && isContinuation(value.callee) && value.callee.params.length === 0) {
      const newValue = expressionInSingleReturnStatement(value.callee);
      if (newValue) {
        value = newValue;
      }
    }
    if (continuation && !directExpression && types.isCallExpression(value) && types.isMemberExpression(value.callee) && helperNameMap.get(value.callee) === "_yield") {
      return {
        declarators,
        expression: callThenMethod(value, continuation)
      };
    }
    if (readConfigKey(state.opts, "inlineHelpers")) {
      if (directExpression) {
        const resolvedValue = types.callExpression(promiseResolve(), [value]);
        const direct = extractLooseBooleanValue(directExpression);
        if (typeof direct === "undefined") {
          let expression;
          if (continuation) {
            let simpleExpression;
            if (!types.isIdentifier(continuation) && !(simpleExpression = simpleExpressionForContinuation(continuation, isIdentifierOrLiteral(value) ? value : undefined))) {
              const id = path.scope.generateUidIdentifier("temp");
              if (isContinuation(continuation)) {
                if (!path.parentPath) {
                  throw path.buildCodeFrameError(`Expected a parent path!`, Error);
                }
                insertFunctionIntoScope(continuation, id, path.parentPath.scope);
              } else {
                declarators.push(types.variableDeclarator(id, continuation));
              }
              continuation = id;
            }
            expression = conditionalExpression(directExpression, simpleExpression || types.callExpression(continuation, [value]), callThenMethod(resolvedValue, continuation));
          } else {
            expression = conditionalExpression(directExpression, value, resolvedValue);
          }
          return {
            declarators,
            expression
          };
        } else if (direct) {
          return {
            declarators,
            expression: continuation ? types.callExpression(continuation, [value]) : value
          };
        } else {
          return {
            declarators,
            expression: continuation ? callThenMethod(resolvedValue, continuation) : resolvedValue
          };
        }
      } else if (continuation) {
        if (!types.isIdentifier(value)) {
          if (types.isCallExpression(value) && promiseCallExpressionType(value) !== undefined) {
            return {
              declarators,
              expression: callThenMethod(value, continuation)
            };
          }
          const id = path.scope.generateUidIdentifier("temp");
          declarators.push(types.variableDeclarator(id, value));
          value = id;
        }
        const isEmpty = isEmptyContinuation(continuation);
        let simpleExpression;
        if (!isEmpty && !types.isIdentifier(continuation) && !(simpleExpression = simpleExpressionForContinuation(continuation, value))) {
          const id = path.scope.generateUidIdentifier("temp");
          if (isContinuation(continuation)) {
            if (!path.parentPath) {
              throw path.buildCodeFrameError(`Expected a parent path!`, Error);
            }
            insertFunctionIntoScope(continuation, id, path.parentPath.scope);
          } else {
            declarators.push(types.variableDeclarator(id, continuation));
          }
          continuation = id;
        }
        return {
          declarators,
          expression: types.conditionalExpression(types.logicalExpression("&&", value, types.memberExpression(value, types.identifier("then"))), callThenMethod(value, continuation), simpleExpression ? simpleExpression : isEmpty ? voidExpression() : types.callExpression(continuation, [value]))
        };
      }
    }
    const callTarget = types.isCallExpression(value) && value.arguments.length === 0 && !types.isMemberExpression(value.callee) ? value.callee : undefined;
    const args = [callTarget || value];
    const ignoreResult = continuation && isEmptyContinuation(continuation);
    if (!ignoreResult && continuation) {
      args.push(continuation);
    }
    if (directExpression && extractLooseBooleanValue(directExpression) !== false) {
      if (!ignoreResult && !continuation) {
        args.push(voidExpression());
      }
      args.push(directExpression);
    }
    const baseHelper = directExpression ? callTarget ? "_call" : "_await" : callTarget ? "_invoke" : "_continue";
    const helperName = ignoreResult ? baseHelper + "Ignored" : baseHelper;
    if (args.length === 1) {
      switch (helperName) {
        case "_invoke":
          return {
            declarators,
            expression: types.callExpression(args[0], [])
          };
        case "_continue":
          return {
            declarators,
            expression: discardingIntrinsics(args[0])
          };
        case "_continueIgnored":
          const firstArgument = args[0];
          if (types.isCallExpression(firstArgument) && (types.isIdentifier(firstArgument.callee) || types.isMemberExpression(firstArgument.callee))) {
            if (helperNameMap.get(firstArgument.callee) === "_continueIgnored") {
              return {
                declarators,
                expression: firstArgument
              };
            }
          }
      }
    }
    return {
      declarators,
      expression: types.callExpression(helperReference(state, path, helperName), args.map(discardingIntrinsics))
    };
  }
  function borrowTail(target) {
    let current = target;
    const dest = [];
    while (current && current.node && current.inList && current.container) {
      const siblings = current.getAllNextSiblings();
      for (const sibling of siblings) {
        sibling.assertStatement();
        dest.push(sibling.node);
      }
      for (const sibling of siblings) {
        sibling.remove();
      }
      current = current.parentPath;
      if (!current || !current.isBlockStatement()) {
        break;
      }
    }
    return dest;
  }
  function exitsInTail(target) {
    let current = target;
    while (current && current.node && current.inList && current.container && !current.isFunction()) {
      for (var i = current.key + 1; i < current.container.length; i++) {
        if (pathsReturnOrThrow(current).any) {
          return true;
        }
      }
      current = current.parentPath;
    }
    return false;
  }
  function returnStatement(argument, originalNode) {
    const result = types.returnStatement(argument);
    skipNodeSet.add(result);
    if (originalNode !== undefined) {
      originalNodeMap.set(result, originalNode);
    }
    return result;
  }
  function removeUnnecessaryReturnStatements(blocks) {
    while (blocks.length) {
      const lastStatement = blocks[blocks.length - 1];
      if (types.isReturnStatement(lastStatement)) {
        if (lastStatement.argument === null || lastStatement.argument === undefined) {
          blocks = blocks.slice(0, blocks.length - 1);
        } else {
          if (types.isConditionalExpression(lastStatement.argument) && types.isUnaryExpression(lastStatement.argument.alternate) && lastStatement.argument.alternate.operator === "void" && isValueLiteral(lastStatement.argument.alternate.argument)) {
            blocks = blocks.slice(0, blocks.length - 1);
            blocks.push(types.ifStatement(lastStatement.argument.test, types.returnStatement(lastStatement.argument.consequent)));
          } else if (blocks.length > 1) {
            const previousStatement = blocks[blocks.length - 2];
            if (types.isIfStatement(previousStatement) && !previousStatement.alternate) {
              let consequent = previousStatement.consequent;
              while (types.isBlockStatement(consequent)) {
                if (consequent.body.length !== 1) {
                  return blocks;
                }
                consequent = consequent.body[0];
              }
              if (types.isReturnStatement(consequent) && consequent.argument) {
                blocks = blocks.slice(0, blocks.length - 2);
                blocks.push(types.returnStatement(conditionalExpression(previousStatement.test, consequent.argument, lastStatement.argument)));
              }
            }
          }
          break;
        }
      } else {
        if (types.isIfStatement(lastStatement)) {
          let consequent = lastStatement.consequent;
          if (types.isBlockStatement(consequent)) {
            consequent = blockStatement(removeUnnecessaryReturnStatements(consequent.body));
          }
          let alternate = lastStatement.alternate;
          if (alternate) {
            if (types.isBlockStatement(alternate)) {
              const removedOfUnnecessary = removeUnnecessaryReturnStatements(alternate.body);
              alternate = removedOfUnnecessary.length ? blockStatement(removedOfUnnecessary) : undefined;
            } else if (removeUnnecessaryReturnStatements([alternate]).length === 0) {
              alternate = undefined;
            }
          }
          if (consequent !== lastStatement.consequent || alternate !== lastStatement.alternate) {
            blocks = blocks.slice(0, blocks.length - 1);
            blocks.push(types.ifStatement(lastStatement.test, consequent, alternate || undefined));
          }
        }
        break;
      }
    }
    return blocks;
  }
  function rewriteAsyncNode(state, parentPath, node, additionalConstantNames, exitIdentifier, unpromisify) {
    const path = pathForNewNode(node, parentPath);
    rewriteAsyncBlock(state, path, additionalConstantNames, exitIdentifier, unpromisify);
    return path.node;
  }
  function allScopes(scope) {
    const result = [];
    while (scope) {
      result.push(scope);
      scope = scope.parent;
    }
    return result;
  }
  const hoistCallArgumentsInnerVisitor = {
    Identifier(identifierPath) {
      if (identifierSearchesScope(identifierPath)) {
        const name = identifierPath.node.name;
        if (this.argumentNames.indexOf(name) === -1) {
          if (this.additionalConstantNames.indexOf(name) !== -1) {
            this.scopes.push(this.path.scope.parent);
          } else {
            const binding = identifierPath.scope.getBinding(name) || this.path.scope.getBinding(name);
            if (binding) {
              const scope = binding.scope;
              if (scope !== null) {
                if (this.pathScopes.indexOf(scope) !== -1) {
                  this.scopes.push(scope);
                }
              }
            }
          }
        }
      }
    }
  };
  function isValueLiteral(node) {
    return types.isStringLiteral(node) || types.isNumericLiteral(node) || types.isBooleanLiteral(node);
  }
  function keyFilter(key, value) {
    return key === "start" || key === "end" || key === "loc" || key === "directives" || key === "leadingComments" || key === "trailingComments" || key === "innerComments" || key[0] === "_" ? undefined : value;
  }
  function nodesAreEquivalent(node) {
    let cached;
    return other => {
      if (typeof cached === "undefined") {
        cached = JSON.stringify(node, keyFilter);
      }
      return cached === JSON.stringify(other, keyFilter);
    };
  }
  const reregisterVariableVisitor = {
    VariableDeclaration(path) {
      path.scope.registerDeclaration(path);
    },
    FunctionDeclaration(path) {
      path.parentPath.scope.registerDeclaration(path);
    },
    ClassDeclaration(path) {
      path.scope.registerDeclaration(path);
    },
    Function(path) {
      path.skip();
    }
  };
  function insertFunctionIntoScope(func, id, scope) {
    scope.push({
      kind: "const",
      id,
      init: func,
      unique: true
    });
    const binding = scope.getBinding(id.name);
    if (typeof binding === "undefined") {
      throw scope.path.buildCodeFrameError(`Could not find newly created binding for ${id.name}!`, Error);
    }
    const targetPath = binding.path.parentPath;
    if (!targetPath) {
      throw scope.path.buildCodeFrameError(`Could not find newly created binding for ${id.name}!`, Error);
    }
    targetPath.replaceWith(types.functionDeclaration(id, func.params, types.isBlockStatement(func.body) ? func.body : types.blockStatement([types.returnStatement(func.body)]), func.generator, func.async));
    reregisterDeclarations(targetPath);
  }
  function hoistFunctionExpressionHandler(path) {
    path.skip();
    const bodyPath = path.get("body");
    if (bodyPath.isBlockStatement() && bodyPath.node.body.length === 0 && !readConfigKey(this.state.opts, "inlineHelpers")) {
      path.replaceWith(emptyFunction(this.state, path));
      return;
    }
    const argumentNames = [];
    for (const param of path.node.params) {
      if (types.isIdentifier(param) || types.isPattern(param) || types.isRestElement(param)) {
        addConstantNames(argumentNames, param);
      } else {
        return;
      }
    }
    const scopes = [];
    const pathScopes = allScopes(path.scope.parent);
    path.traverse(hoistCallArgumentsInnerVisitor, {
      argumentNames,
      scopes,
      pathScopes,
      path,
      additionalConstantNames: this.additionalConstantNames
    });
    let scope = path.scope.getProgramParent();
    let ancestry = [scope];
    for (let otherScope of scopes) {
      if (ancestry.indexOf(otherScope) === -1) {
        scope = otherScope;
        ancestry = ancestry.concat(allScopes(otherScope));
      }
    }
    if (ancestry.indexOf(path.scope.parent) === -1) {
      const bindings = scope.bindings;
      const filter = nodesAreEquivalent([...path.node.params, path.node.body]);
      for (const key of Object.getOwnPropertyNames(bindings)) {
        const binding = bindings[key];
        const bindingPath = binding.path;
        if (bindingPath.isFunctionDeclaration()) {
          if (filter([...bindingPath.node.params, bindingPath.node.body])) {
            path.replaceWith(binding.identifier);
            return;
          }
        } else if (bindingPath.isVariableDeclarator()) {
          const init = bindingPath.get("init");
          if (init.node && isContinuation(init.node)) {
            if (filter([...init.node.params, init.node.body])) {
              path.replaceWith(binding.identifier);
              return;
            }
          }
        }
      }
      let nameNode = path.node;
      if (types.isExpression(nameNode) && isContinuation(nameNode)) {
        nameNode = nameNode.body;
      }
      if (types.isBlockStatement(nameNode) && nameNode.body.length === 1) {
        nameNode = nameNode.body[0];
      }
      if (types.isReturnStatement(nameNode) && nameNode.argument) {
        nameNode = nameNode.argument;
      }
      if (types.isCallExpression(nameNode)) {
        const callee = nameNode.callee;
        if (types.isIdentifier(callee) && helperNameMap.has(callee)) {
          nameNode = nameNode.arguments[0];
        }
      }
      const id = isValueLiteral(nameNode) ? scope.generateUidIdentifier(nameNode.value.toString().replace(/\d/g, number => numberNames[number])) : path.scope.generateUidIdentifierBasedOnNode(nameNode, "temp");
      const init = path.node;
      path.replaceWith(id);
      insertFunctionIntoScope(init, id, scope);
    }
  }
  const hoistCallArgumentsVisitor = {
    FunctionExpression: hoistFunctionExpressionHandler,
    ArrowFunctionExpression: hoistFunctionExpressionHandler
  };
  function hoistCallArguments(state, path, additionalConstantNames) {
    if (path.isCallExpression()) {
      const callee = path.node.callee;
      if ((types.isIdentifier(callee) || types.isMemberExpression(callee)) && helperNameMap.has(callee)) {
        const functionParent = path.getFunctionParent();
        if (functionParent) {
          const scope = functionParent.scope;
          if (scope.crawl) {
            scope.crawl();
          }
        }
        path.traverse(hoistCallArgumentsVisitor, {
          state,
          additionalConstantNames
        });
      }
    }
  }
  function checkPathValidity(path) {
    if (path.container === null) {
      throw path.buildCodeFrameError(`Path was expected to have a container!`, TypeError);
    }
    if ("resync" in path && typeof path.resync === "function") {
      path.resync();
      if (path.container === null) {
        throw path.buildCodeFrameError(`Path was expected to have a container, and lost its container upon resync!`, TypeError);
      }
    }
  }
  function relocateTail(generatorState, awaitExpression, statementNode, target, additionalConstantNames, temporary, exitCheck, directExpression, skipReturns) {
    checkPathValidity(target);
    const tail = borrowTail(target);
    checkPathValidity(target);
    let originalNode = types.isStatement(target.node) ? target.node : types.expressionStatement(target.node);
    const rewrittenTail = statementNode || tail.length ? rewriteAsyncNode(generatorState, target, blockStatement((statementNode ? [statementNode] : []).concat(tail)), additionalConstantNames).body : [];
    checkPathValidity(target);
    let blocks = removeUnnecessaryReturnStatements(rewrittenTail.filter(isNonEmptyStatement));
    checkPathValidity(target);
    let replacement;
    if (blocks.length) {
      if (exitCheck) {
        if (temporary && !types.isIdentifier(temporary)) {
          const temporaryIdentifier = temporary = target.scope.generateUidIdentifier("temp");
          const declaration = types.variableDeclaration("const", [types.variableDeclarator(temporary, temporaryIdentifier)]);
          blocks = [declaration].concat(blocks);
          temporary = temporaryIdentifier;
        }
        if (temporary !== undefined) {
          blocks = removeUnnecessaryReturnStatements([types.ifStatement(exitCheck, returnStatement(temporary))].concat(blocks));
        } else {
          const minify = readConfigKey(generatorState.state.opts, "minify");
          blocks = removeUnnecessaryReturnStatements([types.ifStatement(logicalNot(exitCheck, minify), blocks.length === 1 ? blocks[0] : blockStatement(blocks))]);
        }
      }
      const fn = functionize(generatorState.state, temporary ? [temporary] : [], blockStatement(blocks), target);
      replacement = awaitAndContinue(generatorState.state, target, awaitExpression, fn, directExpression);
      originalNode = types.blockStatement([originalNode].concat(tail));
    } else if (pathsReturnOrThrow(target).any || target.parentPath.isArrowFunctionExpression()) {
      replacement = awaitAndContinue(generatorState.state, target, awaitExpression, undefined, directExpression);
    } else {
      replacement = awaitAndContinue(generatorState.state, target, awaitExpression, emptyFunction(generatorState.state, target), directExpression);
    }
    checkPathValidity(target);
    if (target.isExpression() && target.parentPath.isArrowFunctionExpression()) {
      target.replaceWith(replacement.expression);
    } else if (skipReturns) {
      target.replaceWith(replacement.expression);
    } else if (target.isBlockStatement() && target.parentPath.isFunctionExpression()) {
      target.replaceWith(types.blockStatement([returnStatement(replacement.expression, originalNode)]));
    } else {
      target.replaceWith(returnStatement(replacement.expression, originalNode));
    }
    if (replacement.declarators.length) {
      reregisterDeclarations(target.insertBefore(types.variableDeclaration("const", replacement.declarators)));
    }
    if (readConfigKey(generatorState.state.opts, "hoist")) {
      if (target.isExpression()) {
        hoistCallArguments(generatorState.state, target, additionalConstantNames);
      } else if (target.isReturnStatement()) {
        const argument = target.get("argument");
        if (argument.node) {
          hoistCallArguments(generatorState.state, argument, additionalConstantNames);
        }
      }
    }
  }
  function rewriteToNamedConstant(targetPath, callback) {
    const declarators = Object.create(null);
    return callback((name, path) => {
      if (Object.hasOwnProperty.call(declarators, name)) {
        const id = declarators[name].id;
        const binding = targetPath.scope.getBinding(id.name);
        if (!binding || binding.path.get("init") !== path) {
          path.replaceWith(types.identifier(id.name));
        }
      } else {
        const id = path.scope.generateUidIdentifier(name);
        const init = path.node;
        path.replaceWith(id);
        const declarator = declarators[name] = {
          kind: "const",
          id,
          init
        };
        let skip = false;
        if (targetPath.isClassMethod() && targetPath.node.kind === "constructor") {
          targetPath.traverse({
            Super(path) {
              if (!skip && path.parentPath.isCallExpression() && path.parentPath.get("callee") === path) {
                path.stop();
                path.getStatementParent().insertAfter(types.variableDeclaration("const", [types.variableDeclarator(id, init)]));
                skip = true;
              }
            }
          });
        }
        if (!skip) {
          targetPath.scope.push(declarator);
        }
        const binding = targetPath.scope.getBinding(id.name);
        if (binding) {
          binding.path.skip();
        }
      }
    });
  }
  const rewriteThisVisitor = {
    Function(path) {
      if (!path.isArrowFunctionExpression()) {
        path.skip();
      }
    },
    ThisExpression(path) {
      this.rewrite("this", path);
    }
  };
  function rewriteThisExpressions(rewritePath, targetPath) {
    rewriteToNamedConstant(targetPath, rewrite => rewritePath.traverse(rewriteThisVisitor, {
      rewrite
    }));
  }
  function identifiersInLVal(id, result = []) {
    switch (id.type) {
      case "Identifier":
        result.push(id);
        break;
      case "AssignmentPattern":
        identifiersInLVal(id.left);
        break;
      case "ArrayPattern":
        for (const element of id.elements) {
          if (types.isLVal(element)) {
            identifiersInLVal(element, result);
          }
        }
        break;
      case "RestElement":
        identifiersInLVal(id.argument, result);
        break;
      case "ObjectPattern":
        for (const property of id.properties) {
          if (types.isRestElement(property)) {
            identifiersInLVal(property.argument, result);
          } else if (types.isPattern(property.value) || types.isIdentifier(property.value)) {
            identifiersInLVal(property.value, result);
          }
        }
        break;
      default:
        throw new Error(`Unexpected node is not an LVal: ${id}`);
    }
    return result;
  }
  function anyIdentifiersRequireHoisting(identifiers, path) {
    const ancestry = path.getAncestry().reverse();
    for (const id of identifiers) {
      const binding = path.scope.getBinding(id.name);
      if (!binding) {
        return true;
      }
      const executingBeforePath = binding.referencePaths.find(referencePath => {
        if (!referencePath.willIMaybeExecuteBefore(path)) {
          return false;
        }
        const referenceAncestry = referencePath.getAncestry().reverse();
        const length = ancestry.length < referenceAncestry.length ? ancestry.length : referenceAncestry.length;
        for (let i = 1; i < length; i++) {
          if (ancestry[i] !== referenceAncestry[i]) {
            if (typeof ancestry[i].key === "number" && typeof referenceAncestry[i].key === "number" && ancestry[i].key < referenceAncestry[i].key) {
              return false;
            }
            if ((ancestry[i - 1].isForOfStatement() || ancestry[i - 1].isForInStatement()) && ancestry[i].key === "left") {
              return false;
            }
            if (ancestry[i - 1].isForStatement() && ancestry[i].key === "init") {
              return false;
            }
          }
        }
        return true;
      });
      if (executingBeforePath) {
        return true;
      }
      if (binding.referencePaths.length && path.getDeepestCommonAncestorFrom(binding.referencePaths.concat([path])) !== path.parentPath) {
        return true;
      }
    }
    return false;
  }
  const rewriteThisArgumentsAndHoistVisitor = {
    Function(path) {
      path.skip();
      if (path.isArrowFunctionExpression()) {
        path.traverse(rewriteThisVisitor, this);
      }
    },
    Super(path) {
      if (this.rewriteSuper) {
        const parent = path.parentPath;
        if (parent.isMemberExpression() && parent.get("object") === path) {
          const property = parent.get("property");
          if (parent.node.computed) {
            if (!property.isStringLiteral()) {
              throw path.buildCodeFrameError(`Expected a staticly resolvable super expression, got a computed expression of type ${property.node.type}`, TypeError);
            }
          }
          const grandparent = parent.parentPath;
          if (property.isIdentifier() && grandparent.isCallExpression() && grandparent.get("callee") === parent) {
            this.rewrite("super$" + property.node.name, parent);
            const args = grandparent.node.arguments.slice(0);
            args.unshift(types.thisExpression());
            grandparent.replaceWith(types.callExpression(types.memberExpression(parent.node, types.identifier("call")), args));
            reregisterDeclarations(grandparent);
          }
        }
      }
    },
    ThisExpression(path) {
      this.rewrite("this", path);
    },
    Identifier(path) {
      if (path.node.name === "arguments" && identifierSearchesScope(path)) {
        this.rewrite("arguments", path);
      }
    },
    VariableDeclaration(path) {
      if (path.node.kind === "var") {
        const declarations = path.get("declarations");
        const mapped = declarations.map(declaration => ({
          declaration,
          identifiers: identifiersInLVal(declaration.node.id)
        }));
        if (mapped.some(({
          identifiers
        }) => anyIdentifiersRequireHoisting(identifiers, path))) {
          if ((path.parentPath.isForInStatement() || path.parentPath.isForOfStatement()) && path.parentPath.get("left") === path && declarations.length === 1) {
            path.replaceWith(declarations[0].node.id);
          } else {
            const expressions = [];
            for (const {
              declaration
            } of mapped) {
              if (declaration.node.init) {
                expressions.push(types.assignmentExpression("=", declaration.node.id, declaration.node.init));
              }
            }
            clearDeclarationData(path);
            if (expressions.length === 0) {
              path.remove();
            } else if (expressions.length === 1) {
              path.replaceWith(expressions[0]);
            } else if (path.parentPath.isForStatement() && path.parentPath.get("init") === path) {
              path.replaceWith(types.sequenceExpression(expressions));
            } else {
              path.replaceWithMultiple(expressions.map(expression => types.expressionStatement(expression)));
            }
          }
          for (const {
            identifiers
          } of mapped) {
            for (const id of identifiers) {
              this.targetPath.scope.push({
                id
              });
            }
          }
        }
      }
    },
    FunctionDeclaration(path) {
      let targetPath = path;
      while (targetPath.parentPath.isBlockStatement()) {
        targetPath = targetPath.parentPath;
      }
      for (const sibling of path.getAllPrevSiblings()) {
        if (!sibling.isFunctionDeclaration()) {
          const node = path.node;
          path.remove();
          reregisterDeclarations(sibling.insertBefore(node));
          return;
        }
      }
    }
  };
  function rewriteThisArgumentsAndHoistFunctions(rewritePath, targetPath, rewriteSuper) {
    rewriteToNamedConstant(targetPath, rewrite => rewritePath.traverse(rewriteThisArgumentsAndHoistVisitor, {
      targetPath,
      rewrite,
      rewriteSuper
    }));
  }
  function translateTSParameterProperties(array) {
    return array.map(n => n.type === "TSParameterProperty" ? n.parameter : n);
  }
  function functionize(state, params, expression, target, id) {
    const translatedParams = translateTSParameterProperties(params);
    if (!id && readConfigKey(state.opts, "target") === "es6") {
      let newExpression = expression;
      if (types.isBlockStatement(newExpression) && newExpression.body.length === 1) {
        newExpression = newExpression.body[0];
      }
      if (types.isReturnStatement(newExpression) && newExpression.argument) {
        newExpression = newExpression.argument;
      }
      const result = types.arrowFunctionExpression(translatedParams, types.isStatement(newExpression) && !types.isBlockStatement(newExpression) ? types.blockStatement([newExpression]) : newExpression);
      let usesThisOrArguments = false;
      pathForNewNode(result, target).traverse({
        Function(path) {
          path.skip();
        },
        ThisExpression(path) {
          usesThisOrArguments = true;
          path.stop();
        },
        Identifier(path) {
          if (path.node.name === "arguments" && identifierSearchesScope(path)) {
            usesThisOrArguments = true;
            path.stop();
          }
        }
      });
      if (!usesThisOrArguments) {
        return result;
      }
    }
    if (types.isExpression(expression)) {
      expression = returnStatement(expression);
    }
    if (!types.isBlockStatement(expression)) {
      expression = blockStatement([expression]);
    }
    expression.body = removeUnnecessaryReturnStatements(expression.body);
    return types.functionExpression(id, translatedParams, expression);
  }
  function blockStatement(statementOrStatements) {
    if ("length" in statementOrStatements) {
      return types.blockStatement(statementOrStatements.filter(statement => !types.isEmptyStatement(statement)));
    } else if (!types.isBlockStatement(statementOrStatements)) {
      return types.blockStatement([statementOrStatements]);
    } else {
      return statementOrStatements;
    }
  }
  function unwrapReturnCallWithEmptyArguments(node, scope, additionalConstantNames) {
    if (isContinuation(node)) {
      const expression = expressionInSingleReturnStatement(node);
      if (expression && types.isCallExpression(expression)) {
        let callTarget;
        switch (expression.arguments.length) {
          case 0:
            callTarget = expression.callee;
            break;
          case 1:
            {
              const callee = expression.callee;
              const onlyArgument = expression.arguments[0];
              if (types.isIdentifier(callee) && helperNameMap.get(callee) === "_call") {
                callTarget = onlyArgument;
              }
              if (types.isIdentifier(callee) || types.isMemberExpression(callee)) {
                switch (helperNameMap.get(callee)) {
                  case "_await":
                  case "_promiseResolve":
                    if (types.isCallExpression(onlyArgument) && onlyArgument.arguments.length === 0) {
                      callTarget = onlyArgument.callee;
                    }
                    break;
                }
              }
              break;
            }
        }
        if (callTarget && types.isExpression(callTarget)) {
          if (types.isIdentifier(callTarget)) {
            const binding = scope.getBinding(callTarget.name);
            if (binding && binding.constant) {
              return callTarget;
            }
            if (additionalConstantNames.indexOf(callTarget.name) !== -1) {
              return callTarget;
            }
          } else if (isContinuation(callTarget)) {
            return unwrapReturnCallWithEmptyArguments(callTarget, scope, additionalConstantNames);
          }
        }
      }
    }
    return node;
  }
  function unwrapReturnCallWithPassthroughArgument(node, scope) {
    if (isContinuation(node) && node.params.length >= 1) {
      const expression = expressionInSingleReturnStatement(node);
      if (expression && types.isCallExpression(expression) && expression.arguments.length === 1) {
        const firstArgument = expression.arguments[0];
        const firstParam = node.params[0];
        if (types.isIdentifier(firstArgument) && types.isIdentifier(firstParam) && firstArgument.name === firstParam.name) {
          if (types.isIdentifier(expression.callee)) {
            const binding = scope.getBinding(expression.callee.name);
            if (binding && binding.constant) {
              return expression.callee;
            }
            if (Object.hasOwnProperty.call(constantStaticMethods, expression.callee.name)) {
              return expression.callee;
            }
          } else if (types.isMemberExpression(expression.callee)) {
            const propertyName = propertyNameOfMemberExpression(expression.callee);
            if (propertyName !== undefined) {
              const object = expression.callee.object;
              if (types.isIdentifier(object) && Object.hasOwnProperty.call(constantStaticMethods, object.name) && !scope.getBinding(object.name)) {
                const staticMethods = constantStaticMethods[object.name];
                if (Object.hasOwnProperty.call(staticMethods, propertyName) && staticMethods[propertyName]) {
                  return expression.callee;
                }
              }
            }
          }
        }
      }
    }
    return node;
  }
  function isExpressionOfLiterals(path, literalNames) {
    if (path.node === null || path.node === undefined) {
      return true;
    }
    if (path.isIdentifier()) {
      const name = path.node.name;
      if (name === "undefined" && !path.scope.getBinding("undefined")) {
        return true;
      }
      const binding = path.parentPath.scope.getBinding(name);
      if (binding) {
        return binding.constant;
      }
      if (literalNames.indexOf(name) !== -1) {
        return true;
      }
      if (Object.hasOwnProperty.call(constantStaticMethods, name) && !path.scope.getBinding(name)) {
        return true;
      }
      return false;
    }
    if (path.isMemberExpression()) {
      const object = path.get("object");
      if (object.isIdentifier()) {
        const propertyName = propertyNameOfMemberExpression(path.node);
        if (propertyName !== undefined && Object.hasOwnProperty.call(constantStaticMethods, object.node.name) && !path.scope.getBinding(object.node.name)) {
          const staticMethods = constantStaticMethods[object.node.name];
          if (Object.hasOwnProperty.call(staticMethods, propertyName) && staticMethods[propertyName]) {
            return true;
          }
        }
      }
      return false;
    }
    if (path.isBooleanLiteral()) {
      return true;
    }
    if (path.isNumericLiteral()) {
      return true;
    }
    if (path.isStringLiteral()) {
      return true;
    }
    if (path.isArrayExpression()) {
      return path.get("elements").every(element => element === null || element.node === null ? true : isExpressionOfLiterals(element, literalNames));
    }
    if (path.isNullLiteral()) {
      return true;
    }
    if (path.isObjectExpression()) {
      return path.get("properties").every(property => {
        if (property.isObjectProperty()) {
          if (!property.node.computed || isExpressionOfLiterals(property.get("key"), literalNames)) {
            return isExpressionOfLiterals(property.get("value"), literalNames);
          }
        } else {
          return true;
        }
      });
    }
    if (path.isUnaryExpression()) {
      return isExpressionOfLiterals(path.get("argument"), literalNames);
    }
    if (path.isLogicalExpression()) {
      return isExpressionOfLiterals(path.get("left"), literalNames) && isExpressionOfLiterals(path.get("right"), literalNames);
    }
    if (path.isBinaryExpression()) {
      return isExpressionOfLiterals(path.get("left"), literalNames) && isExpressionOfLiterals(path.get("right"), literalNames);
    }
    if (path.isConditionalExpression()) {
      return isExpressionOfLiterals(path.get("test"), literalNames) && isExpressionOfLiterals(path.get("consequent"), literalNames) && isExpressionOfLiterals(path.get("alternate"), literalNames);
    }
    if (path.isExpression() && isContinuation(path.node)) {
      return true;
    }
    return false;
  }
  function generateIdentifierForPath(path) {
    const node = path.node;
    if (node) {
      const result = path.scope.generateUidIdentifierBasedOnNode(node, "temp");
      if (!path.isIdentifier() || path.node.name !== result.name) {
        return result;
      }
    }
    return path.scope.generateUidIdentifier("temp");
  }
  function booleanLiteral(value, minify) {
    return minify ? types.numericLiteral(value ? 1 : 0) : types.booleanLiteral(value);
  }
  function conditionalExpression(test, consequent, alternate) {
    const looseValue = extractLooseBooleanValue(test);
    if (typeof looseValue !== "undefined") {
      return looseValue ? consequent : alternate;
    }
    while (types.isUnaryExpression(test) && test.operator === "!") {
      test = test.argument;
      const temp = consequent;
      consequent = alternate;
      alternate = temp;
    }
    if (isValueLiteral(consequent) && isValueLiteral(alternate) && consequent.value === alternate.value || types.isNullLiteral(consequent) && types.isNullLiteral(alternate) || types.isIdentifier(consequent) && types.isIdentifier(alternate) && consequent.name === alternate.name) {
      if (types.isIdentifier(test)) {
        return consequent;
      }
    }
    if (types.isIdentifier(test)) {
      consequent = simplifyWithIdentifier(consequent, test, true);
      alternate = simplifyWithIdentifier(alternate, test, false);
    }
    return types.conditionalExpression(test, consequent, alternate);
  }
  function extractBooleanValue(node) {
    if (types.isBooleanLiteral(node)) {
      return node.value;
    }
    if (types.isUnaryExpression(node)) {
      if (node.operator === "!") {
        const result = extractLooseBooleanValue(node.argument);
        return typeof result === "undefined" ? undefined : !result;
      } else if (node.operator === "void") {
        return typeof extractLooseBooleanValue(node.argument) !== "undefined" ? false : undefined;
      }
    }
  }
  function extractLooseBooleanValue(node) {
    if (isValueLiteral(node)) {
      return !!node.value;
    }
    if (types.isNullLiteral(node)) {
      return false;
    }
    if (types.isIdentifier(node)) {
      if (alwaysTruthy.indexOf(node.name) !== -1) {
        return true;
      }
      if (node.name === "undefined") {
        return false;
      }
    }
    return extractBooleanValue(node);
  }
  function logicalOr(left, right) {
    if (extractLooseBooleanValue(left) === true) {
      return left;
    } else if (extractBooleanValue(left) === false) {
      return right;
    } else {
      return types.logicalExpression("||", left, right);
    }
  }
  function logicalOrLoose(left, right, minify) {
    switch (extractLooseBooleanValue(left)) {
      case false:
        return extractLooseBooleanValue(right) === false ? booleanLiteral(false, minify) : right;
      case true:
        return booleanLiteral(true, minify);
      default:
        switch (extractLooseBooleanValue(right)) {
          case false:
            return left;
          case true:
            return booleanLiteral(true, minify);
          default:
            return types.logicalExpression("||", left, right);
        }
    }
  }
  function logicalAnd(left, right, extract = extractBooleanValue) {
    switch (extract(left)) {
      case true:
        return left;
      case false:
        return right;
      default:
        return types.logicalExpression("&&", left, right);
    }
  }
  function logicalNot(node, minify) {
    const literalValue = extractLooseBooleanValue(node);
    if (typeof literalValue !== "undefined") {
      return booleanLiteral(!literalValue, minify);
    }
    if (types.isUnaryExpression(node) && node.operator === "!" && types.isUnaryExpression(node.argument) && node.argument.operator === "!") {
      return node.argument;
    }
    return types.unaryExpression("!", node);
  }
  function unwrapSpreadElement(path) {
    if (path.node === null) {
      return path;
    }
    if (path.node.type === "JSXNamespacedName") {
      return path;
    }
    if (path.isExpression()) {
      return path;
    }
    if (path.isSpreadElement()) {
      return path.get("argument");
    }
    if (isArgumentPlaceholder(path)) {
      return path;
    }
    throw path.buildCodeFrameError(`Expected either an expression or a spread element, got a ${path.type}!`, TypeError);
  }
  function findDeclarationToReuse(path) {
    while (path) {
      const parent = path.parentPath;
      if (parent === null) {
        break;
      }
      if (parent.isVariableDeclarator()) {
        const id = parent.get("id");
        if (id.isIdentifier() || id.isPattern()) {
          return parent;
        }
      }
      let other;
      if (parent.isConditionalExpression()) {
        const test = parent.get("test");
        if (path === test) {
          break;
        }
        const consequent = parent.get("consequent");
        const alternate = parent.get("alternate");
        other = consequent === path ? alternate : consequent;
      } else if (parent.isLogicalExpression()) {
        const left = parent.get("left");
        const right = parent.get("right");
        other = left === path ? right : left;
      } else {
        break;
      }
      const otherAwaitPath = findAwaitOrYieldPath(other);
      if (otherAwaitPath === other || !otherAwaitPath) {
        path = parent;
      } else {
        break;
      }
    }
  }
  function extractDeclarations(state, originalAwaitPath, awaitExpression, additionalConstantNames) {
    let awaitPath = originalAwaitPath;
    const reusingExisting = findDeclarationToReuse(awaitPath);
    const reusingExistingId = reusingExisting ? reusingExisting.get("id") : undefined;
    const existingIdentifier = reusingExistingId && (reusingExistingId.isIdentifier() || reusingExistingId.isPattern()) ? reusingExistingId.node : undefined;
    let resultIdentifier;
    if (!awaitPath.parentPath.isSequenceExpression() || !(awaitPath.key < awaitPath.container.length - 1)) {
      const argument = originalAwaitPath.get("argument");
      if (argument.isExpression()) {
        resultIdentifier = existingIdentifier || generateIdentifierForPath(argument);
      }
    }
    originalAwaitPath.replaceWith(types.isIdentifier(resultIdentifier) ? resultIdentifier : types.numericLiteral(0));
    let declarations = [];
    const isYield = originalAwaitPath.isYieldExpression();
    let directExpression = booleanLiteral(false, readConfigKey(state.opts, "minify"));
    for (;;) {
      const parent = awaitPath.parentPath;
      if (parent.isVariableDeclarator()) {
        const beforeDeclarations = [];
        let skipLiterals = true;
        for (let key = parent.key - 1; key >= 0; --key) {
          const sibling = parent.getSibling(key);
          if (sibling.isVariableDeclarator()) {
            const init = sibling.get("init");
            if (!skipLiterals || init && !isExpressionOfLiterals(init, additionalConstantNames)) {
              skipLiterals = false;
              beforeDeclarations.unshift(sibling.node);
              sibling.remove();
            }
          } else {
            throw sibling.buildCodeFrameError(`Expected a variable declarator, got a ${sibling.type}!`, TypeError);
          }
        }
        if (beforeDeclarations.length) {
          declarations = declarations.concat(beforeDeclarations.concat(declarations));
        }
      } else if (parent.isLogicalExpression()) {
        const left = parent.get("left");
        if (awaitPath !== left) {
          if (!isYield && !isExpressionOfLiterals(left, additionalConstantNames)) {
            const leftIdentifier = generateIdentifierForPath(left);
            declarations = declarations.map(declaration => declaration.init ? types.variableDeclarator(declaration.id, logicalAnd(parent.node.operator === "||" ? logicalNot(leftIdentifier) : leftIdentifier, declaration.init)) : declaration);
            declarations.unshift(types.variableDeclarator(leftIdentifier, left.node));
            left.replaceWith(leftIdentifier);
          }
          const isOr = parent.node.operator === "||";
          awaitExpression = (isOr ? logicalOr : logicalAnd)(left.node, awaitExpression);
          if (!isYield) {
            directExpression = logicalOrLoose(isOr ? left.node : logicalNot(left.node), directExpression, readConfigKey(state.opts, "minify"));
          }
          if (awaitPath === originalAwaitPath) {
            if (resultIdentifier) {
              parent.replaceWith(resultIdentifier);
            } else {
              resultIdentifier = existingIdentifier || generateIdentifierForPath(originalAwaitPath.get("argument"));
              parent.replaceWith(resultIdentifier);
            }
            awaitPath = parent;
            continue;
          }
        }
      } else if (parent.isBinaryExpression()) {
        const left = parent.get("left");
        if (awaitPath !== left) {
          if (!isExpressionOfLiterals(left, additionalConstantNames) && left.node.type !== "PrivateName") {
            const leftIdentifier = generateIdentifierForPath(left);
            declarations.unshift(types.variableDeclarator(leftIdentifier, left.node));
            left.replaceWith(leftIdentifier);
          }
        }
      } else if (parent.isSequenceExpression()) {
        const children = parent.get("expressions");
        const position = children.indexOf(awaitPath);
        for (var i = 0; i < position; i++) {
          const expression = children[i];
          if (!isExpressionOfLiterals(expression, additionalConstantNames)) {
            const sequenceIdentifier = generateIdentifierForPath(expression);
            declarations.unshift(types.variableDeclarator(sequenceIdentifier, expression.node));
          }
          expression.remove();
        }
        if (position === children.length - 1) {
          parent.replaceWith(children[position]);
        }
      } else if (parent.isConditionalExpression()) {
        const test = parent.get("test");
        if (awaitPath !== test) {
          let testNode = test.node;
          const consequent = parent.get("consequent");
          const alternate = parent.get("alternate");
          const other = consequent === awaitPath ? alternate : consequent;
          const otherAwaitPath = findAwaitOrYieldPath(other);
          let testIdentifier;
          const isBoth = consequent === awaitPath && otherAwaitPath === alternate;
          if (!(isBoth && awaitPath === originalAwaitPath) && !isExpressionOfLiterals(test, additionalConstantNames)) {
            testIdentifier = generateIdentifierForPath(test);
          }
          declarations = declarations.map(declaration => declaration.init ? types.variableDeclarator(declaration.id, (consequent === awaitPath ? logicalAnd : logicalOr)(testIdentifier || testNode, declaration.init)) : declaration);
          if (testIdentifier) {
            declarations.unshift(types.variableDeclarator(testIdentifier, testNode));
            test.replaceWith(testIdentifier);
            testNode = testIdentifier;
          }
          if (isBoth && otherAwaitPath) {
            awaitExpression = conditionalExpression(testNode, awaitExpression, otherAwaitPath.node.argument || types.identifier("undefined"));
            if (!resultIdentifier) {
              resultIdentifier = existingIdentifier || generateIdentifierForPath(originalAwaitPath.get("argument"));
            }
            alternate.replaceWith(resultIdentifier);
            parent.replaceWith(resultIdentifier);
          } else {
            if (!isYield) {
              directExpression = logicalOrLoose(consequent !== awaitPath ? testNode : logicalNot(testNode), directExpression, readConfigKey(state.opts, "minify"));
            }
            if (otherAwaitPath) {
              awaitExpression = consequent !== awaitPath ? conditionalExpression(testNode, types.numericLiteral(0), awaitExpression) : conditionalExpression(testNode, awaitExpression, types.numericLiteral(0));
            } else {
              awaitExpression = consequent !== awaitPath ? conditionalExpression(testNode, other.node, awaitExpression) : conditionalExpression(testNode, awaitExpression, other.node);
              if (!resultIdentifier) {
                resultIdentifier = existingIdentifier || generateIdentifierForPath(originalAwaitPath.get("argument"));
              }
              if (awaitPath === originalAwaitPath) {
                parent.replaceWith(resultIdentifier);
                awaitPath = parent;
                continue;
              }
              other.replaceWith(resultIdentifier);
            }
          }
        }
      } else if (parent.isCallExpression()) {
        const callee = parent.get("callee");
        if (callee !== awaitPath) {
          for (const arg of parent.get("arguments")) {
            const spreadArg = unwrapSpreadElement(arg);
            if (spreadArg === awaitPath || arg === awaitPath) {
              break;
            }
            if (spreadArg.isExpression() && !isExpressionOfLiterals(spreadArg, additionalConstantNames)) {
              const argIdentifier = generateIdentifierForPath(spreadArg);
              declarations.unshift(types.variableDeclarator(argIdentifier, spreadArg.node));
              spreadArg.replaceWith(argIdentifier);
            }
          }
          if (!isExpressionOfLiterals(callee, additionalConstantNames) && typeof promiseCallExpressionType(parent.node) === "undefined") {
            if (callee.isMemberExpression()) {
              const object = callee.get("object");
              const property = callee.get("property");
              let objectDeclarator;
              let staticMethods = {};
              let constantObject = false;
              if (object.isIdentifier() && Object.hasOwnProperty.call(constantStaticMethods, object.node.name) && !callee.scope.getBinding(object.node.name)) {
                constantObject = true;
                staticMethods = constantStaticMethods[object.node.name];
              } else if (isExpressionOfLiterals(object, additionalConstantNames)) {
                constantObject = true;
              }
              if (!constantObject) {
                const objectIdentifier = generateIdentifierForPath(object);
                objectDeclarator = types.variableDeclarator(objectIdentifier, object.node);
                object.replaceWith(objectIdentifier);
              }
              if (!callee.node.computed && property.isIdentifier() && (property.node.name === "call" || Object.hasOwnProperty.call(staticMethods, property.node.name))) ; else {
                const calleeIdentifier = generateIdentifierForPath(property);
                const calleeNode = callee.node;
                const newArguments = parent.node.arguments.slice();
                newArguments.unshift(Object.assign({}, object.node));
                parent.replaceWith(types.callExpression(types.memberExpression(calleeIdentifier, types.identifier("call")), newArguments));
                declarations.unshift(types.variableDeclarator(calleeIdentifier, calleeNode));
              }
              if (typeof objectDeclarator !== "undefined") {
                declarations.unshift(objectDeclarator);
              }
            } else if (!callee.isIdentifier() || !(helperNameMap.has(callee.node) || (awaitPath.scope.getBinding(callee.node.name) || {
              constant: false
            }).constant)) {
              const calleeIdentifier = generateIdentifierForPath(callee);
              const calleeNode = callee.node;
              callee.replaceWith(calleeIdentifier);
              declarations.unshift(types.variableDeclarator(calleeIdentifier, discardingIntrinsics(calleeNode)));
            }
          }
        }
      } else if (parent.isArrayExpression()) {
        for (const element of parent.get("elements")) {
          const spreadElement = unwrapSpreadElement(element);
          if (element === awaitPath || spreadElement === awaitPath) {
            break;
          }
          if (spreadElement.isExpression() && !isExpressionOfLiterals(spreadElement, additionalConstantNames)) {
            const elementIdentifier = generateIdentifierForPath(spreadElement);
            declarations.unshift(types.variableDeclarator(elementIdentifier, spreadElement.node));
            spreadElement.replaceWith(elementIdentifier);
          }
        }
      } else if (parent.isObjectExpression()) {
        for (const prop of parent.get("properties")) {
          if (prop === awaitPath) {
            break;
          }
          if (prop.isObjectProperty()) {
            if (prop.node.computed) {
              const propKey = prop.get("key");
              if (propKey === awaitPath) {
                break;
              }
              if (propKey.isExpression() && !isExpressionOfLiterals(propKey, additionalConstantNames)) {
                const keyIdentifier = generateIdentifierForPath(propKey);
                declarations.unshift(types.variableDeclarator(keyIdentifier, propKey.node));
                propKey.replaceWith(keyIdentifier);
              }
            }
            const propValue = prop.get("value");
            if (propValue === awaitPath) {
              break;
            }
            if (propValue.isExpression() && !isExpressionOfLiterals(propValue, additionalConstantNames)) {
              const propIdentifier = generateIdentifierForPath(propValue);
              declarations.unshift(types.variableDeclarator(propIdentifier, propValue.node));
              propValue.replaceWith(propIdentifier);
            }
          }
        }
      }
      if (parent.isStatement()) {
        return {
          declarationKind: reusingExisting ? reusingExisting.parent.kind : "const",
          declarations,
          awaitExpression,
          directExpression,
          reusingExisting,
          resultIdentifier
        };
      }
      awaitPath = parent;
    }
  }
  function skipNode(path) {
    path.skip();
  }
  const awaitPathVisitor = {
    Function: skipNode,
    AwaitExpression(path) {
      this.result = path;
      path.stop();
    },
    YieldExpression(path) {
      this.result = path;
      path.stop();
    }
  };
  function findAwaitOrYieldPath(path) {
    if (path.isAwaitExpression() || path.isYieldExpression()) {
      return path;
    }
    const state = Object.create(null);
    path.traverse(awaitPathVisitor, state);
    return state.result;
  }
  function buildBreakExitCheck(state, exitIdentifier, breakIdentifiers) {
    if (breakIdentifiers !== undefined && breakIdentifiers.length > 0) {
      const minify = readConfigKey(state.opts, "minify");
      const first = breakIdentifiers[0].identifier;
      const partial = breakIdentifiers.slice(1).reduce((accumulator, {
        identifier
      }) => logicalOrLoose(accumulator, identifier, minify), first);
      return exitIdentifier ? logicalOrLoose(partial, exitIdentifier, minify) : partial;
    } else {
      return exitIdentifier;
    }
  }
  function pushMissing(destination, source) {
    for (var value of source) {
      var index = destination.indexOf(value);
      if (index < 0) {
        destination.push(value);
      }
    }
  }
  function setBreakIdentifier(value, breakIdentifier) {
    return types.assignmentExpression("=", breakIdentifier.identifier, value);
  }
  function setBreakIdentifiers(breakIdentifiers, pluginState) {
    return breakIdentifiers.reduce(setBreakIdentifier, booleanLiteral(true, readConfigKey(pluginState.opts, "minify")));
  }
  function expressionNeverThrows(expression) {
    return isValueLiteral(expression) || types.isIdentifier(expression) || types.isUnaryExpression(expression) && isValueLiteral(expression.argument);
  }
  const replaceReturnsAndBreaksVisitor = {
    Function: skipNode,
    ReturnStatement(path) {
      if (!skipNodeSet.has(path.node) && this.exitIdentifier) {
        const minify = readConfigKey(this.pluginState.opts, "minify");
        if (path.node.argument) {
          if (minify && extractLooseBooleanValue(path.node.argument) === true) {
            path.replaceWith(returnStatement(types.assignmentExpression("=", this.exitIdentifier, path.node.argument), path.node));
          } else if (expressionNeverThrows(path.node.argument)) {
            path.replaceWithMultiple([types.expressionStatement(types.assignmentExpression("=", this.exitIdentifier, booleanLiteral(true, minify))), returnStatement(path.node.argument, path.node)]);
          } else {
            const tempIdentifier = path.scope.generateUidIdentifierBasedOnNode(path.node.argument, "temp");
            path.replaceWithMultiple([types.variableDeclaration("const", [types.variableDeclarator(tempIdentifier, path.node.argument)]), types.expressionStatement(types.assignmentExpression("=", this.exitIdentifier, booleanLiteral(true, minify))), returnStatement(tempIdentifier, path.node)]);
          }
        } else {
          path.replaceWithMultiple([types.expressionStatement(types.assignmentExpression("=", this.exitIdentifier, booleanLiteral(true, minify))), returnStatement(undefined, path.node)]);
        }
      }
    },
    SwitchStatement: {
      enter() {
        this.switchCount++;
      },
      exit() {
        this.switchCount--;
      }
    },
    Loop: {
      enter(path) {
        const parent = path.parentPath;
        this.breakIdentifiers.unshift({
          identifier: types.identifier("break"),
          path,
          name: parent.isLabeledStatement() ? parent.node.label.name : undefined,
          isAsync: false
        });
      },
      exit() {
        this.breakIdentifiers.shift();
      }
    },
    BreakStatement(path) {
      const label = path.node.label;
      if (label || this.switchCount === 0) {
        const index = label ? this.breakIdentifiers.findIndex(breakIdentifier => breakIdentifier.name === label.name) : 0;
        const replace = returnStatement(undefined, path.node);
        if (index !== -1 && this.breakIdentifiers.length) {
          if (!this.breakIdentifiers[index].isAsync) {
            return;
          }
          const used = this.breakIdentifiers.slice(0, index + 1);
          if (used.length) {
            pushMissing(this.usedIdentifiers, used);
            path.replaceWithMultiple([types.expressionStatement(setBreakIdentifiers(used, this.pluginState)), replace]);
            return;
          }
        }
        path.replaceWith(replace);
      }
    },
    ContinueStatement(path) {
      const label = path.node.label;
      const index = label ? this.breakIdentifiers.findIndex(breakIdentifier => breakIdentifier.name === label.name) : 0;
      const replace = returnStatement(undefined, path.node);
      if (index !== -1 && this.breakIdentifiers.length) {
        if (!this.breakIdentifiers[index].isAsync) {
          return;
        }
        const used = this.breakIdentifiers.slice(0, index);
        if (used.length) {
          pushMissing(this.usedIdentifiers, used);
          path.replaceWithMultiple([types.expressionStatement(setBreakIdentifiers(used, this.pluginState)), replace]);
          return;
        }
      }
      path.replaceWith(replace);
    }
  };
  function replaceReturnsAndBreaks(pluginState, path, exitIdentifier, existingUsedIdentifiers) {
    const usedIdentifiers = [];
    if (existingUsedIdentifiers !== undefined) {
      for (const item of existingUsedIdentifiers) {
        if (path.parentPath === null || path.parentPath.scope.getBinding(item.identifier.name) === path.scope.getBinding(item.identifier.name)) {
          usedIdentifiers.push(item);
        }
      }
    }
    const state = {
      pluginState,
      exitIdentifier,
      breakIdentifiers: breakContinueStackForPath(path),
      usedIdentifiers,
      switchCount: 0
    };
    path.traverse(replaceReturnsAndBreaksVisitor, state);
    for (const {
      identifier,
      path: identifierPath
    } of usedIdentifiers) {
      const parentScope = identifierPath.parentPath.scope;
      if (!parentScope.getBinding(identifier.name)) {
        parentScope.push({
          kind: "let",
          id: identifier,
          init: readConfigKey(pluginState.opts, "minify") ? undefined : booleanLiteral(false, readConfigKey(pluginState.opts, "minify"))
        });
      }
    }
    return usedIdentifiers;
  }
  function breakIdentifierForPath(path) {
    let result = breakIdentifierMap.get(path.node);
    if (!result) {
      result = path.scope.generateUidIdentifier(path.parentPath !== null && path.parentPath.isLabeledStatement() ? path.parentPath.node.label.name + "Interrupt" : "interrupt");
      breakIdentifierMap.set(path.node, result);
    }
    return result;
  }
  const simpleBreakOrContinueReferencesVisitor = {
    Function: skipNode,
    Loop: skipNode,
    SwitchStatement: skipNode,
    BreakStatement(path) {
      if (!path.node.label) {
        this.references.push(path);
      }
    },
    ReturnStatement(path) {
      const originalNode = originalNodeMap.get(path.node);
      if (originalNode) {
        traverse(wrapNodeInStatement(originalNode), simpleBreakOrContinueReferencesVisitor, path.scope, this, path);
        path.skip();
      }
    }
  };
  function simpleBreakOrContinueReferences(path) {
    const state = {
      references: []
    };
    path.traverse(simpleBreakOrContinueReferencesVisitor, state);
    return state.references;
  }
  const namedLabelReferencesVisitor = {
    Function: skipNode,
    BreakStatement(path) {
      if (path.node.label && path.node.label.name === this.name) {
        this.breaks.push(path);
      }
    },
    ContinueStatement(path) {
      if (path.node.label && path.node.label.name === this.name) {
        this.continues.push(path);
      }
    },
    ReturnStatement(path) {
      const originalNode = originalNodeMap.get(path.node);
      if (originalNode) {
        traverse(wrapNodeInStatement(originalNode), namedLabelReferencesVisitor, path.scope, this, path);
        path.skip();
      }
    }
  };
  function namedLabelReferences(labelPath, targetPath) {
    const state = {
      name: labelPath.node.label.name,
      breaks: [],
      continues: []
    };
    targetPath.traverse(namedLabelReferencesVisitor, state);
    return state;
  }
  function breakContinueStackForPath(path) {
    let current = path;
    const result = [];
    while (current && !current.isFunction()) {
      if (current.isLoop() || current.isSwitchStatement()) {
        const breaks = pathsBreak(current);
        if (breaks.any && (!current.isSwitchStatement() || !breaks.all)) {
          const simpleReferences = simpleBreakOrContinueReferences(current);
          if (current.parentPath.isLabeledStatement()) {
            const refs = namedLabelReferences(current.parentPath, path);
            if (simpleReferences.length || refs.breaks.length || refs.continues.length) {
              result.push({
                identifier: breakIdentifierForPath(current),
                name: current.parentPath.node.label.name,
                path: current.parentPath,
                isAsync: true
              });
            }
            current = current.parentPath;
          } else if (simpleReferences.length) {
            result.push({
              identifier: breakIdentifierForPath(current),
              path: current,
              isAsync: true
            });
          }
        }
      } else if (current.isLabeledStatement()) {
        const refs = namedLabelReferences(current, path);
        if (refs.breaks.length || refs.continues.length) {
          result.push({
            identifier: breakIdentifierForPath(current.get("body")),
            name: current.node.label.name,
            path: current,
            isAsync: true
          });
        }
      }
      current = current.parentPath;
    }
    return result;
  }
  function isForAwaitStatement(path) {
    return path.isForAwaitStatement && path.node ? path.isForAwaitStatement() : false;
  }
  function isArgumentPlaceholder(path) {
    return path.node.type === "ArgumentPlaceholder";
  }
  function getStatementOrArrowBodyParent(path) {
    let parent = path;
    while (parent) {
      if (parent.isStatement()) {
        return parent;
      }
      if (parent.isArrowFunctionExpression()) {
        return parent.get("body");
      }
      parent = parent.parentPath;
    }
    throw path.buildCodeFrameError(`Expected a statement parent!`, TypeError);
  }
  function addConstantNames(additionalConstantNames, node) {
    if (types.isIdentifier(node)) {
      if (additionalConstantNames.indexOf(node.name) === -1) {
        additionalConstantNames.push(node.name);
      }
    } else if (types.isArrayPattern(node)) {
      for (const element of node.elements) {
        if (types.isIdentifier(element) || types.isPattern(element) || types.isRestElement(element)) {
          addConstantNames(additionalConstantNames, element);
        }
      }
    } else if (types.isObjectPattern(node)) {
      for (const property of node.properties) {
        if (types.isObjectProperty(property)) {
          addConstantNames(additionalConstantNames, property.key);
        } else if (types.isRestElement(property)) {
          addConstantNames(additionalConstantNames, property.argument);
        }
      }
    } else if (types.isRestElement(node)) {
      addConstantNames(additionalConstantNames, node.argument);
    }
  }
  function yieldOnExpression(state, expression) {
    const generatorIdentifier = state.generatorIdentifier;
    if (typeof generatorIdentifier === "undefined") {
      throw new Error("Encountered a yield expression outside a generator function!");
    }
    const callee = types.memberExpression(generatorIdentifier, types.identifier("_yield"));
    helperNameMap.set(callee, "_yield");
    return types.callExpression(callee, [expression]);
  }
  function rewriteAwaitOrYieldPath(rewritePath) {
    const state = this;
    const pluginState = state.generatorState.state;
    const path = state.path;
    const additionalConstantNames = state.additionalConstantNames;
    let awaitPath;
    let processExpressions;
    const rewritePathCopy = rewritePath;
    if (rewritePath.isAwaitExpression() || rewritePath.isYieldExpression()) {
      awaitPath = rewritePath;
      processExpressions = true;
    } else if (rewritePath.isForOfStatement() || isForAwaitStatement(rewritePath)) {
      const left = rewritePath.get("left");
      if (left.isAwaitExpression()) {
        awaitPath = left.get("argument");
      } else if (left.isSpreadElement()) {
        awaitPath = unwrapSpreadElement(left);
      } else {
        awaitPath = left;
      }
      processExpressions = false;
    } else {
      throw rewritePathCopy.buildCodeFrameError(`Expected either an await expression or a for await statement, got a ${rewritePathCopy.type}!`, TypeError);
    }
    const paths = [];
    {
      let targetPath = awaitPath;
      let shouldPushExitIdentifier = false;
      while (targetPath !== path) {
        const parent = targetPath.parentPath;
        if (parent == null) {
          break;
        }
        if (!parent.isSwitchCase() && !parent.isBlockStatement()) {
          let exitIdentifier;
          const explicitExits = pathsReturnOrThrow(parent);
          if (!explicitExits.all && explicitExits.any && (parent.isLoop() || exitsInTail(parent))) {
            if (!state.exitIdentifier) {
              state.exitIdentifier = targetPath.scope.generateUidIdentifier("exit");
              shouldPushExitIdentifier = true;
            }
            exitIdentifier = state.exitIdentifier;
          }
          paths.push({
            targetPath,
            explicitExits,
            parent,
            exitIdentifier
          });
        }
        targetPath = parent;
      }
      if (shouldPushExitIdentifier && state.exitIdentifier) {
        path.scope.push({
          kind: "let",
          id: state.exitIdentifier,
          init: readConfigKey(pluginState.opts, "minify") ? undefined : booleanLiteral(false, readConfigKey(pluginState.opts, "minify"))
        });
      }
    }
    let breakIdentifiers = [];
    for (const item of paths) {
      const parent = item.parent;
      if (parent.isForStatement() || parent.isWhileStatement() || parent.isDoWhileStatement() || parent.isForInStatement() || parent.isForOfStatement() || isForAwaitStatement(parent) || parent.isLabeledStatement()) {
        breakIdentifiers = item.breakIdentifiers = replaceReturnsAndBreaks(pluginState, parent.get("body"), item.exitIdentifier, breakIdentifiers);
        if (parent.isForStatement()) {
          if (item.forToIdentifiers = identifiersInForToLengthStatement(parent)) {
            addConstantNames(additionalConstantNames, item.forToIdentifiers.i);
          }
        }
      } else if (item.parent.isSwitchStatement()) {
        breakIdentifiers = breakIdentifiers.slice();
        item.cases = item.parent.get("cases").map(casePath => {
          const caseExits = pathsReturnOrThrow(casePath);
          const caseBreaks = pathsBreak(casePath);
          const caseBreakIdentifiers = item.breakIdentifiers = replaceReturnsAndBreaks(pluginState, casePath, item.exitIdentifier, breakIdentifiers);
          for (const breakItem of caseBreakIdentifiers) {
            if (!breakIdentifiers.find(existing => existing.identifier.name === breakItem.identifier.name)) {
              breakIdentifiers.push(breakItem);
            }
          }
          return {
            casePath,
            caseExits,
            caseBreaks,
            breakIdentifiers: caseBreakIdentifiers,
            test: casePath.node.test
          };
        });
      } else {
        breakIdentifiers = item.breakIdentifiers = replaceReturnsAndBreaks(pluginState, parent, item.exitIdentifier, breakIdentifiers);
      }
    }
    for (const {
      targetPath,
      explicitExits,
      breakIdentifiers,
      parent,
      exitIdentifier,
      cases,
      forToIdentifiers
    } of paths) {
      if (parent.isExpressionStatement() && (targetPath.isAwaitExpression() || targetPath.isYieldExpression()) && processExpressions) {
        processExpressions = false;
        relocateTail(state.generatorState, targetPath.isYieldExpression() ? yieldOnExpression(state.generatorState, targetPath.node.argument || types.identifier("undefined")) : targetPath.node.argument, undefined, parent, additionalConstantNames, undefined, undefined, targetPath.isYieldExpression() ? undefined : booleanLiteral(false, readConfigKey(pluginState.opts, "minify")), state.skipReturns);
      } else if (parent.isIfStatement()) {
        const test = parent.get("test");
        if (targetPath !== test) {
          let resultIdentifier;
          if (!explicitExits.all && explicitExits.any) {
            resultIdentifier = path.scope.generateUidIdentifier("result");
            addConstantNames(additionalConstantNames, resultIdentifier);
          }
          if (!explicitExits.all) {
            const consequent = parent.get("consequent");
            rewriteAsyncBlock(state.generatorState, consequent, additionalConstantNames, exitIdentifier);
            const alternate = parent.get("alternate");
            if (alternate.isStatement()) {
              rewriteAsyncBlock(state.generatorState, alternate, additionalConstantNames, exitIdentifier);
            }
            const fn = functionize(pluginState, [], blockStatement([parent.node]), targetPath);
            relocateTail(state.generatorState, types.callExpression(fn, []), undefined, parent, additionalConstantNames, resultIdentifier, exitIdentifier, undefined, state.skipReturns);
            processExpressions = false;
          }
        }
      } else if (parent.isTryStatement()) {
        const temporary = explicitExits.any && !explicitExits.all ? path.scope.generateUidIdentifier("result") : undefined;
        const exitCheck = buildBreakExitCheck(pluginState, explicitExits.any && !explicitExits.all ? exitIdentifier : undefined, breakIdentifiers);
        let expression = rewriteAsyncNode(state.generatorState, parent, parent.node.block, additionalConstantNames, exitIdentifier);
        const catchClause = parent.node.handler;
        if (catchClause) {
          const param = catchClause.param;
          const paramIsUsed = param !== null && param !== undefined && (param.type !== "Identifier" || parent.get("handler").scope.getBinding(param.name).referencePaths.length !== 0);
          const fn = catchClause.body.body.length ? rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, paramIsUsed && param != null ? [param] : [], catchClause.body, targetPath), additionalConstantNames, exitIdentifier) : emptyFunction(pluginState, parent);
          expression = types.callExpression(helperReference(pluginState, path, state.generatorState.generatorIdentifier ? "_catchInGenerator" : "_catch"), [unwrapReturnCallWithEmptyArguments(functionize(pluginState, [], expression, targetPath), path.scope, additionalConstantNames), fn]);
        }
        if (parent.node.finalizer) {
          let finallyName;
          let finallyArgs;
          let finallyBody = parent.node.finalizer.body;
          if (!pathsReturnOrThrow(parent.get("finalizer")).all) {
            const resultIdentifier = temporary || path.scope.generateUidIdentifier("result");
            addConstantNames(additionalConstantNames, resultIdentifier);
            const wasThrownIdentifier = path.scope.generateUidIdentifier("wasThrown");
            addConstantNames(additionalConstantNames, wasThrownIdentifier);
            finallyArgs = [wasThrownIdentifier, resultIdentifier];
            if (readConfigKey(pluginState.opts, "inlineHelpers")) {
              finallyBody = finallyBody.concat([types.ifStatement(wasThrownIdentifier, types.throwStatement(resultIdentifier)), types.returnStatement(resultIdentifier)]);
            } else {
              finallyBody = finallyBody.concat(returnStatement(types.callExpression(helperReference(pluginState, parent, "_rethrow"), [wasThrownIdentifier, resultIdentifier])));
            }
            finallyName = "_finallyRethrows";
          } else {
            finallyArgs = [];
            finallyName = "_finally";
          }
          const fn = functionize(pluginState, finallyArgs, blockStatement(finallyBody), targetPath);
          const rewritten = rewriteAsyncNode(state.generatorState, parent, fn, additionalConstantNames, exitIdentifier);
          expression = types.callExpression(helperReference(pluginState, parent, finallyName), [unwrapReturnCallWithEmptyArguments(functionize(pluginState, [], expression, targetPath), path.scope, additionalConstantNames), rewritten]);
        }
        relocateTail(state.generatorState, types.isExpression(expression) ? expression : types.callExpression(functionize(pluginState, [], expression, targetPath), []), undefined, parent, additionalConstantNames, temporary, exitCheck, undefined, state.skipReturns);
        processExpressions = false;
      } else if (parent.isForStatement() || parent.isWhileStatement() || parent.isDoWhileStatement() || parent.isForInStatement() || parent.isForOfStatement() || isForAwaitStatement(parent)) {
        const label = parent.parentPath.isLabeledStatement() ? parent.parentPath.node.label.name : undefined;
        if (parent.isForInStatement() || parent.isForOfStatement() || isForAwaitStatement(parent)) {
          const right = parent.get("right");
          if (awaitPath !== right) {
            const left = parent.get("left");
            const loopIdentifier = left.isVariableDeclaration() ? left.get("declarations")[0].get("id") : left;
            if (loopIdentifier.isIdentifier() || loopIdentifier.isPattern()) {
              const forOwnBodyPath = parent.isForInStatement() && extractForOwnBodyPath(parent);
              const bodyBlock = blockStatement((forOwnBodyPath || parent.get("body")).node);
              const params = [right.node, rewriteAsyncNode(state.generatorState, parent, bodyBlock.body.length ? functionize(pluginState, [loopIdentifier.node], bodyBlock, targetPath) : emptyFunction(pluginState, parent), additionalConstantNames, exitIdentifier)];
              const exitCheck = buildBreakExitCheck(pluginState, exitIdentifier, breakIdentifiers);
              if (exitCheck) {
                params.push(functionize(pluginState, [], types.blockStatement([returnStatement(exitCheck)]), targetPath));
              }
              const loopCall = types.callExpression(helperReference(pluginState, parent, parent.isForInStatement() ? forOwnBodyPath ? "_forOwn" : "_forIn" : isForAwaitStatement(parent) ? "_forAwaitOf" : "_forOf"), params);
              let resultIdentifier = undefined;
              if (explicitExits.any) {
                resultIdentifier = path.scope.generateUidIdentifier("result");
                addConstantNames(additionalConstantNames, resultIdentifier);
              }
              relocateTail(state.generatorState, loopCall, undefined, label && parent.parentPath.isStatement() ? parent.parentPath : parent, additionalConstantNames, resultIdentifier, exitIdentifier, undefined, state.skipReturns);
              processExpressions = false;
            } else {
              throw loopIdentifier.buildCodeFrameError(`Expected an identifier or pattern, but got a ${loopIdentifier.type}!`, TypeError);
            }
          }
        } else {
          let testExpression = parent.node.test;
          const breakExitCheck = buildBreakExitCheck(pluginState, exitIdentifier, breakIdentifiers);
          if (breakExitCheck) {
            const inverted = logicalNot(breakExitCheck, readConfigKey(pluginState.opts, "minify"));
            testExpression = testExpression && (!types.isBooleanLiteral(testExpression) || !testExpression.value) ? logicalAnd(inverted, testExpression, extractLooseBooleanValue) : inverted;
          }
          if (testExpression) {
            testExpression = rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, [], testExpression, targetPath), additionalConstantNames, exitIdentifier, true);
          }
          const isDoWhile = parent.isDoWhileStatement();
          let loopCall;
          if (forToIdentifiers && !isDoWhile) {
            const args = [forToIdentifiers.array, rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, [forToIdentifiers.i], blockStatement(parent.node.body), targetPath), additionalConstantNames, exitIdentifier)];
            if (breakExitCheck) {
              args.push(functionize(pluginState, [], breakExitCheck, targetPath));
            }
            loopCall = types.callExpression(helperReference(pluginState, parent, "_forTo"), args);
          } else {
            let updateExpression = null;
            if (parent.isForStatement()) {
              updateExpression = parent.node.update;
              if (updateExpression) {
                updateExpression = rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, [], updateExpression, targetPath), additionalConstantNames, exitIdentifier, true);
              }
              const init = parent.get("init");
              if (init) {
                const initNode = init.node;
                if (initNode !== null && initNode !== undefined) {
                  reregisterDeclarations(parent.insertBefore(types.isExpression(initNode) ? types.expressionStatement(initNode) : initNode));
                }
              }
            }
            const bodyFunction = rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, [], blockStatement(parent.node.body || []), targetPath), additionalConstantNames, exitIdentifier);
            const testFunction = unwrapReturnCallWithEmptyArguments(testExpression || voidExpression(), path.scope, additionalConstantNames);
            const updateFunction = unwrapReturnCallWithEmptyArguments(updateExpression || voidExpression(), path.scope, additionalConstantNames);
            loopCall = isDoWhile ? types.callExpression(helperReference(pluginState, parent, "_do"), [bodyFunction, testFunction]) : types.callExpression(helperReference(pluginState, parent, "_for"), [testFunction, updateFunction, bodyFunction]);
          }
          let resultIdentifier = undefined;
          if (explicitExits.any) {
            resultIdentifier = path.scope.generateUidIdentifier("result");
            addConstantNames(additionalConstantNames, resultIdentifier);
          }
          relocateTail(state.generatorState, loopCall, undefined, parent, additionalConstantNames, resultIdentifier, exitIdentifier, undefined, state.skipReturns);
          processExpressions = false;
        }
      } else if (parent.isSwitchStatement()) {
        const label = parent.parentPath.isLabeledStatement() ? parent.parentPath.node.label.name : undefined;
        const discriminant = parent.get("discriminant");
        const testPaths = parent.get("cases").map(casePath => casePath.get("test"));
        if (awaitPath !== discriminant && !(explicitExits.all && !testPaths.some(testPath => testPath.node ? findAwaitOrYieldPath(testPath) !== undefined : false))) {
          let resultIdentifier;
          if (!explicitExits.all && explicitExits.any) {
            resultIdentifier = path.scope.generateUidIdentifier("result");
            addConstantNames(additionalConstantNames, resultIdentifier);
          }
          const caseNodes = types.arrayExpression(cases ? cases.map(caseItem => {
            const args = [];
            let consequent;
            if (caseItem.casePath.node.consequent) {
              const rewritten = rewriteAsyncNode(state.generatorState, parent, blockStatement(removeUnnecessaryReturnStatements(caseItem.casePath.node.consequent)), additionalConstantNames, exitIdentifier);
              if (rewritten.body.length) {
                consequent = functionize(pluginState, [], rewritten, targetPath);
              }
            }
            if (caseItem.casePath.node.test) {
              args.push(rewriteAsyncNode(state.generatorState, parent, functionize(pluginState, [], caseItem.casePath.node.test, targetPath), additionalConstantNames));
            } else if (consequent) {
              args.push(voidExpression());
            }
            if (consequent) {
              args.push(consequent);
              if (!caseItem.caseExits.any && !caseItem.caseBreaks.any) {
                args.push(emptyFunction(pluginState, parent));
              } else if (!(caseItem.caseExits.all || caseItem.caseBreaks.all)) {
                const breakCheck = buildBreakExitCheck(pluginState, caseItem.caseExits.any ? exitIdentifier : undefined, caseItem.breakIdentifiers);
                if (breakCheck) {
                  args.push(functionize(pluginState, [], types.blockStatement([returnStatement(breakCheck)]), targetPath));
                }
              }
            }
            return types.arrayExpression(args);
          }) : []);
          const switchCall = types.callExpression(helperReference(pluginState, parent, "_switch"), [discriminant.node, caseNodes]);
          relocateTail(state.generatorState, switchCall, undefined, label && parent.parentPath.isStatement() ? parent.parentPath : parent, additionalConstantNames, resultIdentifier, exitIdentifier, undefined, state.skipReturns);
          processExpressions = false;
        }
      } else if (parent.isLabeledStatement()) {
        let resultIdentifier;
        if (!explicitExits.all && explicitExits.any) {
          resultIdentifier = path.scope.generateUidIdentifier("result");
          addConstantNames(additionalConstantNames, resultIdentifier);
        }
        if (resultIdentifier || breakIdentifiers && breakIdentifiers.length) {
          const filteredBreakIdentifiers = breakIdentifiers ? breakIdentifiers.filter(id => id.name !== parent.node.label.name) : [];
          const fn = functionize(pluginState, [], blockStatement(parent.node.body), targetPath);
          const rewritten = rewriteAsyncNode(state.generatorState, parent, fn, additionalConstantNames, exitIdentifier);
          const exitCheck = buildBreakExitCheck(pluginState, explicitExits.any ? exitIdentifier : undefined, filteredBreakIdentifiers);
          relocateTail(state.generatorState, types.callExpression(rewritten, []), undefined, parent, additionalConstantNames, resultIdentifier, exitCheck, undefined, state.skipReturns);
          processExpressions = false;
        }
      }
    }
    if (processExpressions) {
      if (awaitPath.isAwaitExpression() || awaitPath.isYieldExpression()) {
        const originalArgument = awaitPath.node.argument;
        let parent = getStatementOrArrowBodyParent(awaitPath);
        const {
          declarationKind,
          declarations,
          awaitExpression,
          directExpression,
          reusingExisting,
          resultIdentifier
        } = extractDeclarations(pluginState, awaitPath, originalArgument || types.identifier("undefined"), additionalConstantNames);
        if (resultIdentifier) {
          addConstantNames(additionalConstantNames, resultIdentifier);
        }
        if (declarations.length) {
          for (const {
            id
          } of declarations) {
            addConstantNames(additionalConstantNames, id);
          }
          if (parent.parentPath.isBlockStatement()) {
            reregisterDeclarations(parent.insertBefore(types.variableDeclaration(declarationKind, declarations)));
          } else {
            parent.replaceWith(blockStatement([types.variableDeclaration(declarationKind, declarations), types.isStatement(parent.node) ? parent.node : returnStatement(parent.node)]));
            const body = parent.get("body");
            reregisterDeclarations(body[0]);
            parent = body[1];
          }
        }
        if (reusingExisting) {
          if (types.isVariableDeclaration(reusingExisting.parent) && reusingExisting.parent.declarations.length === 1) {
            reusingExisting.parentPath.replaceWith(types.emptyStatement());
          } else {
            reusingExisting.remove();
          }
        }
        const parentNode = parent.node;
        relocateTail(state.generatorState, awaitPath.isYieldExpression() ? yieldOnExpression(state.generatorState, awaitExpression) : awaitExpression, types.isStatement(parentNode) ? parentNode : types.returnStatement(parentNode), parent, additionalConstantNames, resultIdentifier, undefined, awaitPath.isYieldExpression() ? undefined : directExpression, state.skipReturns);
      }
    }
  }
  const rewriteAsyncBlockVisitor = {
    Function: skipNode,
    AwaitExpression: rewriteAwaitOrYieldPath,
    YieldExpression: rewriteAwaitOrYieldPath,
    ForAwaitStatement: rewriteAwaitOrYieldPath,
    ForOfStatement(path) {
      if (path.node.await) {
        rewriteAwaitOrYieldPath.call(this, path);
      }
    },
    CallExpression(path) {
      const callee = path.get("callee");
      if (callee.isIdentifier() && callee.node.name === "eval") {
        throw path.buildCodeFrameError("Calling eval from inside an async function is not supported!", TypeError);
      }
    }
  };
  const unpromisifyVisitor = {
    Function: skipNode,
    ReturnStatement(path) {
      const argument = path.get("argument");
      if (argument.node) {
        unpromisify(argument, this);
      }
    }
  };
  function unpromisify(path, pluginState) {
    if (path.isNumericLiteral() || path.isBooleanLiteral() || path.isStringLiteral() || path.isNullLiteral() || path.isIdentifier() && path.node.name === "undefined" || path.isArrayExpression() || path.isObjectExpression() || path.isBinaryExpression() || path.isUnaryExpression() || path.isUpdateExpression()) {
      return;
    }
    if (path.isCallExpression() && (types.isIdentifier(path.node.callee) || types.isMemberExpression(path.node.callee)) && helperNameMap.has(path.node.callee)) {
      switch (helperNameMap.get(path.node.callee)) {
        case "_await":
          const args = path.get("arguments");
          if (args.length > 0 && args[0].isExpression()) {
            unpromisify(args[0], pluginState);
          }
        case "_call":
          {
            const args = path.get("arguments");
            if (args.length > 2) {
              const secondArg = args[1];
              if (types.isExpression(secondArg.node) && isContinuation(secondArg.node)) {
                secondArg.traverse(unpromisifyVisitor, pluginState);
              } else if (secondArg.isIdentifier()) {
                const binding = secondArg.scope.getBinding(secondArg.node.name);
                if (binding && binding.path.isVariableDeclarator()) {
                  binding.path.get("init").traverse(unpromisifyVisitor, pluginState);
                }
              }
            }
            break;
          }
        case "_promiseThen":
          {
            const args = path.get("arguments");
            if (args.length > 2) {
              const firstArg = args[1];
              if (types.isExpression(firstArg.node) && isContinuation(firstArg.node)) {
                firstArg.traverse(unpromisifyVisitor, pluginState);
              } else if (firstArg.isIdentifier()) {
                const binding = firstArg.scope.getBinding(firstArg.node.name);
                if (binding && binding.path.isVariableDeclarator()) {
                  binding.path.get("init").traverse(unpromisifyVisitor, pluginState);
                }
              }
            }
            break;
          }
      }
      return;
    }
    if (path.isLogicalExpression()) {
      unpromisify(path.get("left"), pluginState);
      unpromisify(path.get("right"), pluginState);
      return;
    }
    if (path.isConditionalExpression()) {
      unpromisify(path.get("consequent"), pluginState);
      unpromisify(path.get("alternate"), pluginState);
      return;
    }
    if (path.isSequenceExpression()) {
      const expressions = path.get("expressions");
      if (expressions.length) {
        unpromisify(expressions[expressions.length - 1], pluginState);
      }
      return;
    }
    const minify = readConfigKey(pluginState.opts, "minify");
    path.replaceWith(logicalNot(logicalNot(path.node, minify), minify));
  }
  function rewriteAsyncBlock(generatorState, path, additionalConstantNames, exitIdentifier, shouldUnpromisify, skipReturns) {
    path.traverse(rewriteAsyncBlockVisitor, {
      generatorState,
      path,
      additionalConstantNames,
      exitIdentifier,
      skipReturns
    });
    if (shouldUnpromisify) {
      if (path.isArrowFunctionExpression()) {
        const body = path.get("body");
        if (body.isExpression()) {
          unpromisify(body, generatorState.state);
        }
      } else {
        path.traverse(unpromisifyVisitor, generatorState.state);
      }
    }
  }
  function getFile(path) {
    let hub = path.hub;
    if ("file" in hub) {
      return hub.file;
    }
    throw path.buildCodeFrameError("Expected the path's hub to contain a file!", TypeError);
  }
  const getHelperDependenciesVisitor = {
    Identifier(path) {
      if (identifierSearchesScope(path) && getFile(path).scope.getBinding(path.node.name) && this.dependencies.indexOf(path.node.name) === -1) {
        this.dependencies.push(path.node.name);
      }
    }
  };
  function getHelperDependencies(path) {
    const state = {
      dependencies: []
    };
    path.traverse(getHelperDependenciesVisitor, state);
    return state.dependencies;
  }
  const usesIdentifierVisitor = {
    Identifier(path) {
      if (path.node.name === this.name) {
        this.found = true;
        path.stop();
      }
    }
  };
  function usesIdentifier(path, name) {
    const state = {
      name,
      found: false
    };
    path.traverse(usesIdentifierVisitor, state);
    return state.found;
  }
  function insertHelper(programPath, value) {
    const body = programPath.get("body");
    const destinationPath = body.find(path => !isHelperDefinitionSet.has(path.node) && !path.isImportDeclaration()) || body.find(() => true);
    if (destinationPath.isVariableDeclaration()) {
      const before = destinationPath.get("declarations").filter(path => isHelperDefinitionSet.has(path.node));
      const after = destinationPath.get("declarations").filter(path => !isHelperDefinitionSet.has(path.node));
      if (types.isVariableDeclaration(value)) {
        const declaration = value.declarations[0];
        isHelperDefinitionSet.add(declaration);
        if (before.length === 0) {
          const target = after[0];
          reregisterDeclarations(target.insertBefore(declaration));
          return getPreviousSibling(target);
        } else {
          const target = before[before.length - 1];
          reregisterDeclarations(target.insertAfter(declaration));
          return getNextSibling(target);
        }
      } else {
        isHelperDefinitionSet.add(value);
        if (before.length === 0) {
          isHelperDefinitionSet.add(destinationPath.node);
          reregisterDeclarations(destinationPath.insertBefore(value));
          return getPreviousSibling(destinationPath);
        } else if (after.length === 0) {
          isHelperDefinitionSet.add(destinationPath.node);
          reregisterDeclarations(destinationPath.insertAfter(value));
          return getNextSibling(destinationPath);
        } else {
          const beforeNode = types.variableDeclaration(destinationPath.node.kind, before.map(path => path.node));
          isHelperDefinitionSet.add(beforeNode);
          const afterNode = types.variableDeclaration(destinationPath.node.kind, after.map(path => path.node));
          destinationPath.replaceWith(afterNode);
          reregisterDeclarations(destinationPath);
          reregisterDeclarations(destinationPath.insertBefore(beforeNode));
          reregisterDeclarations(destinationPath.insertBefore(value));
          return getPreviousSibling(destinationPath);
        }
      }
    } else {
      if (types.isVariableDeclaration(value)) {
        isHelperDefinitionSet.add(value.declarations[0]);
      } else {
        isHelperDefinitionSet.add(value);
      }
      const oldNode = destinationPath.node;
      destinationPath.replaceWith(value);
      reregisterDeclarations(destinationPath);
      reregisterDeclarations(destinationPath.insertAfter(oldNode));
      return destinationPath;
    }
  }
  function helperReference(state, path, name) {
    const file = getFile(path);
    let result = file.declarations[name];
    if (result) {
      result = cloneNode(result);
    } else {
      result = file.declarations[name] = usesIdentifier(file.path, name) ? file.path.scope.generateUidIdentifier(name) : types.identifier(name);
      helperNameMap.set(result, name);
      if (readConfigKey(state.opts, "externalHelpers")) {
        file.path.unshiftContainer("body", types.importDeclaration([types.importSpecifier(result, types.identifier(name))], types.stringLiteral("babel-plugin-transform-async-to-promises/helpers")));
      } else {
        if (!helpers) {
          const newHelpers = {};
          const plugins = [{
            visitor: {
              ExportNamedDeclaration(path) {
                const declaration = path.get("declaration");
                if (declaration.isFunctionDeclaration()) {
                  const id = declaration.node.id;
                  if (!types.isIdentifier(id)) {
                    throw declaration.buildCodeFrameError(`Expected a named declaration!`, TypeError);
                  }
                  newHelpers[id.name] = {
                    value: declaration.node,
                    dependencies: getHelperDependencies(declaration)
                  };
                  return;
                }
                if (declaration.isVariableDeclaration() && declaration.node.declarations.length === 1) {
                  const declaratorId = declaration.node.declarations[0].id;
                  if (types.isIdentifier(declaratorId)) {
                    newHelpers[declaratorId.name] = {
                      value: declaration.node,
                      dependencies: getHelperDependencies(declaration)
                    };
                    return;
                  }
                }
                throw path.buildCodeFrameError("Expected a named export from built-in helper!", TypeError);
              }
            }
          }];
          const helperAst = require(isNewBabel ? "@babel/core" : "babylon").parse(helpers_string_1, {
            sourceType: "module",
            filename: "helpers.js"
          });
          if (isNewBabel) {
            transformFromAst(helperAst, helpers_string_1, {
              babelrc: false,
              configFile: false,
              plugins
            });
          } else {
            transformFromAst(helperAst, helpers_string_1, {
              babelrc: false,
              plugins
            });
          }
          helpers = newHelpers;
        }
        const helper = helpers[name];
        for (const dependency of helper.dependencies) {
          helperReference(state, path, dependency);
        }
        const usedHelpers = state.usedHelpers || (state.usedHelpers = {});
        usedHelpers[name] = true;
      }
    }
    return result;
  }
  function emptyFunction(state, path) {
    return readConfigKey(state.opts, "inlineHelpers") ? functionize(state, [], blockStatement([]), path) : helperReference(state, path, "_empty");
  }
  function promiseResolve() {
    const result = types.memberExpression(types.identifier("Promise"), types.identifier("resolve"));
    helperNameMap.set(result, "_promiseResolve");
    return result;
  }
  function callThenMethod(value, continuation) {
    const thenExpression = types.memberExpression(value, types.identifier("then"));
    helperNameMap.set(thenExpression, "_promiseThen");
    return types.callExpression(thenExpression, [continuation]);
  }
  function isAsyncCallExpression(path) {
    if (types.isIdentifier(path.node.callee) || types.isMemberExpression(path.node.callee)) {
      switch (helperNameMap.get(path.node.callee)) {
        case "_await":
        case "_call":
        case "_promiseResolve":
        case "_promiseThen":
          return path.node.arguments.length < 3;
      }
    }
    return false;
  }
  function invokeTypeOfExpression(path) {
    if (path.isCallExpression() && types.isIdentifier(path.node.callee)) {
      const helperName = helperNameMap.get(path.node.callee);
      switch (helperName) {
        case "_invoke":
        case "_invokeIgnored":
        case "_catch":
        case "_catchInGenerator":
        case "_finally":
        case "_finallyRethrows":
          return helperName;
      }
    }
  }
  function isAsyncFunctionExpression(path) {
    if (path.isFunction() && (path.node.async || nodeIsAsyncSet.has(path.node))) {
      return true;
    }
    if (path.isCallExpression() && types.isIdentifier(path.node.callee) && helperNameMap.get(path.node.callee) === "_async") {
      return true;
    }
    return false;
  }
  function isAsyncFunctionIdentifier(path) {
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (binding && binding.constant) {
        const bindingPath = binding.path;
        if (bindingPath.isVariableDeclarator()) {
          const initPath = bindingPath.get("init");
          if (initPath.node && isAsyncFunctionExpression(initPath)) {
            return true;
          }
        } else if (bindingPath.isFunctionDeclaration()) {
          if (isAsyncFunctionExpression(bindingPath)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  function isEvalOrArguments(path) {
    return path.isIdentifier() && (path.node.name === "arguments" || path.node.name === "eval");
  }
  function identifierSearchesScope(path) {
    if (path.node.name === "undefined") {
      return false;
    }
    if (helperNameMap.has(path.node)) {
      return false;
    }
    const parent = path.parentPath;
    if (parent.isVariableDeclarator() && parent.get("id") === path) {
      return false;
    }
    if (parent.isMemberExpression() && !parent.node.computed && parent.get("property") === path) {
      return false;
    }
    if (parent.isLabeledStatement() && parent.get("label") === path) {
      return false;
    }
    if (parent.isFunction() && parent.get("params").indexOf(path) !== -1) {
      return false;
    }
    return true;
  }
  function canThrow() {
    this.canThrow = true;
  }
  function promiseCallExpressionType(expression) {
    if (types.isMemberExpression(expression.callee)) {
      if (types.isIdentifier(expression.callee.object) && expression.callee.object.name === "Promise" && types.isIdentifier(expression.callee.property)) {
        switch (expression.callee.property.name) {
          case "all":
          case "race":
          case "reject":
          case "resolve":
            return expression.callee.property.name;
        }
      } else if (types.isCallExpression(expression.callee.object) && types.isIdentifier(expression.callee.property)) {
        switch (expression.callee.property.name) {
          case "then":
          case "catch":
          case "finally":
            if (typeof promiseCallExpressionType(expression.callee.object) !== "undefined") {
              return expression.callee.property.name;
            }
            break;
        }
      }
    }
    return undefined;
  }
  const checkForErrorsAndRewriteReturnsVisitor = {
    Function: skipNode,
    ThrowStatement: canThrow,
    ForInStatement: canThrow,
    ForOfStatement: canThrow,
    WithStatement: canThrow,
    NewExpression: canThrow,
    TryStatement(path) {
      if (path.get("handler")) {
        path.get("block").skip();
      }
    },
    CallExpression(path) {
      if (!isAsyncCallExpression(path)) {
        const args = path.get("arguments");
        switch (invokeTypeOfExpression(path)) {
          default:
            if (checkForErrorsAndRewriteReturns(args[0], this.plugin)) {
              this.canThrow = true;
            }
          case "_catch":
          case "_catchInGenerator":
          case "_finally":
          case "_finallyRethrows":
            if (args[1]) {
              if (checkForErrorsAndRewriteReturns(args[1], this.plugin)) {
                this.canThrow = true;
              }
            }
            break;
          case undefined:
            {
              const callee = path.get("callee");
              if (!isAsyncFunctionIdentifier(callee)) {
                this.canThrow = true;
              }
            }
        }
      }
    },
    UpdateExpression(path) {
      if (isEvalOrArguments(path.get("argument"))) {
        this.canThrow = true;
      }
    },
    UnaryExpression(path) {
      switch (path.node.operator) {
        case "delete":
          this.canThrow = true;
          break;
      }
    },
    BinaryExpression(path) {
      switch (path.node.operator) {
        case "instanceof":
        case "in":
          this.canThrow = true;
          break;
      }
    },
    Identifier(path) {
      if (identifierSearchesScope(path) && !path.scope.getBinding(path.node.name) && alwaysTruthy.indexOf(path.node.name) === -1) {
        this.canThrow = true;
      }
    },
    MemberExpression(path) {
      if (helperNameMap.get(path.node) !== "_await" && !(path.parentPath.isCallExpression() && promiseCallExpressionType(path.parentPath.node) !== undefined && path.parentPath.get("callee") === path)) {
        const propertyName = propertyNameOfMemberExpression(path.node);
        if (propertyName !== undefined) {
          const object = path.get("object");
          if (object.isIdentifier() && Object.hasOwnProperty.call(constantStaticMethods, object.node.name) && Object.hasOwnProperty.call(constantStaticMethods[object.node.name], propertyName)) {
            return;
          }
        }
        this.canThrow = true;
      }
    },
    AssignmentExpression(path) {
      if (isEvalOrArguments(path.get("left"))) {
        this.canThrow = true;
      }
    },
    ReturnStatement(path) {
      if (this.rewriteReturns) {
        const argument = path.get("argument");
        if (argument && argument.node) {
          let arg = argument.node;
          if (!(argument.isCallExpression() && (isAsyncCallExpression(argument) || typeof promiseCallExpressionType(argument.node) !== "undefined") || argument.isCallExpression() && isAsyncFunctionIdentifier(argument.get("callee")))) {
            const target = readConfigKey(this.plugin.opts, "inlineHelpers") ? promiseResolve() : helperReference(this.plugin, path, "_await");
            if (types.isConditionalExpression(arg) && types.isIdentifier(arg.test)) {
              if (types.isCallExpression(arg.consequent) && promiseCallExpressionType(arg.consequent) === "resolve" && arg.consequent.arguments.length === 1 && nodesAreEquivalent(arg.consequent.arguments[0])(arg.alternate)) {
                arg = arg.alternate;
              } else if (types.isCallExpression(arg.alternate) && promiseCallExpressionType(arg.alternate) === "resolve" && arg.alternate.arguments.length === 1 && nodesAreEquivalent(arg.alternate.arguments[0])(arg.consequent)) {
                arg = arg.consequent;
              }
            }
            if (types.isConditionalExpression(arg) && types.isCallExpression(arg.consequent) && promiseCallExpressionType(arg.consequent) === "resolve") {
              const consequent = arg.consequent.arguments[0];
              if (consequent && types.isExpression(consequent)) {
                arg = conditionalExpression(arg.test, consequent, arg.alternate);
              }
            }
            if (types.isConditionalExpression(arg) && types.isCallExpression(arg.alternate) && promiseCallExpressionType(arg.alternate) === "resolve") {
              const alternate = arg.alternate.arguments[0];
              if (alternate && types.isExpression(alternate)) {
                arg = conditionalExpression(arg.test, arg.consequent, alternate);
              }
            }
            if (types.isConditionalExpression(arg) && types.isIdentifier(arg.test)) {
              if (types.isIdentifier(arg.consequent) && arg.test.name === arg.consequent.name) {
                if (types.isIdentifier(arg.alternate) && arg.test.name === arg.alternate.name) {
                  arg = arg.test;
                } else {
                  arg = types.logicalExpression("||", arg.consequent, arg.alternate);
                }
              } else if (types.isIdentifier(arg.alternate) && arg.test.name === arg.alternate.name) {
                arg = types.logicalExpression("&&", arg.alternate, arg.consequent);
              }
            }
            argument.replaceWith(types.callExpression(target, [arg]));
          }
        } else {
          const target = readConfigKey(this.plugin.opts, "inlineHelpers") ? promiseResolve() : helperReference(this.plugin, path, "_await");
          argument.replaceWith(types.callExpression(target, []));
        }
      }
    }
  };
  function checkForErrorsAndRewriteReturns(path, plugin, rewriteReturns = false) {
    const state = {
      rewriteReturns,
      plugin,
      canThrow: false
    };
    path.traverse(checkForErrorsAndRewriteReturnsVisitor, state);
    return state.canThrow;
  }
  const rewriteTopLevelReturnsVisitor = {
    Function: skipNode,
    ReturnStatement(path) {
      const argument = path.get("argument");
      if (argument.isCallExpression()) {
        const callArgs = argument.node.arguments;
        switch (callArgs.length) {
          case 3:
          case 2:
            {
              const secondArgument = callArgs[1];
              if (!types.isUnaryExpression(secondArgument) || secondArgument.operator !== "void") {
                break;
              }
            }
          case 1:
            if (types.isIdentifier(argument.node.callee) || types.isMemberExpression(argument.node.callee)) {
              const firstArgument = callArgs[0];
              if (types.isExpression(firstArgument)) {
                switch (helperNameMap.get(argument.node.callee)) {
                  case "_promiseResolve":
                  case "_await":
                    argument.replaceWith(firstArgument);
                    break;
                  case "_call":
                    argument.replaceWith(types.callExpression(firstArgument, []));
                    break;
                }
              }
            }
            break;
        }
      }
    }
  };
  function reorderPathBeforeSiblingStatements(targetPath) {
    for (const sibling of targetPath.getAllPrevSiblings().reverse()) {
      if (!sibling.isFunctionDeclaration() && !sibling.isImportDeclaration()) {
        const newNode = targetPath.node;
        targetPath.remove();
        reregisterDeclarations(sibling.insertBefore(newNode));
        return;
      }
    }
  }
  function reregisterDeclarations(pathOrPaths) {
    if (Array.isArray(pathOrPaths)) {
      for (const path of pathOrPaths) {
        reregisterDeclarations(path);
      }
    } else if (pathOrPaths && pathOrPaths.isLabeledStatement) {
      const scope = pathOrPaths.isFunction() ? pathOrPaths.parentPath.scope : pathOrPaths.scope;
      if (pathOrPaths.isVariableDeclaration() || pathOrPaths.isFunctionDeclaration() || pathOrPaths.isClassDeclaration()) {
        scope.registerDeclaration(pathOrPaths);
      }
      pathOrPaths.traverse(reregisterVariableVisitor, {
        originalScope: pathOrPaths.scope
      });
    }
  }
  function getPreviousSibling(targetPath) {
    const siblings = targetPath.getAllPrevSiblings();
    return siblings.length !== 0 ? siblings[siblings.length - 1] : undefined;
  }
  function getNextSibling(targetPath) {
    const siblings = targetPath.getAllNextSiblings();
    return siblings.length !== 0 ? siblings[0] : undefined;
  }
  function rewriteDefaultArguments(targetPath) {
    const statements = [];
    const params = targetPath.get("params");
    const literals = [];
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      if (param.isAssignmentPattern()) {
        const init = param.get("right");
        if (!isExpressionOfLiterals(init, literals)) {
          const left = param.get("left");
          let id;
          let after;
          if (left.isIdentifier()) {
            id = left.node;
          } else {
            id = left.scope.generateUidIdentifier(`arg${i}`);
            after = types.variableDeclaration("let", [types.variableDeclarator(left.node, id)]);
          }
          const initNode = init.node;
          param.replaceWith(id);
          const isMissing = types.binaryExpression("===", id, types.identifier("undefined"));
          const assignment = types.expressionStatement(types.assignmentExpression("=", id, initNode));
          statements.push(types.ifStatement(isMissing, assignment));
          if (after) {
            statements.push(after);
          }
        }
      } else if (param.isIdentifier()) {
        literals.push(param.node.name);
      }
    }
    if (statements.length) {
      targetPath.node.body.body = statements.concat(targetPath.node.body.body);
    }
  }
  const unwrapReturnPromiseVisitor = {
    ReturnStatement(path) {
      const argument = path.get("argument");
      if (argument.isCallExpression()) {
        switch (promiseCallExpressionType(argument.node)) {
          case "all":
          case "race":
          case "resolve":
            switch (argument.node.arguments.length) {
              case 0:
                path.replaceWith(types.returnStatement());
                break;
              case 1:
                const arg0 = argument.node.arguments[0];
                if (types.isExpression(arg0)) {
                  path.replaceWith(types.returnStatement(arg0));
                }
                break;
            }
            break;
        }
      }
    }
  };
  const findAwaitExpressionVisitor = {
    AwaitExpression(path) {
      this.awaitPath = path;
      path.stop();
    }
  };
  return {
    name: "transform-async-to-promises",
    manipulateOptions(_options, parserOptions) {
      parserOptions.plugins.push("asyncGenerators");
    },
    visitor: {
      AwaitExpression(path) {
        if (!path.getFunctionParent() && !this.hasTopLevelAwait) {
          this.hasTopLevelAwait = true;
        }
      },
      ImportDeclaration: {
        exit(path) {
          if (this.hasTopLevelAwait && readConfigKey(this.opts, "topLevelAwait") === "simple") {
            throw path.buildCodeFrameError(`Cannot import after a top-level await when using topLevelAwait: "simple"!`, TypeError);
          }
        }
      },
      ExportDeclaration: {
        exit(path) {
          if (this.hasTopLevelAwait && readConfigKey(this.opts, "topLevelAwait") === "simple") {
            throw path.buildCodeFrameError(`Cannot export after a top-level await when using topLevelAwait: "simple"!`, TypeError);
          }
        }
      },
      Program: {
        exit(path) {
          if (this.hasTopLevelAwait) {
            let rediscoverState = {};
            path.traverse(findAwaitExpressionVisitor, rediscoverState);
            if (rediscoverState.awaitPath !== undefined) {
              const functionParent = rediscoverState.awaitPath.getFunctionParent();
              const topLevelAwaitParent = functionParent ? functionParent.get("body") : path;
              switch (readConfigKey(this.opts, "topLevelAwait")) {
                case "simple":
                  {
                    rewriteAsyncBlock({
                      state: this
                    }, topLevelAwaitParent, [], undefined, false, true);
                    break;
                  }
                case "return":
                  {
                    helperReference(this, path, '_async');
                    rewriteAsyncBlock({
                      state: this
                    }, topLevelAwaitParent, [], undefined, false, false);
                    break;
                  }
                case "ignore":
                  break;
                default:
                  throw rediscoverState.awaitPath.buildCodeFrameError(`Top level await is not supported unless experimental topLevelAwait: "simple" or topLevelAwait: "return" options are specified!`, TypeError);
              }
            }
          }
          const usedHelpers = this.usedHelpers;
          if (usedHelpers !== undefined) {
            const file = getFile(path);
            for (const helperName of Object.keys(usedHelpers)) {
              const helper = helpers[helperName];
              const value = cloneNode(helper.value);
              const newPath = insertHelper(file.path, value);
              newPath.traverse({
                Identifier(identifierPath) {
                  const name = identifierPath.node.name;
                  if (Object.hasOwnProperty.call(helpers, name)) {
                    identifierPath.replaceWith(file.declarations[name]);
                  }
                }
              });
            }
          }
        }
      },
      FunctionDeclaration(path) {
        if (!readConfigKey(this.opts, 'asyncAwait')) {
          return;
        }
        const node = path.node;
        if (node.async) {
          const expression = types.functionExpression(undefined, node.params, node.body, node.generator, node.async);
          if (node.id === null || node.id === undefined) {
            path.replaceWith(expression);
            reregisterDeclarations(path);
            return;
          }
          const declarators = [types.variableDeclarator(node.id, expression)];
          if (path.parentPath.isExportDeclaration()) {
            if (path.parentPath.isExportDefaultDeclaration()) {
              const targetPath = path.parentPath;
              targetPath.replaceWith(types.variableDeclaration("const", declarators));
              reregisterDeclarations(targetPath);
              reregisterDeclarations(targetPath.insertAfter(types.exportDefaultDeclaration(node.id)));
              reorderPathBeforeSiblingStatements(targetPath);
            } else {
              path.replaceWith(types.variableDeclaration("const", declarators));
              reregisterDeclarations(path);
              reorderPathBeforeSiblingStatements(path.parentPath);
            }
          } else {
            path.replaceWith(types.variableDeclaration("const", declarators));
            reregisterDeclarations(path);
            reorderPathBeforeSiblingStatements(path);
          }
        }
      },
      ArrowFunctionExpression(path) {
        if (!readConfigKey(this.opts, 'asyncAwait')) {
          return;
        }
        const node = path.node;
        if (node.async) {
          rewriteThisExpressions(path, path.getFunctionParent() || path.scope.getProgramParent().path);
          const body = types.isBlockStatement(path.node.body) ? path.node.body : blockStatement([types.returnStatement(path.node.body)]);
          path.replaceWith(types.functionExpression(undefined, node.params, body, false, node.async));
          reregisterDeclarations(path);
        }
      },
      FunctionExpression(path) {
        if (!readConfigKey(this.opts, 'asyncAwait')) {
          return;
        }
        if (path.node.async) {
          const id = path.node.id;
          if (path.parentPath.isExportDefaultDeclaration() && id !== null && id !== undefined) {
            const targetPath = path.parentPath;
            targetPath.replaceWith(types.variableDeclaration("const", [types.variableDeclarator(id, types.functionExpression(undefined, path.node.params, path.node.body, path.node.generator, path.node.async))]));
            reregisterDeclarations(targetPath);
            reregisterDeclarations(targetPath.insertAfter(types.exportDefaultDeclaration(id)));
            reorderPathBeforeSiblingStatements(targetPath);
            return;
          }
          rewriteDefaultArguments(path);
          rewriteThisArgumentsAndHoistFunctions(path, path, false);
          const bodyPath = path.get("body");
          if (path.node.generator) {
            const generatorIdentifier = path.scope.generateUidIdentifier("generator");
            path.scope.push({
              kind: "const",
              id: generatorIdentifier,
              unique: true
            });
            const generatorBinding = path.scope.getBinding(generatorIdentifier.name);
            if (typeof generatorBinding === "undefined") {
              throw path.buildCodeFrameError(`Could not find newly created binding for ${generatorIdentifier.name}!`, Error);
            }
            rewriteAsyncBlock({
              state: this,
              generatorIdentifier
            }, bodyPath, []);
            generatorBinding.path.remove();
            path.replaceWith(functionize(this, path.node.params, types.newExpression(helperReference(this, path, "_AsyncGenerator"), [functionize(this, [generatorIdentifier], bodyPath.node, path)]), path, id));
          } else {
            rewriteAsyncBlock({
              state: this
            }, path, []);
            const inlineHelpers = readConfigKey(this.opts, "inlineHelpers");
            const canThrow = checkForErrorsAndRewriteReturns(bodyPath, this, inlineHelpers || id !== null && id !== undefined);
            const parentPath = path.parentPath;
            const skipReturn = parentPath.isCallExpression() && parentPath.node.callee === path.node && parentPath.parentPath.isExpressionStatement();
            if (!skipReturn && !pathsReturnOrThrowCurrentNodes(bodyPath).all) {
              const awaitHelper = inlineHelpers ? promiseResolve() : helperReference(this, path, "_await");
              path.node.body.body.push(types.returnStatement(types.callExpression(awaitHelper, [])));
            }
            if (skipReturn) {
              path.traverse(unwrapReturnPromiseVisitor);
            }
            if (canThrow) {
              if (inlineHelpers || id) {
                if (!id && skipReturn && parentPath.isCallExpression() && parentPath.node.arguments.length === 0 && !pathsReturn(bodyPath).any) {
                  parentPath.parentPath.replaceWith(types.tryStatement(bodyPath.node, types.catchClause(types.identifier("e"), blockStatement([types.expressionStatement(types.callExpression(types.memberExpression(types.identifier("Promise"), types.identifier("reject")), [types.identifier("e")]))]))));
                } else {
                  path.replaceWith(functionize(this, path.node.params, blockStatement(types.tryStatement(bodyPath.node, types.catchClause(types.identifier("e"), blockStatement([(skipReturn ? types.expressionStatement : types.returnStatement)(types.callExpression(types.memberExpression(types.identifier("Promise"), types.identifier("reject")), [types.identifier("e")]))])))), path, id));
                }
              } else {
                bodyPath.traverse(rewriteTopLevelReturnsVisitor);
                path.replaceWith(types.callExpression(helperReference(this, path, "_async"), [functionize(this, path.node.params, bodyPath.node, path)]));
              }
            } else {
              if (!inlineHelpers) {
                checkForErrorsAndRewriteReturns(bodyPath, this, true);
              }
              path.replaceWith(functionize(this, path.node.params, bodyPath.node, path, id));
            }
          }
          nodeIsAsyncSet.add(path.node);
        }
      },
      ClassMethod(path) {
        if (!readConfigKey(this.opts, 'asyncAwait')) {
          return;
        }
        if (path.node.async) {
          const body = path.get("body");
          if (path.node.kind === "method") {
            rewriteDefaultArguments(path);
            body.replaceWith(types.blockStatement([body.node]));
            const target = body.get("body")[0];
            if (!target.isBlockStatement()) {
              throw path.buildCodeFrameError(`Expected a BlockStatement, got a ${target.type}`, TypeError);
            }
            if (path.node.generator) {
              const generatorIdentifier = target.scope.generateUidIdentifier("generator");
              target.scope.push({
                kind: "const",
                id: generatorIdentifier,
                init: generatorIdentifier,
                unique: true
              });
              const generatorBinding = target.scope.getBinding(generatorIdentifier.name);
              if (typeof generatorBinding === "undefined") {
                throw path.buildCodeFrameError(`Could not find newly created binding for ${generatorIdentifier.name}!`, Error);
              }
              rewriteAsyncBlock({
                state: this,
                generatorIdentifier
              }, target, []);
              generatorBinding.path.remove();
              target.replaceWith(types.returnStatement(types.newExpression(helperReference(this, path, "_AsyncGenerator"), [functionize(this, [generatorIdentifier], target.node, target)])));
            } else {
              const inlineHelpers = readConfigKey(this.opts, "inlineHelpers");
              rewriteThisArgumentsAndHoistFunctions(target, inlineHelpers ? target : body, true);
              rewriteAsyncBlock({
                state: this
              }, target, []);
              const statements = target.get("body");
              const lastStatement = statements[statements.length - 1];
              if (!lastStatement || !lastStatement.isReturnStatement()) {
                const awaitHelper = inlineHelpers ? promiseResolve() : helperReference(this, path, "_await");
                target.node.body.push(types.returnStatement(types.callExpression(awaitHelper, [])));
              }
              const canThrow = checkForErrorsAndRewriteReturns(body, this, true);
              if (!canThrow) {
                target.replaceWithMultiple(target.node.body);
              } else if (inlineHelpers) {
                target.replaceWith(types.tryStatement(target.node, types.catchClause(types.identifier("e"), blockStatement([types.returnStatement(types.callExpression(types.memberExpression(types.identifier("Promise"), types.identifier("reject")), [types.identifier("e")]))]))));
              } else {
                target.replaceWith(types.returnStatement(types.callExpression(helperReference(this, path, "_call"), [functionize(this, [], target.node, path)])));
              }
            }
          }
          path.replaceWith(types.classMethod(path.node.kind, path.node.key, path.node.params, path.node.body, path.node.computed, path.node.static));
        }
      },
      ObjectMethod(path) {
        if (!readConfigKey(this.opts, 'asyncAwait')) {
          return;
        }
        if (path.node.async) {
          if (path.node.kind === "method") {
            path.replaceWith(types.objectProperty(path.node.key, types.functionExpression(undefined, path.node.params, path.node.body, path.node.generator, path.node.async), path.node.computed, false, path.node.decorators));
          }
        }
      }
    }
  };
}

const systemJsClientFileUrlDefault = new URL("./js/s.js", import.meta.url).href;
const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl = systemJsClientFileUrlDefault,
  urlInfo,
  jsModuleUrlInfo
}) => {
  let jsClassicFormat;
  if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
    // if it's an entry point without dependency (it does not use import)
    // then we can use UMD
    jsClassicFormat = "umd";
  } else {
    // otherwise we have to use system in case it's imported
    // by an other file (for entry points)
    // or to be able to import when it uses import
    jsClassicFormat = "system";
  }
  urlInfo.data.jsClassicFormat = jsClassicFormat;
  const {
    code,
    map
  } = await applyBabelPlugins({
    babelPlugins: [...(jsClassicFormat === "system" ? [
    // proposal-dynamic-import required with systemjs for babel8:
    // https://github.com/babel/babel/issues/10746
    requireFromJsenv("@babel/plugin-proposal-dynamic-import"), requireFromJsenv("@babel/plugin-transform-modules-systemjs"), [babelPluginRelativeImports, {
      rootUrl: jsModuleUrlInfo.url
    }], [default_1, {
      asyncAwait: false,
      // already handled + we might not needs it at all
      topLevelAwait: "return"
    }]] : [[requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
      asyncAwait: false,
      // already handled + we might not needs it at all
      topLevelAwait: "simple"
    }], babelPluginTransformImportMetaUrl, babelPluginTransformImportMetaResolve, requireFromJsenv("@babel/plugin-transform-modules-umd"), [babelPluginRelativeImports, {
      rootUrl: jsModuleUrlInfo.url
    }]])],
    urlInfo: jsModuleUrlInfo
  });
  let sourcemap = jsModuleUrlInfo.sourcemap;
  sourcemap = await composeTwoSourcemaps(sourcemap, map);
  if (systemJsInjection && jsClassicFormat === "system" && urlInfo.isEntryPoint) {
    const magicSource = createMagicSource(code);
    let systemJsFileContent = readFileSync(systemJsClientFileUrl, {
      as: "string"
    });
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: "text/javascript",
      content: systemJsFileContent
    });
    if (sourcemapFound) {
      // for now let's remove s.js sourcemap
      // because it would likely mess the sourcemap of the entry point itself
      systemJsFileContent = SOURCEMAP.writeComment({
        contentType: "text/javascript",
        content: systemJsFileContent,
        specifier: ""
      });
    }
    magicSource.prepend(`${systemJsFileContent}\n\n`);
    const magicResult = magicSource.toContentAndSourcemap();
    sourcemap = await composeTwoSourcemaps(sourcemap, magicResult.sourcemap);
    return {
      content: magicResult.content,
      sourcemap
    };
  }
  return {
    content: code,
    sourcemap
  };
};

/*
 * When systemjs or umd format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * This can be mitigated by minification that will rename them.
 * But to fix this issue once and for all there is babelPluginRelativeImports below
 */
const babelPluginRelativeImports = babel => {
  const t = babel.types;
  const replaceSpecifierAtPath = (path, state) => {
    const specifier = path.node.value;
    if (specifier.startsWith("file://")) {
      const specifierRelative = urlToRelativeUrl(specifier, state.opts.rootUrl);
      path.replaceWith(t.stringLiteral(specifierRelative));
    }
  };
  return {
    name: "relative-imports",
    visitor: {
      CallExpression: (path, state) => {
        if (path.node.callee.type !== "Import") {
          // Some other function call, not import();
          return;
        }
        if (path.node.arguments[0].type !== "StringLiteral") {
          // Non-string argument, probably a variable or expression, e.g.
          // import(moduleId)
          // import('./' + moduleName)
          return;
        }
        const sourcePath = path.get("arguments")[0];
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state);
        }
      },
      ImportDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        replaceSpecifierAtPath(sourcePath, state);
      },
      ExportAllDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        replaceSpecifierAtPath(sourcePath, state);
      },
      ExportNamedDeclaration: (path, state) => {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return;
        }
        const sourcePath = path.get("source");
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state);
        }
      }
    }
  };
};

/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */
const jsenvPluginJsModuleConversion = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename
}) => {
  const isReferencingJsModule = reference => {
    if (reference.type === "js_import" || reference.subtype === "system_register_arg" || reference.subtype === "system_import_arg") {
      return true;
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true;
    }
    return false;
  };
  const shouldPropagateJsModuleConversion = (reference, context) => {
    if (isReferencingJsModule(reference)) {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
      if (!parentUrlInfo) {
        return false;
      }
      const parentGotAsJsClassic = new URL(parentUrlInfo.url).searchParams.has("js_module_fallback");
      return parentGotAsJsClassic;
    }
    return false;
  };
  const markAsJsClassicProxy = reference => {
    reference.expectedType = "js_classic";
    reference.filename = generateJsClassicFilename(reference.url);
  };
  const turnIntoJsClassicProxy = reference => {
    const urlTransformed = injectQueryParams(reference.url, {
      js_module_fallback: ""
    });
    markAsJsClassicProxy(reference);
    return urlTransformed;
  };
  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectUrl: (reference, context) => {
      if (reference.searchParams.has("js_module_fallback")) {
        markAsJsClassicProxy(reference);
        return null;
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference, context)) {
        return turnIntoJsClassicProxy(reference);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "js_module_fallback",
        // override the expectedType to "js_module"
        // because when there is ?js_module_fallback it means the underlying resource
        // is a js_module
        expectedType: "js_module"
      });
      if (!jsModuleReference) {
        return null;
      }
      await context.fetchUrlContent(jsModuleUrlInfo, {
        reference: jsModuleReference
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsModuleReference.subtype,
          specifier: jsModuleReference.url,
          expectedType: "js_module"
        });
      } else if (context.build && jsModuleUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(jsModuleUrlInfo.url);
      }
      const {
        content,
        sourcemap
      } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: context.rootDirectoryUrl,
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo,
        jsModuleUrlInfo
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data
      };
    }
  };
};

/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */
const jsenvPluginJsModuleFallbackInsideHtml = ({
  systemJsInjection,
  systemJsClientFileUrl
}) => {
  const turnIntoJsClassicProxy = reference => {
    return injectQueryParams(reference.url, {
      js_module_fallback: ""
    });
  };
  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    redirectUrl: {
      link_href: (reference, context) => {
        if (context.systemJsTranspilation && reference.subtype === "modulepreload") {
          return turnIntoJsClassicProxy(reference);
        }
        if (context.systemJsTranspilation && reference.subtype === "preload" && reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference, context) => {
        if (context.systemJsTranspilation && reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference, context) => {
        if (context.systemJsTranspilation && reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      }
    },
    finalizeUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        visitHtmlNodes(htmlAst, {
          link: node => {
            const rel = getHtmlNodeAttribute(node, "rel");
            if (rel !== "modulepreload" && rel !== "preload") {
              return;
            }
            const href = getHtmlNodeAttribute(node, "href");
            if (!href) {
              return;
            }
            const reference = context.referenceUtils.find(ref => ref.generatedSpecifier === href && ref.type === "link_href" && ref.subtype === rel);
            if (!isOrWasExpectingJsModule(reference)) {
              return;
            }
            if (rel === "modulepreload" && reference.expectedType === "js_classic") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  rel: "preload",
                  as: "script",
                  crossorigin: undefined
                });
              });
            }
            if (rel === "preload" && reference.expectedType === "js_classic") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  crossorigin: undefined
                });
              });
            }
          },
          script: node => {
            const {
              type
            } = analyzeScriptNode(node);
            if (type !== "js_module") {
              return;
            }
            const src = getHtmlNodeAttribute(node, "src");
            if (src) {
              const reference = context.referenceUtils.find(ref => ref.generatedSpecifier === src && ref.type === "script" && ref.subtype === "js_module");
              if (!reference) {
                return;
              }
              if (reference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, {
                    type: undefined
                  });
                });
              }
            } else if (context.systemJsTranspilation) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  type: undefined
                });
              });
            }
          }
        });
        if (systemJsInjection) {
          let needsSystemJs = false;
          for (const reference of urlInfo.references) {
            if (reference.isResourceHint) {
              // we don't cook resource hints
              // because they might refer to resource that will be modified during build
              // It also means something else HAVE to reference that url in order to cook it
              // so that the preload is deleted by "resync_resource_hints.js" otherwise
              continue;
            }
            if (isOrWasExpectingJsModule(reference)) {
              const dependencyUrlInfo = context.urlGraph.getUrlInfo(reference.url);
              try {
                await context.cook(dependencyUrlInfo, {
                  reference
                });
                if (dependencyUrlInfo.data.jsClassicFormat === "system") {
                  needsSystemJs = true;
                  break;
                }
              } catch (e) {
                if (context.dev && e.code !== "PARSE_ERROR") {
                  needsSystemJs = true;
                  // ignore cooking error, the browser will trigger it again on fetch
                  // + disable cache for this html file because when browser will reload
                  // the error might be gone and we might need to inject systemjs
                  urlInfo.headers["cache-control"] = "no-store";
                } else {
                  throw e;
                }
              }
            }
          }
          if (needsSystemJs) {
            mutations.push(async () => {
              let systemJsFileContent = readFileSync$1(new URL(systemJsClientFileUrl), {
                encoding: "utf8"
              });
              const sourcemapFound = SOURCEMAP.readComment({
                contentType: "text/javascript",
                content: systemJsFileContent
              });
              if (sourcemapFound) {
                const sourcemapFileUrl = new URL(sourcemapFound.specifier, systemJsClientFileUrl);
                systemJsFileContent = SOURCEMAP.writeComment({
                  contentType: "text/javascript",
                  content: systemJsFileContent,
                  specifier: urlToRelativeUrl(sourcemapFileUrl, urlInfo.url)
                });
              }
              const [systemJsReference, systemJsUrlInfo] = context.referenceUtils.inject({
                type: "script",
                expectedType: "js_classic",
                isInline: true,
                contentType: "text/javascript",
                content: systemJsFileContent,
                specifier: "s.js"
              });
              await context.cook(systemJsUrlInfo, {
                reference: systemJsReference
              });
              injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
                tagName: "script",
                textContent: systemJsUrlInfo.content
              }), "jsenv:js_module_fallback");
            });
          }
        }
        if (mutations.length === 0) {
          return null;
        }
        await Promise.all(mutations.map(mutation => mutation()));
        return stringifyHtmlAst(htmlAst);
      }
    }
  };
};
const isOrWasExpectingJsModule = reference => {
  if (isExpectingJsModule(reference)) {
    return true;
  }
  if (reference.original && isExpectingJsModule(reference.original)) {
    return true;
  }
  return false;
};
const isExpectingJsModule = reference => {
  return reference.expectedType === "js_module" || reference.searchParams.has("js_module_fallback") || reference.searchParams.has("as_js_classic");
};

/*
 * when {type: "module"} cannot be used on web workers:
 * - new Worker("worker.js", { type: "module" })
 *   transformed into
 *   new Worker("worker.js?js_module_fallback", { type: " lassic" })
 * - navigator.serviceWorker.register("service_worker.js", { type: "module" })
 *   transformed into
 *   navigator.serviceWorker.register("service_worker.js?js_module_fallback", { type: "classic" })
 * - new SharedWorker("shared_worker.js", { type: "module" })
 *   transformed into
 *   new SharedWorker("shared_worker.js?js_module_fallback", { type: "classic" })
 */
const jsenvPluginJsModuleFallbackOnWorkers = () => {
  const turnIntoJsClassicProxy = reference => {
    reference.mutation = magicSource => {
      magicSource.replace({
        start: reference.typePropertyNode.value.start,
        end: reference.typePropertyNode.value.end,
        replacement: JSON.stringify("classic")
      });
    };
    return injectQueryParams(reference.url, {
      js_module_fallback: ""
    });
  };
  return {
    name: "jsenv:js_module_fallback_on_workers",
    appliesDuring: "*",
    redirectUrl: {
      js_url: (reference, context) => {
        if (reference.expectedType !== "js_module") {
          return null;
        }
        if (reference.expectedSubtype === "worker") {
          if (context.isSupportedOnCurrentClients("worker_type_module")) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        if (reference.expectedSubtype === "service_worker") {
          if (context.isSupportedOnCurrentClients("service_worker_type_module")) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        if (reference.expectedSubtype === "shared_worker") {
          if (context.isSupportedOnCurrentClients("shared_worker_type_module")) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      }
    }
  };
};

const jsenvPluginJsModuleFallback = ({
  systemJsInjection = true,
  systemJsClientFileUrl = systemJsClientFileUrlDefault
}) => {
  return [jsenvPluginJsModuleFallbackInsideHtml({
    systemJsInjection,
    systemJsClientFileUrl
  }), jsenvPluginJsModuleFallbackOnWorkers(), jsenvPluginJsModuleConversion({
    systemJsInjection,
    systemJsClientFileUrl,
    generateJsClassicFilename
  })];
};
const generateJsClassicFilename = url => {
  const filename = urlToFilename$1(url);
  let [basename, extension] = splitFileExtension$2(filename);
  const {
    searchParams
  } = new URL(url);
  if (searchParams.has("as_json_module") || searchParams.has("as_css_module") || searchParams.has("as_text_module")) {
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};
const splitFileExtension$2 = filename => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

// duplicated from @jsenv/log to avoid the dependency
const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;
  Object.keys(details).forEach(key => {
    const value = details[key];
    string += `
    --- ${key} ---
    ${Array.isArray(value) ? value.join(`
    `) : value}`;
  });
  return string;
};

const assertImportMap = value => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`);
  }
  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`);
  }
  if (Array.isArray(value)) {
    throw new TypeError(`an importMap must be an object, received array ${value}`);
  }
};

const hasScheme = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

const urlToScheme = urlString => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return "";
  return urlString.slice(0, colonIndex);
};

const urlToPathname = urlString => {
  return ressourceToPathname(urlToRessource(urlString));
};
const urlToRessource = urlString => {
  const scheme = urlToScheme(urlString);
  if (scheme === "file") {
    return urlString.slice("file://".length);
  }
  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex);
  }
  return urlString.slice(scheme.length + 1);
};
const ressourceToPathname = ressource => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
};

const urlToOrigin = urlString => {
  const scheme = urlToScheme(urlString);
  if (scheme === "file") {
    return "file://";
  }
  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);
    if (pathnameSlashIndex === -1) return urlString;
    return urlString.slice(0, pathnameSlashIndex);
  }
  return urlString.slice(0, scheme.length + 1);
};

const pathnameToParentPathname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous
const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({
        baseUrl,
        specifier
      }));
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({
        baseUrl,
        specifier
      }));
    }
  }
  if (hasScheme(specifier)) {
    return specifier;
  }
  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({
      baseUrl,
      specifier
    }));
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`;
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`;
  }
  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname(baseUrl);
  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`;
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`;
  }

  // pathname relative outside
  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();
    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3);
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop();
      }
    }
    const resolvedPathname = `${importerFolders.join("/")}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`;
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`;
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`;
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`;
};
const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;
const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;
const writeBaseUrlRequired = ({
  baseUrl,
  specifier
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null;
};

const resolveSpecifier = (specifier, importer) => {
  if (specifier === "." || specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveUrl(specifier, importer);
  }
  if (hasScheme(specifier)) {
    return specifier;
  }
  return null;
};

const applyImportMap = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({
    specifier,
    importer
  }) => {
    return new Error(createDetailedMessage(`Unmapped bare specifier.`, {
      specifier,
      importer
    }));
  },
  onImportMapping = () => {}
}) => {
  assertImportMap(importMap);
  if (typeof specifier !== "string") {
    throw new TypeError(createDetailedMessage("specifier must be a string.", {
      specifier,
      importer
    }));
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(createDetailedMessage("importer must be a string.", {
        importer,
        specifier
      }));
    }
    if (!hasScheme(importer)) {
      throw new Error(createDetailedMessage(`importer must be an absolute url.`, {
        importer,
        specifier
      }));
    }
  }
  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;
  const {
    scopes
  } = importMap;
  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(scopeSpecifier => {
      return scopeSpecifier === importer || specifierIsPrefixOf(scopeSpecifier, importer);
    });
    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings(scopeMappings, specifierNormalized, scopeSpecifierMatching, onImportMapping);
      if (mappingFromScopes !== null) {
        return mappingFromScopes;
      }
    }
  }
  const {
    imports
  } = importMap;
  if (imports) {
    const mappingFromImports = applyMappings(imports, specifierNormalized, undefined, onImportMapping);
    if (mappingFromImports !== null) {
      return mappingFromImports;
    }
  }
  if (specifierUrl) {
    return specifierUrl;
  }
  throw createBareSpecifierError({
    specifier,
    importer
  });
};
const applyMappings = (mappings, specifierNormalized, scope, onImportMapping) => {
  const specifierCandidates = Object.keys(mappings);
  let i = 0;
  while (i < specifierCandidates.length) {
    const specifierCandidate = specifierCandidates[i];
    i++;
    if (specifierCandidate === specifierNormalized) {
      const address = mappings[specifierCandidate];
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: address
      });
      return address;
    }
    if (specifierIsPrefixOf(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(specifierCandidate.length);
      const addressFinal = tryUrlResolution(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal
      });
      return addressFinal;
    }
  }
  return null;
};
const specifierIsPrefixOf = (specifierHref, href) => {
  return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
};

// https://github.com/systemjs/systemjs/blob/89391f92dfeac33919b0223bbf834a1f4eea5750/src/common.js#L136
const composeTwoImportMaps = (leftImportMap, rightImportMap) => {
  assertImportMap(leftImportMap);
  assertImportMap(rightImportMap);
  const importMap = {};
  const leftImports = leftImportMap.imports;
  const rightImports = rightImportMap.imports;
  const leftHasImports = Boolean(leftImports);
  const rightHasImports = Boolean(rightImports);
  if (leftHasImports && rightHasImports) {
    importMap.imports = composeTwoMappings(leftImports, rightImports);
  } else if (leftHasImports) {
    importMap.imports = {
      ...leftImports
    };
  } else if (rightHasImports) {
    importMap.imports = {
      ...rightImports
    };
  }
  const leftScopes = leftImportMap.scopes;
  const rightScopes = rightImportMap.scopes;
  const leftHasScopes = Boolean(leftScopes);
  const rightHasScopes = Boolean(rightScopes);
  if (leftHasScopes && rightHasScopes) {
    importMap.scopes = composeTwoScopes(leftScopes, rightScopes, importMap.imports || {});
  } else if (leftHasScopes) {
    importMap.scopes = {
      ...leftScopes
    };
  } else if (rightHasScopes) {
    importMap.scopes = {
      ...rightScopes
    };
  }
  return importMap;
};
const composeTwoMappings = (leftMappings, rightMappings) => {
  const mappings = {};
  Object.keys(leftMappings).forEach(leftSpecifier => {
    if (objectHasKey(rightMappings, leftSpecifier)) {
      // will be overidden
      return;
    }
    const leftAddress = leftMappings[leftSpecifier];
    const rightSpecifier = Object.keys(rightMappings).find(rightSpecifier => {
      return compareAddressAndSpecifier(leftAddress, rightSpecifier);
    });
    mappings[leftSpecifier] = rightSpecifier ? rightMappings[rightSpecifier] : leftAddress;
  });
  Object.keys(rightMappings).forEach(rightSpecifier => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier];
  });
  return mappings;
};
const objectHasKey = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const compareAddressAndSpecifier = (address, specifier) => {
  const addressUrl = resolveUrl(address, "file:///");
  const specifierUrl = resolveUrl(specifier, "file:///");
  return addressUrl === specifierUrl;
};
const composeTwoScopes = (leftScopes, rightScopes, imports) => {
  const scopes = {};
  Object.keys(leftScopes).forEach(leftScopeKey => {
    if (objectHasKey(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
      return;
    }
    const topLevelSpecifier = Object.keys(imports).find(topLevelSpecifierCandidate => {
      return compareAddressAndSpecifier(leftScopeKey, topLevelSpecifierCandidate);
    });
    if (topLevelSpecifier) {
      scopes[imports[topLevelSpecifier]] = leftScopes[leftScopeKey];
    } else {
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
    }
  });
  Object.keys(rightScopes).forEach(rightScopeKey => {
    if (objectHasKey(scopes, rightScopeKey)) {
      scopes[rightScopeKey] = composeTwoMappings(scopes[rightScopeKey], rightScopes[rightScopeKey]);
    } else {
      scopes[rightScopeKey] = {
        ...rightScopes[rightScopeKey]
      };
    }
  });
  return scopes;
};

const sortImports = imports => {
  const mappingsSorted = {};
  Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(name => {
    mappingsSorted[name] = imports[name];
  });
  return mappingsSorted;
};
const sortScopes = scopes => {
  const scopesSorted = {};
  Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(scopeSpecifier => {
    scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
  });
  return scopesSorted;
};
const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b);
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);
  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({
      baseUrl
    }));
  }
  const {
    imports,
    scopes
  } = importMap;
  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
  };
};
const isStringOrUrl = value => {
  if (typeof value === "string") {
    return true;
  }
  if (typeof URL === "function" && value instanceof URL) {
    return true;
  }
  return false;
};
const normalizeMappings = (mappings, baseUrl) => {
  const mappingsNormalized = {};
  Object.keys(mappings).forEach(specifier => {
    const address = mappings[specifier];
    if (typeof address !== "string") {
      console.warn(formulateAddressMustBeAString({
        address,
        specifier
      }));
      return;
    }
    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
    const addressUrl = tryUrlResolution(address, baseUrl);
    if (addressUrl === null) {
      console.warn(formulateAdressResolutionFailed({
        address,
        baseUrl,
        specifier
      }));
      return;
    }
    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(formulateAddressUrlRequiresTrailingSlash({
        addressUrl,
        address,
        specifier
      }));
      return;
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });
  return sortImports(mappingsNormalized);
};
const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};
  Object.keys(scopes).forEach(scopeSpecifier => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution(scopeSpecifier, baseUrl);
    if (scopeUrl === null) {
      console.warn(formulateScopeResolutionFailed({
        scope: scopeSpecifier,
        baseUrl
      }));
      return;
    }
    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });
  return sortScopes(scopesNormalized);
};
const formulateBaseUrlMustBeStringOrUrl = ({
  baseUrl
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;
const formulateAddressMustBeAString = ({
  specifier,
  address
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;
const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier
}) => `Address url resolution failed.
--- address ---
${address}
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;
const formulateAddressUrlRequiresTrailingSlash = ({
  addressURL,
  address,
  specifier
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;
const formulateScopeResolutionFailed = ({
  scope,
  baseUrl
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }
  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex);
};

const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {}
}) => {
  let url;
  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping
    });
  } else {
    url = resolveUrl(specifier, importer);
  }
  if (defaultExtension) {
    url = applyDefaultExtension({
      url,
      importer,
      defaultExtension
    });
  }
  return url;
};
const applyDefaultExtension = ({
  url,
  importer,
  defaultExtension
}) => {
  if (urlToPathname(url).endsWith("/")) {
    return url;
  }
  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url);
    if (extension === "") {
      return `${url}${defaultExtension}`;
    }
    return url;
  }
  if (defaultExtension === true) {
    const extension = pathnameToExtension(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`;
    }
  }
  return url;
};

/*
 * Plugin to read and apply importmap files found in html files.
 * - feeds importmap files to jsenv kitchen
 * - use importmap to resolve import (when there is one + fallback to other resolution mecanism)
 * - inline importmap with [src=""]
 *
 * A correct importmap resolution should scope importmap resolution per html file.
 * It would be doable by adding ?html_id to each js file in order to track
 * the html file importing it.
 * Considering it happens only when all the following conditions are met:
 * - 2+ html files are using an importmap
 * - the importmap used is not the same
 * - the importmap contain conflicting mappings
 * - these html files are both executed during the same scenario (dev, test, build)
 * And that it would be ugly to see ?html_id all over the place
 * -> The importmap resolution implemented here takes a shortcut and does the following:
 * - All importmap found are merged into a single one that is applied to every import specifiers
 */
const jsenvPluginImportmap = () => {
  let finalImportmap = null;
  const importmaps = {};
  const onHtmlImportmapParsed = (importmap, htmlUrl) => {
    importmaps[htmlUrl] = importmap ? normalizeImportMap(importmap, htmlUrl) : null;
    finalImportmap = Object.keys(importmaps).reduce((previous, url) => {
      const importmap = importmaps[url];
      if (!previous) {
        return importmap;
      }
      if (!importmap) {
        return previous;
      }
      return composeTwoImportMaps(previous, importmap);
    }, null);
  };
  return {
    name: "jsenv:importmap",
    appliesDuring: "*",
    resolveUrl: {
      js_import: reference => {
        if (!finalImportmap) {
          return null;
        }
        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.parentUrl,
            importMap: finalImportmap,
            onImportMapping: () => {
              fromMapping = true;
            }
          });
          if (fromMapping) {
            return result;
          }
          return null;
        } catch (e) {
          if (e.message.includes("bare specifier")) {
            // in theory we should throw to be compliant with web behaviour
            // but for now it's simpler to return null
            // and let a chance to other plugins to handle the bare specifier
            // (node esm resolution)
            // and we want importmap to be prio over node esm so we cannot put this plugin after
            return null;
          }
          throw e;
        }
      }
    },
    transformUrlContent: {
      html: async (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const importmap = findHtmlNode(htmlAst, node => {
          if (node.nodeName !== "script") {
            return false;
          }
          const type = getHtmlNodeAttribute(node, "type");
          if (type === undefined || type !== "importmap") {
            return false;
          }
          return true;
        });
        if (!importmap) {
          onHtmlImportmapParsed(null, htmlUrlInfo.url);
          return null;
        }
        const handleInlineImportmap = async (importmap, htmlNodeText) => {
          const {
            line,
            column,
            lineEnd,
            columnEnd,
            isOriginal
          } = getHtmlNodePosition(importmap, {
            preferOriginal: true
          });
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd
          });
          const [inlineImportmapReference, inlineImportmapUrlInfo] = context.referenceUtils.foundInline({
            type: "script",
            isOriginalPosition: isOriginal,
            specifierLine: line - 1,
            specifierColumn: column,
            specifier: inlineImportmapUrl,
            contentType: "application/importmap+json",
            content: htmlNodeText
          });
          await context.cook(inlineImportmapUrlInfo, {
            reference: inlineImportmapReference
          });
          setHtmlNodeText(importmap, inlineImportmapUrlInfo.content, {
            indentation: "auto"
          });
          setHtmlNodeAttributes(importmap, {
            "jsenv-cooked-by": "jsenv:importmap"
          });
          onHtmlImportmapParsed(JSON.parse(inlineImportmapUrlInfo.content), htmlUrlInfo.url);
        };
        const handleImportmapWithSrc = async (importmap, src) => {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this situation the ref to the importmap was already discovered
          // when parsing the HTML
          const importmapReference = context.referenceUtils.find(ref => ref.generatedSpecifier === src);
          const importmapUrlInfo = context.urlGraph.getUrlInfo(importmapReference.url);
          await context.cook(importmapUrlInfo, {
            reference: importmapReference
          });
          onHtmlImportmapParsed(JSON.parse(importmapUrlInfo.content), htmlUrlInfo.url);
          setHtmlNodeText(importmap, importmapUrlInfo.content, {
            indentation: "auto"
          });
          setHtmlNodeAttributes(importmap, {
            "src": undefined,
            "jsenv-inlined-by": "jsenv:importmap",
            "inlined-from-src": src
          });
          const {
            line,
            column,
            lineEnd,
            columnEnd,
            isOriginal
          } = getHtmlNodePosition(importmap, {
            preferOriginal: true
          });
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd
          });
          context.referenceUtils.becomesInline(importmapReference, {
            line: line - 1,
            column,
            isOriginal,
            specifier: inlineImportmapUrl,
            contentType: "application/importmap+json",
            content: importmapUrlInfo.content
          });
        };
        const src = getHtmlNodeAttribute(importmap, "src");
        if (src) {
          await handleImportmapWithSrc(importmap, src);
        } else {
          const htmlNodeText = getHtmlNodeText(importmap);
          if (htmlNodeText) {
            await handleInlineImportmap(importmap, htmlNodeText);
          }
        }
        // once this plugin knows the importmap, it will use it
        // to map imports. These import specifiers will be normalized
        // by "formatReferencedUrl" making the importmap presence useless.
        // In dev/test we keep importmap into the HTML to see it even if useless
        // Duing build we get rid of it
        if (context.build) {
          removeHtmlNode(importmap);
        }
        return {
          content: stringifyHtmlAst(htmlAst)
        };
      }
    }
  };
};

const urlTypeFromReference = (reference, context) => {
  if (reference.type === "sourcemap_comment") {
    return "sourcemap";
  }
  if (reference.injected) {
    return reference.expectedType;
  }
  const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
  if (parentUrlInfo) {
    return parentUrlInfo.type;
  }
  return "entry_point";
};

const isSpecifierForNodeBuiltin = specifier => {
  return specifier.startsWith("node:") || NODE_BUILTIN_MODULE_SPECIFIERS.includes(specifier);
};
const NODE_BUILTIN_MODULE_SPECIFIERS = ["assert", "assert/strict", "async_hooks", "buffer_ieee754", "buffer", "child_process", "cluster", "console", "constants", "crypto", "_debugger", "dgram", "dns", "domain", "events", "freelist", "fs", "fs/promises", "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server", "http", "http2", "https", "inspector", "_linklist", "module", "net", "node-inspect/lib/_inspect", "node-inspect/lib/internal/inspect_client", "node-inspect/lib/internal/inspect_repl", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "smalloc", "_stream_duplex", "_stream_transform", "_stream_wrap", "_stream_passthrough", "_stream_readable", "_stream_writable", "stream", "stream/promises", "string_decoder", "sys", "timers", "_tls_common", "_tls_legacy", "_tls_wrap", "tls", "trace_events", "tty", "url", "util", "v8/tools/arguments", "v8/tools/codemap", "v8/tools/consarray", "v8/tools/csvparser", "v8/tools/logreader", "v8/tools/profile_view", "v8/tools/splaytree", "v8", "vm", "worker_threads", "zlib",
// global is special
"global"];

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
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
    }
    return `file://${resource.slice(0, slashLastIndex + 1)}`;
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};
const isValidUrl = url => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};
const urlToFilename = url => {
  const {
    pathname
  } = new URL(url);
  const pathnameBeforeLastSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename = slashLastIndex === -1 ? pathnameBeforeLastSlash : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};
const urlToExtension = url => {
  const filename = urlToFilename(url);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
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
  const buffer = readFileSync$1(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch (e) {
    throw new Error(`Invalid package configuration`);
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473
const createInvalidModuleSpecifierError = (reason, specifier, {
  parentUrl
}) => {
  const error = new Error(`Invalid module "${specifier}" ${reason} imported from ${fileURLToPath(parentUrl)}`);
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
    message = `Invalid "exports" main target defined in ${fileURLToPath(packageDirectoryUrl)}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
  } else {
    message = `Invalid "${isImport ? "imports" : "exports"}" target ${JSON.stringify(target)} defined for "${key}" in ${fileURLToPath(packageDirectoryUrl)}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
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
    message = `No "exports" main defined in ${fileURLToPath(packageDirectoryUrl)}package.json imported from ${fileURLToPath(parentUrl)}`;
  } else {
    message = `Package subpath "${subpath}" is not defined by "exports" in ${fileURLToPath(packageDirectoryUrl)}package.json imported from ${fileURLToPath(parentUrl)}`;
  }
  const error = new Error(message);
  error.code = "PACKAGE_PATH_NOT_EXPORTED";
  return error;
};
const createModuleNotFoundError = (specifier, {
  parentUrl
}) => {
  const error = new Error(`Cannot find "${specifier}" imported from ${fileURLToPath(parentUrl)}`);
  error.code = "MODULE_NOT_FOUND";
  return error;
};
const createPackageImportNotDefinedError = (specifier, {
  parentUrl,
  packageDirectoryUrl
}) => {
  const error = new Error(`Package import specifier "${specifier}" is not defined in ${fileURLToPath(packageDirectoryUrl)}package.json imported from ${fileURLToPath(parentUrl)}`);
  error.code = "PACKAGE_IMPORT_NOT_DEFINED";
  return error;
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
      throw createInvalidModuleSpecifierError(`must not include encoded "/" or "\\" characters`, specifier, {
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
  } catch (e) {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution(specifier, resolutionContext);
    if (browserFieldResolution) {
      return browserFieldResolution;
    }
    const packageResolution = applyPackageResolve(specifier, resolutionContext);
    const search = new URL(specifier, "file://").search;
    if (search) {
      packageResolution.url = `${packageResolution.url}${search}`;
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
    const secifierRelativeNotation = `./${specifierRelativeUrl}`;
    const browserMapping = browser[secifierRelativeNotation];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifierUrl.slice("file:///")}`;
    }
  } else {
    const browserMapping = browser[specifier];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifier}`;
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
      url: `node:${packageSpecifier}`
    };
  }
  let {
    packageName,
    packageSubpath
  } = parsePackageSpecifier(packageSpecifier);
  if (packageName[0] === "." || packageName.includes("\\") || packageName.includes("%")) {
    throw createInvalidModuleSpecifierError(`is not a valid package name`, packageName, resolutionContext);
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
    const packageDirectoryFacadeUrl = new URL(`node_modules/${packageName}/`, currentUrl).href;
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
        throw createInvalidPackageTargetError(`target must be inside package`, target, resolutionContext);
      }
      return {
        type: isImport ? "field:imports" : "field:exports",
        packageDirectoryUrl,
        packageJson,
        url: pattern ? targetUrl.replaceAll("*", subpath) : new URL(subpath, targetUrl).href
      };
    }
    if (!isImport || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError(`target must starst with "./"`, target, resolutionContext);
    }
    return applyPackageResolve(pattern ? target.replaceAll("*", subpath) : `${target}${subpath}`, {
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
          key: `${key}[${i}]`,
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
  throw createInvalidPackageTargetError(`target must be a string, array, object or null`, target, resolutionContext);
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
      throw new Error(`Invalid package configuration: cannot mix relative and conditional keys in package.exports
--- unexpected keys ---
${conditionalKeys.map(key => `"${key}"`).join("\n")}
--- package directory url ---
${packageDirectoryUrl}`);
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
    const packageSubpath = `./${afterSecondSlash}`;
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
  const packageSubpath = `./${afterFirstSlash}`;
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
    const content = readFileSync$1(browserMainUrlObject, "utf-8");
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
  return `${packageDirectoryResolvedUrl}/`;
};

const applyFileSystemMagicResolution = (fileUrl, {
  fileStat,
  magicDirectoryIndex,
  magicExtensions
}) => {
  const result = {
    stat: null,
    url: fileUrl,
    magicExtension: "",
    magicDirectoryIndex: false,
    lastENOENTError: null
  };
  if (fileStat === undefined) {
    try {
      fileStat = statSync(new URL(fileUrl));
    } catch (e) {
      if (e.code === "ENOENT") {
        result.lastENOENTError = e;
        fileStat = null;
      } else {
        throw e;
      }
    }
  }
  if (fileStat && fileStat.isFile()) {
    result.stat = fileStat;
    result.url = fileUrl;
    return result;
  }
  if (fileStat && fileStat.isDirectory()) {
    if (magicDirectoryIndex) {
      const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index";
      const indexFileUrl = `${fileUrl}${indexFileSuffix}`;
      const subResult = applyFileSystemMagicResolution(indexFileUrl, {
        magicDirectoryIndex: false,
        magicExtensions
      });
      return {
        ...result,
        ...subResult,
        magicDirectoryIndex: true
      };
    }
    result.stat = fileStat;
    result.url = fileUrl;
    return result;
  }
  if (magicExtensions && magicExtensions.length) {
    const parentUrl = new URL("./", fileUrl).href;
    const urlFilename = urlToFilename(fileUrl);
    for (const extensionToTry of magicExtensions) {
      const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`;
      let stat;
      try {
        stat = statSync(new URL(urlCandidate));
      } catch (e) {
        if (e.code === "ENOENT") {
          stat = null;
        } else {
          throw e;
        }
      }
      if (stat) {
        result.stat = stat;
        result.url = `${fileUrl}${extensionToTry}`;
        result.magicExtension = extensionToTry;
        return result;
      }
    }
  }
  // magic extension not found
  return result;
};
const getExtensionsToTry = (magicExtensions, importer) => {
  if (!magicExtensions) {
    return [];
  }
  const extensionsSet = new Set();
  magicExtensions.forEach(magicExtension => {
    if (magicExtension === "inherit") {
      const importerExtension = urlToExtension(importer);
      extensionsSet.add(importerExtension);
    } else {
      extensionsSet.add(magicExtension);
    }
  });
  return Array.from(extensionsSet.values());
};

/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */
const createNodeEsmResolver = ({
  runtimeCompat,
  packageConditions,
  preservesSymlink
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [...readCustomConditionsFromProcessArgs(), nodeRuntimeEnabled ? "node" : "browser", "import"];
  return (reference, context) => {
    if (reference.type === "package_json") {
      return reference.specifier;
    }
    const parentUrl = reference.baseUrl || reference.parentUrl;
    if (!parentUrl.startsWith("file:")) {
      return new URL(reference.specifier, parentUrl).href;
    }
    const {
      url,
      type,
      packageDirectoryUrl
    } = applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier: reference.specifier,
      preservesSymlink
    });
    if (context.dev) {
      const dependsOnPackageJson = type !== "relative_specifier" && type !== "absolute_specifier" && type !== "node_builtin_specifier";
      if (dependsOnPackageJson) {
        // this reference depends on package.json and node_modules
        // to be resolved. Each file using this specifier
        // must be invalidated when corresponding package.json changes
        addRelationshipWithPackageJson({
          reference,
          context,
          packageJsonUrl: `${packageDirectoryUrl}package.json`,
          field: type.startsWith("field:") ? `#${type.slice("field:".length)}` : ""
        });
      }
    }
    if (context.dev) {
      // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules
      if (url.includes("/node_modules/")) {
        const packageDirectoryUrl = defaultLookupPackageScope(url);
        if (packageDirectoryUrl && packageDirectoryUrl !== context.rootDirectoryUrl) {
          const packageVersion = defaultReadPackageJson(packageDirectoryUrl).version;
          // package version can be null, see https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
          if (packageVersion) {
            addRelationshipWithPackageJson({
              reference,
              context,
              packageJsonUrl: `${packageDirectoryUrl}package.json`,
              field: "version",
              hasVersioningEffect: true
            });
          }
          reference.version = packageVersion;
        }
      }
    }
    return url;
  };
};
const addRelationshipWithPackageJson = ({
  context,
  packageJsonUrl,
  field,
  hasVersioningEffect = false
}) => {
  const referenceFound = context.referenceUtils.find(ref => ref.type === "package_json" && ref.subtype === field);
  if (referenceFound) {
    return;
  }
  const [, packageJsonUrlInfo] = context.referenceUtils.inject({
    type: "package_json",
    subtype: field,
    specifier: packageJsonUrl,
    isImplicit: true,
    hasVersioningEffect
  });
  if (packageJsonUrlInfo.type === undefined) {
    const packageJsonContentAsBuffer = readFileSync$1(new URL(packageJsonUrl));
    packageJsonUrlInfo.type = "json";
    packageJsonUrlInfo.content = String(packageJsonContentAsBuffer);
    packageJsonUrlInfo.originalContentEtag = packageJsonUrlInfo.contentEtag = bufferToEtag$1(packageJsonContentAsBuffer);
  }
};

const jsenvPluginNodeEsmResolution = (resolutionConfig = {}) => {
  let nodeEsmResolverDefault;
  const resolvers = {};
  Object.keys(resolutionConfig).forEach(urlType => {
    const config = resolutionConfig[urlType];
    if (config === true) {
      resolvers[urlType] = (...args) => nodeEsmResolverDefault(...args);
    } else if (config === false) {
      resolvers[urlType] = () => null;
    } else if (typeof config === "object") {
      const {
        runtimeCompat,
        packageConditions,
        preservesSymlink,
        ...rest
      } = config;
      const unexpectedKeys = Object.keys(rest);
      if (unexpectedKeys.length) {
        throw new TypeError(`${unexpectedKeys.join(",")}: there is no such configuration on "${urlType}"`);
      }
      resolvers[urlType] = createNodeEsmResolver({
        runtimeCompat,
        packageConditions,
        preservesSymlink
      });
    } else {
      throw new TypeError(`config must be true, false or an object, got ${config} on "${urlType}"`);
    }
  });
  return {
    name: "jsenv:node_esm_resolution",
    init: ({
      runtimeCompat
    }) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        runtimeCompat,
        preservesSymlink: true
      });
      if (!resolvers.js_module) {
        resolvers.js_module = nodeEsmResolverDefault;
      }
      if (!resolvers.js_classic) {
        resolvers.js_classic = (reference, context) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference, context);
          }
          return null;
        };
      }
    },
    resolveUrl: (reference, context) => {
      const urlType = urlTypeFromReference(reference, context);
      const resolver = resolvers[urlType];
      return resolver ? resolver(reference, context) : null;
    },
    // when specifier is prefixed by "file:///@ignore/"
    // we return an empty js module
    fetchUrlContent: urlInfo => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
          contentType: "text/javascript",
          type: "js_module"
        };
      }
      return null;
    }
  };
};

const jsenvPluginWebResolution = (resolutionConfig = {}) => {
  const resolvers = {};
  const resolveUsingWebResolution = (reference, context) => {
    if (reference.specifier === "/") {
      const {
        mainFilePath,
        rootDirectoryUrl
      } = context;
      return String(new URL(mainFilePath, rootDirectoryUrl));
    }
    if (reference.specifier[0] === "/") {
      return new URL(reference.specifier.slice(1), context.rootDirectoryUrl).href;
    }
    return new URL(reference.specifier,
    // baseUrl happens second argument to new URL() is different from
    // import.meta.url or document.currentScript.src
    reference.baseUrl || reference.parentUrl).href;
  };
  Object.keys(resolutionConfig).forEach(urlType => {
    const config = resolutionConfig[urlType];
    if (config === true) {
      resolvers[urlType] = resolveUsingWebResolution;
    } else if (config === false) {
      resolvers[urlType] = () => null;
    } else {
      throw new TypeError(`config must be true or false, got ${config} on "${urlType}"`);
    }
  });
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    init: () => {
      if (!resolvers["*"]) {
        resolvers["*"] = resolveUsingWebResolution;
      }
    },
    resolveUrl: (reference, context) => {
      const urlType = urlTypeFromReference(reference, context);
      const resolver = resolvers[urlType] || resolvers["*"];
      return resolver(reference, context);
    }
  };
};

const jsenvPluginUrlVersion = () => {
  return {
    name: "jsenv:url_version",
    appliesDuring: "dev",
    redirectUrl: reference => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hmr to bypass browser cache
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const version = reference.searchParams.get("v");
      if (version) {
        const urlObject = new URL(reference.url);
        urlObject.searchParams.delete("v");
        reference.version = version;
        return urlObject.href;
      }
      return null;
    },
    transformUrlSearchParams: reference => {
      if (!reference.version) {
        return null;
      }
      if (reference.searchParams.has("v")) {
        return null;
      }
      return {
        v: reference.version
      };
    }
  };
};

const jsenvPluginFileUrls = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
  directoryReferenceAllowed = false
}) => {
  return [{
    name: "jsenv:file_url_resolution",
    appliesDuring: "*",
    redirectUrl: reference => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }
      const urlObject = new URL(reference.url);
      let stat;
      try {
        stat = statSync(urlObject);
      } catch (e) {
        if (e.code === "ENOENT") {
          stat = null;
        } else {
          throw e;
        }
      }
      const {
        search,
        hash
      } = urlObject;
      let {
        pathname
      } = urlObject;
      const pathnameUsesTrailingSlash = pathname.endsWith("/");
      urlObject.search = "";
      urlObject.hash = "";
      // force trailing slash on directories
      if (stat && stat.isDirectory() && !pathnameUsesTrailingSlash) {
        urlObject.pathname = `${pathname}/`;
      }
      // otherwise remove trailing slash if any
      if (stat && !stat.isDirectory() && pathnameUsesTrailingSlash) {
        // a warning here? (because it's strange to reference a file with a trailing slash)
        urlObject.pathname = pathname.slice(0, -1);
      }
      let url = urlObject.href;
      const shouldPreserve = stat && stat.isDirectory() && (
      // ignore new URL second arg
      reference.subtype === "new_url_second_arg" ||
      // ignore root file url
      reference.url === "file:///" || reference.subtype === "new_url_first_arg" && reference.specifier === "./");
      if (shouldPreserve) {
        reference.shouldHandle = false;
      } else {
        const shouldApplyDilesystemMagicResolution = reference.type === "js_import";
        if (shouldApplyDilesystemMagicResolution) {
          const filesystemResolution = applyFileSystemMagicResolution(url, {
            fileStat: stat,
            magicDirectoryIndex,
            magicExtensions: getExtensionsToTry(magicExtensions, reference.parentUrl)
          });
          if (filesystemResolution.stat) {
            stat = filesystemResolution.stat;
            url = filesystemResolution.url;
          }
        }
        if (stat && stat.isDirectory()) {
          const directoryAllowed = reference.type === "filesystem" || typeof directoryReferenceAllowed === "function" && directoryReferenceAllowed(reference) || directoryReferenceAllowed;
          if (!directoryAllowed) {
            const error = new Error("Reference leads to a directory");
            error.code = "DIRECTORY_REFERENCE_NOT_ALLOWED";
            throw error;
          }
        }
      }
      reference.leadsToADirectory = stat && stat.isDirectory();
      if (stat) {
        const urlRaw = preserveSymlinks ? url : resolveSymlink(url);
        const resolvedUrl = `${urlRaw}${search}${hash}`;
        return resolvedUrl;
      }
      return null;
    }
  }, {
    name: "jsenv:filesystem_resolution",
    appliesDuring: "*",
    resolveUrl: {
      filesystem: (reference, context) => {
        const {
          parentUrl
        } = reference;
        const parentUrlInfo = context.urlGraph.getUrlInfo(parentUrl);
        const baseUrl = parentUrlInfo && parentUrlInfo.type === "directory" ? ensurePathnameTrailingSlash(parentUrl) : parentUrl;
        return new URL(reference.specifier, baseUrl).href;
      }
    }
  }, {
    name: "jsenv:@fs_resolution",
    // during dev and test it's a browser running the code
    // so absolute file urls needs to be relativized
    // during build it's fine to use file:// urls
    appliesDuring: "dev",
    resolveUrl: reference => {
      if (reference.specifier.startsWith("/@fs/")) {
        const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length);
        return `file:///${fsRootRelativeUrl}`;
      }
      return null;
    },
    formatUrl: (reference, context) => {
      if (!reference.generatedUrl.startsWith("file:")) {
        return null;
      }
      if (urlIsInsideOf(reference.generatedUrl, context.rootDirectoryUrl)) {
        return `/${urlToRelativeUrl(reference.generatedUrl, context.rootDirectoryUrl)}`;
      }
      return `/@fs/${reference.generatedUrl.slice("file:///".length)}`;
    }
  }, {
    name: "jsenv:file_url_fetching",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo, context) => {
      if (!urlInfo.url.startsWith("file:")) {
        return null;
      }
      const urlObject = new URL(urlInfo.url);
      if (context.reference.leadsToADirectory) {
        const directoryEntries = readdirSync(urlObject);
        let filename;
        if (context.reference.type === "filesystem") {
          const parentUrlInfo = context.urlGraph.getUrlInfo(context.reference.parentUrl);
          filename = `${parentUrlInfo.filename}${context.reference.specifier}/`;
        } else {
          filename = `${urlToFilename$1(urlInfo.url)}/`;
        }
        return {
          type: "directory",
          contentType: "application/json",
          content: JSON.stringify(directoryEntries, null, "  "),
          filename
        };
      }
      const fileBuffer = readFileSync$1(urlObject);
      const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url);
      return {
        content: CONTENT_TYPE.isTextual(contentType) ? String(fileBuffer) : fileBuffer,
        contentType
      };
    }
  }];
};
const resolveSymlink = fileUrl => {
  return pathToFileURL(realpathSync(new URL(fileUrl))).href;
};

const jsenvPluginHttpUrls = () => {
  return {
    name: "jsenv:http_urls",
    appliesDuring: "*",
    redirectUrl: reference => {
      if (reference.url.startsWith("http:") || reference.url.startsWith("https:")) {
        reference.shouldHandle = false;
      }
      // TODO: according to some pattern matching jsenv could be allowed
      // to fetch and transform http urls
    }
  };
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
  webServer,
  content,
  url,
  type,
  inlineSrc
}) => {
  const babelPluginJsSupervisor = type === "js_module" ? babelPluginJsModuleSupervisor : babelPluginJsClassicSupervisor;
  const result = await applyBabelPlugins({
    urlInfo: {
      content,
      originalUrl: url,
      type
    },
    babelPlugins: [[babelPluginJsSupervisor, {
      inlineSrc
    }]]
  });
  let code = result.code;
  let map = result.map;
  const sourcemapDataUrl = generateSourcemapDataUrl(map);
  code = SOURCEMAP.writeComment({
    contentType: "text/javascript",
    content: code,
    specifier: sourcemapDataUrl
  });
  code = `${code}
//# sourceURL=${urlToRelativeUrl(url, webServer.rootDirectoryUrl)}`;
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
const supervisorFileUrl$1 = new URL("./js/supervisor.js", import.meta.url).href;
const injectSupervisorIntoHTML = async ({
  content,
  url
}, {
  supervisorScriptSrc = supervisorFileUrl$1,
  supervisorOptions,
  webServer,
  onInlineScript = () => {},
  generateInlineScriptSrc = ({
    inlineScriptUrl
  }) => urlToRelativeUrl(inlineScriptUrl, webServer.rootDirectoryUrl),
  inlineAsRemote
}) => {
  const htmlAst = parseHtmlString(content);
  const mutations = [];
  const actions = [];
  const scriptInfos = [];
  // 1. Find inline and remote scripts
  {
    const handleInlineScript = (scriptNode, {
      type,
      extension,
      textContent
    }) => {
      const {
        line,
        column,
        lineEnd,
        columnEnd,
        isOriginal
      } = getHtmlNodePosition(scriptNode, {
        preferOriginal: true
      });
      const inlineScriptUrl = generateInlineContentUrl({
        url,
        extension: extension || ".js",
        line,
        column,
        lineEnd,
        columnEnd
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
              inlineSrc: inlineScriptSrc
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
          type,
          extension
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
            extension,
            textContent: scriptNodeText
          });
          return;
        }
        const src = getHtmlNodeAttribute(scriptNode, "src");
        if (src) {
          const urlObject = new URL(src, "http://example.com");
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
    const setupParamsSource = stringifyParams({
      ...supervisorOptions,
      serverIsJsenvDevServer: webServer.isJsenvDevServer,
      rootDirectoryUrl: webServer.rootDirectoryUrl,
      scriptInfos
    }, "  ");
    injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
      tagName: "script",
      textContent: `window.__supervisor__.setup({${setupParamsSource}})`
    }), "jsenv:supervisor");
    injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
      tagName: "script",
      src: supervisorScriptSrc
    }), "jsenv:supervisor");
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
const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix);
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2);
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1);
};
const generateCodeToSuperviseScriptWithSrc = ({
  type,
  src
}) => {
  const srcEncoded = JSON.stringify(src);
  if (type === "js_module") {
    return `window.__supervisor__.superviseScriptTypeModule(${srcEncoded}, (url) => import(url));`;
  }
  return `window.__supervisor__.superviseScript(${srcEncoded});`;
};

/*
 * This plugin provides a way for jsenv to know when js execution is done
 */
const supervisorFileUrl = new URL("./js/supervisor.js", import.meta.url).href;
const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl
}) => {
  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async (request, context) => {
      if (request.pathname.startsWith("/__get_code_frame__/")) {
        const {
          pathname,
          searchParams
        } = new URL(request.url);
        let urlWithLineAndColumn = pathname.slice("/__get_code_frame__/".length);
        urlWithLineAndColumn = decodeURIComponent(urlWithLineAndColumn);
        const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url"
          };
        }
        const file = urlWithLineAndColumn.slice(0, match.index);
        let line = parseInt(match[1]);
        let column = parseInt(match[2]);
        const urlInfo = context.urlGraph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store"
            }
          };
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
        const codeFrame = stringifyUrlSite({
          url: file,
          line,
          column,
          content: urlInfo.originalContent
        });
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(codeFrame)
          },
          body: codeFrame
        };
      }
      if (request.pathname.startsWith("/__get_error_cause__/")) {
        let file = request.pathname.slice("/__get_error_cause__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const getErrorCauseInfo = () => {
          const urlInfo = context.urlGraph.getUrlInfo(file);
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
          const {
            dependencies
          } = urlInfo;
          for (const dependencyUrl of dependencies) {
            const dependencyUrlInfo = context.urlGraph.getUrlInfo(dependencyUrl);
            if (dependencyUrlInfo.error) {
              return dependencyUrlInfo.error;
            }
          }
          return null;
        };
        const causeInfo = getErrorCauseInfo();
        const body = JSON.stringify(causeInfo ? {
          code: causeInfo.code,
          message: causeInfo.message,
          reason: causeInfo.reason,
          stack: errorBaseUrl ? `stack mocked for snapshot` : causeInfo.stack,
          codeFrame: causeInfo.traceMessage
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
      if (request.pathname.startsWith("/__open_in_editor__/")) {
        let file = request.pathname.slice("/__open_in_editor__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const launch = requireFromJsenv("launch-editor");
        launch(fileURLToPath(file), () => {
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
      html: ({
        url,
        content
      }, context) => {
        const [supervisorFileReference] = context.referenceUtils.inject({
          type: "script",
          expectedType: "js_classic",
          specifier: supervisorFileUrl
        });
        return injectSupervisorIntoHTML({
          content,
          url
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
            rootDirectoryUrl: context.rootDirectoryUrl,
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
            const [inlineScriptReference] = context.referenceUtils.foundInline({
              type: "script",
              subtype: "inline",
              expectedType: type,
              isOriginalPosition: isOriginal,
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineScriptUrl,
              contentType: "text/javascript",
              content: textContent
            });
            return inlineScriptReference.generatedSpecifier;
          }
        });
      }
    }
  };
};

/*
 * Some code uses globals specific to Node.js in code meant to run in browsers...
 * This plugin will replace some node globals to things compatible with web:
 * - process.env.NODE_ENV
 * - __filename
 * - __dirname
 * - global
 */
const jsenvPluginCommonJsGlobals = () => {
  const transformCommonJsGlobals = async (urlInfo, context) => {
    if (!urlInfo.content.includes("process.env.NODE_ENV") && !urlInfo.content.includes("__filename") && !urlInfo.content.includes("__dirname")) {
      return null;
    }
    const isJsModule = urlInfo.type === "js_module";
    const replaceMap = {
      "process.env.NODE_ENV": `("${context.dev ? "development" : "production"}")`,
      "global": "globalThis",
      "__filename": isJsModule ? `import.meta.url.slice('file:///'.length)` : `document.currentScript.src`,
      "__dirname": isJsModule ? `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')` : `new URL('./', document.currentScript.src).href`
    };
    const {
      metadata
    } = await applyBabelPlugins({
      babelPlugins: [[babelPluginMetadataExpressionPaths, {
        replaceMap,
        allowConflictingReplacements: true
      }]],
      urlInfo
    });
    const {
      expressionPaths
    } = metadata;
    const keys = Object.keys(expressionPaths);
    if (keys.length === 0) {
      return null;
    }
    const magicSource = createMagicSource(urlInfo.content);
    keys.forEach(key => {
      expressionPaths[key].forEach(path => {
        magicSource.replace({
          start: path.node.start,
          end: path.node.end,
          replacement: replaceMap[key]
        });
      });
    });
    return magicSource.toContentAndSourcemap();
  };
  return {
    name: "jsenv:commonjs_globals",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformCommonJsGlobals,
      js_module: transformCommonJsGlobals
    }
  };
};

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c
const babelPluginMetadataExpressionPaths = (babel, {
  replaceMap = {},
  allowConflictingReplacements = false
}) => {
  const {
    traverse,
    parse,
    types
  } = babel;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();
  return {
    name: "metadata-replace",
    pre: state => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = value => {
        const expressionNode = parse(value, state.opts).program.body[0].expression;
        traverse.removeProperties(expressionNode);
        return expressionNode;
      };
      Object.keys(replaceMap).forEach(key => {
        const keyExpressionNode = parseExpression(key);
        const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
        const value = replaceMap[key];
        const valueExpressionNode = parseExpression(value);
        const equivalentKeyExpressionIndex = candidateArray.findIndex(candidate => types.isNodesEquivalent(candidate.keyExpressionNode, keyExpressionNode));
        if (!allowConflictingReplacements && equivalentKeyExpressionIndex > -1) {
          throw new Error(`Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`);
        }
        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode
        };
        if (equivalentKeyExpressionIndex > -1) {
          candidateArray[equivalentKeyExpressionIndex] = newCandidate;
        } else {
          candidateArray.push(newCandidate);
        }
        replacementMap.set(keyExpressionNode.type, candidateArray);
      });
      replacementMap.forEach(candidateArray => {
        candidateArray.forEach(candidate => {
          valueExpressionSet.add(candidate.valueExpressionNode);
        });
      });
    },
    visitor: {
      Program: (programPath, state) => {
        const expressionPaths = {};
        programPath.traverse({
          Expression(path) {
            if (valueExpressionSet.has(path.node)) {
              path.skip();
              return;
            }
            const candidateArray = replacementMap.get(path.node.type);
            if (!candidateArray) {
              return;
            }
            const candidateFound = candidateArray.find(candidate => {
              return types.isNodesEquivalent(candidate.keyExpressionNode, path.node);
            });
            if (candidateFound) {
              try {
                types.validate(path.parent, path.key, candidateFound.valueExpressionNode);
              } catch (err) {
                if (err instanceof TypeError) {
                  path.skip();
                  return;
                }
                throw err;
              }
              const paths = expressionPaths[candidateFound.key];
              if (paths) {
                expressionPaths[candidateFound.key] = [...paths, path];
              } else {
                expressionPaths[candidateFound.key] = [path];
              }
              return;
            }
          }
        });
        state.file.metadata.expressionPaths = expressionPaths;
      }
    }
  };
};

/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.build but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 */
const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        if (!urlInfo.content.includes("import.meta.dev") && !urlInfo.content.includes("import.meta.test") && !urlInfo.content.includes("import.meta.build")) {
          return null;
        }
        const {
          metadata
        } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          urlInfo
        });
        const {
          dev = [],
          build = []
        } = metadata.importMetaScenarios;
        const replacements = [];
        const replace = (path, value) => {
          replacements.push({
            path,
            value
          });
        };
        if (context.build) {
          // during build ensure replacement for tree-shaking
          dev.forEach(path => {
            replace(path, "undefined");
          });
          build.forEach(path => {
            replace(path, "true");
          });
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          dev.forEach(path => {
            replace(path, "true");
          });
        }
        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({
          path,
          value
        }) => {
          magicSource.replace({
            start: path.node.start,
            end: path.node.end,
            replacement: value
          });
        });
        return magicSource.toContentAndSourcemap();
      }
    }
  };
};
const babelPluginMetadataImportMetaScenarios = () => {
  return {
    name: "metadata-import-meta-scenarios",
    visitor: {
      Program(programPath, state) {
        const importMetas = {};
        programPath.traverse({
          MemberExpression(path) {
            const {
              node
            } = path;
            const {
              object
            } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const {
              property: objectProperty
            } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const {
              property
            } = node;
            const {
              name
            } = property;
            const importMetaPaths = importMetas[name];
            if (importMetaPaths) {
              importMetaPaths.push(path);
            } else {
              importMetas[name] = [path];
            }
          }
        });
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          build: importMetas.build
        };
      }
    }
  };
};

const replacePlaceholders = (urlInfo, replacements) => {
  const content = urlInfo.content;
  const magicSource = createMagicSource(content);
  Object.keys(replacements).forEach(key => {
    let index = content.indexOf(key);
    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement: urlInfo.type === "js_classic" || urlInfo.type === "js_module" || urlInfo.type === "html" ? JSON.stringify(replacements[key], null, "  ") : replacements[key]
      });
      index = content.indexOf(key, end);
    }
  });
  return magicSource.toContentAndSourcemap();
};

/*
 * Source code can contain the following
 * - __dev__
 * - __build__
 * A global will be injected with true/false when needed
 */
const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo, context) => {
    return replacePlaceholders(urlInfo, {
      __DEV__: context.dev,
      __BUILD__: context.build
    });
  };
  return {
    name: "jsenv:global_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformIfNeeded,
      js_module: transformIfNeeded,
      html: transformIfNeeded
    }
  };
};

const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: async (urlInfo, context) => {
        const {
          code,
          map
        } = await transpileCss(urlInfo, context);
        return {
          content: String(code),
          sourcemap: map
        };
      }
    }
  };
};
const transpileCss = async (urlInfo, context) => {
  // https://lightningcss.dev/docs.html
  const {
    transform
  } = await import("lightningcss");
  const targets = runtimeCompatToTargets(context.runtimeCompat);
  const {
    code,
    map
  } = transform({
    filename: fileURLToPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true
    }
  });
  return {
    code,
    map
  };
};
const runtimeCompatToTargets = runtimeCompat => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach(runtimeName => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits(version);
    }
  });
  return targets;
};
const versionToBits = version => {
  const [major, minor = 0, patch = 0] = version.split("-")[0].split(".").map(v => parseInt(v, 10));
  return major << 16 | minor << 8 | patch;
};

/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import assertions
 * But for now (as it is simpler) we let the browser throw the error
 */
const jsenvPluginImportAssertions = ({
  json = "auto",
  css = "auto",
  text = "auto"
}) => {
  const transpilations = {
    json,
    css,
    text
  };
  const shouldTranspileImportAssertion = (context, type) => {
    const transpilation = transpilations[type];
    if (transpilation === true) {
      return true;
    }
    if (transpilation === "auto") {
      return !context.isSupportedOnCurrentClients(`import_type_${type}`);
    }
    return false;
  };
  const markAsJsModuleProxy = reference => {
    reference.expectedType = "js_module";
    reference.filename = `${urlToFilename$1(reference.url)}.js`;
  };
  const turnIntoJsModuleProxy = (reference, type) => {
    reference.mutation = magicSource => {
      const {
        assertNode
      } = reference;
      if (reference.subtype === "import_dynamic") {
        const assertPropertyNode = assertNode.properties.find(prop => prop.key.name === "assert");
        const assertPropertyValue = assertPropertyNode.value;
        const typePropertyNode = assertPropertyValue.properties.find(prop => prop.key.name === "type");
        magicSource.remove({
          start: typePropertyNode.start,
          end: typePropertyNode.end
        });
      } else {
        magicSource.remove({
          start: assertNode.start,
          end: assertNode.end
        });
      }
    };
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: ""
    });
    markAsJsModuleProxy(reference);
    return newUrl;
  };
  const importAssertions = {
    name: "jsenv:import_assertions",
    appliesDuring: "*",
    init: context => {
      // transpilation is forced during build so that
      //   - avoid rollup to see import assertions
      //     We would have to tell rollup to ignore import with assertion
      //   - means rollup can bundle more js file together
      //   - means url versioning can work for css inlined in js
      if (context.build) {
        transpilations.json = true;
        transpilations.css = true;
        transpilations.text = true;
      }
    },
    redirectUrl: (reference, context) => {
      if (!reference.assert) {
        return null;
      }
      const {
        searchParams
      } = reference;
      if (searchParams.has("as_json_module") || searchParams.has("as_css_module") || searchParams.has("as_text_module")) {
        markAsJsModuleProxy(reference);
        return null;
      }
      const type = reference.assert.type;
      if (shouldTranspileImportAssertion(context, type)) {
        return turnIntoJsModuleProxy(reference, type);
      }
      return null;
    }
  };
  return [importAssertions, ...jsenvPluginAsModules()];
};
const jsenvPluginAsModules = () => {
  const inlineContentClientFileUrl = new URL("./js/inline_content.js", import.meta.url).href;
  const asJsonModule = {
    name: `jsenv:as_json_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const [jsonReference, jsonUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_json_module",
        expectedType: "json"
      });
      if (!jsonReference) {
        return null;
      }
      await context.fetchUrlContent(jsonUrlInfo, {
        reference: jsonReference
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsonReference.subtype,
          specifier: jsonReference.url,
          expectedType: "js_module"
        });
      } else if (context.build && jsonUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(jsonUrlInfo.url);
      }
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      return {
        // here we could `export default ${jsonText}`:
        // but js engine are optimized to recognize JSON.parse
        // and use a faster parsing strategy
        content: `export default JSON.parse(${jsonText})`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data
      };
    }
  };
  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const [cssReference, cssUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_css_module",
        expectedType: "css"
      });
      if (!cssReference) {
        return null;
      }
      await context.fetchUrlContent(cssUrlInfo, {
        reference: cssReference
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: cssReference.subtype,
          specifier: cssReference.url,
          expectedType: "js_module"
        });
      } else if (context.build && cssUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(cssUrlInfo.url);
      }
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true
      });
      return {
        content: `import { InlineContent } from ${JSON.stringify(inlineContentClientFileUrl)}
  
  const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
  const stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(inlineContent.text)
  export default stylesheet`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data
      };
    }
  };
  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const [textReference, textUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_text_module",
        expectedType: "text"
      });
      if (!textReference) {
        return null;
      }
      await context.fetchUrlContent(textUrlInfo, {
        reference: textReference
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: textReference.subtype,
          specifier: textReference.url,
          expectedType: "js_module"
        });
      } else if (context.build && textUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(textUrlInfo.url);
      }
      const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true
      });
      return {
        content: `import { InlineContent } from ${JSON.stringify(inlineContentClientFileUrl)}
  
const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data
      };
    }
  };
  return [asJsonModule, asCssModule, asTextModule];
};

const convertJsClassicToJsModule = async ({
  urlInfo,
  jsClassicUrlInfo
}) => {
  const {
    code,
    map
  } = await applyBabelPlugins({
    babelPlugins: [[babelPluginReplaceTopLevelThis, {
      isWebWorker: isWebWorkerUrlInfo(urlInfo)
    }]],
    urlInfo: jsClassicUrlInfo
  });
  const sourcemap = await composeTwoSourcemaps(jsClassicUrlInfo.sourcemap, map);
  return {
    content: code,
    sourcemap
  };
};
const babelPluginReplaceTopLevelThis = () => {
  return {
    name: "replace-top-level-this",
    visitor: {
      Program: (programPath, state) => {
        const {
          isWebWorker
        } = state.opts;
        programPath.traverse({
          ThisExpression: path => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction) {
              path.replaceWithSourceString(isWebWorker ? "self" : "window");
            }
          }
        });
      }
    }
  };
};

/*
 * Js modules might not be able to import js meant to be loaded by <script>
 * Among other things this happens for a top level this:
 * - With <script> this is window
 * - With an import this is undefined
 * Example of this: https://github.com/video-dev/hls.js/issues/2911
 *
 * This plugin fix this issue by rewriting top level this into window
 * and can be used like this for instance import("hls?as_js_module")
 */
const jsenvPluginAsJsModule = () => {
  return {
    name: "jsenv:as_js_module",
    appliesDuring: "*",
    redirectUrl: reference => {
      if (reference.searchParams.has("as_js_module")) {
        reference.expectedType = "js_module";
        const filename = urlToFilename$1(reference.url);
        const [basename] = splitFileExtension$1(filename);
        reference.filename = `${basename}.mjs`;
      }
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsClassicReference, jsClassicUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_js_module",
        // override the expectedType to "js_classic"
        // because when there is ?as_js_module it means the underlying resource
        // is js_classic
        expectedType: "js_classic"
      });
      if (!jsClassicReference) {
        return null;
      }
      await context.fetchUrlContent(jsClassicUrlInfo, {
        reference: jsClassicReference
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsClassicReference.subtype,
          specifier: jsClassicReference.url,
          expectedType: "js_classic"
        });
      } else if (context.build && jsClassicUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(jsClassicUrlInfo.url);
      }
      const {
        content,
        sourcemap
      } = await convertJsClassicToJsModule({
        urlInfo,
        jsClassicUrlInfo
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsClassicUrlInfo.originalUrl,
        originalContent: jsClassicUrlInfo.originalContent,
        sourcemap,
        data: jsClassicUrlInfo.data
      };
    }
  };
};
const splitFileExtension$1 = filename => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * Generated helpers
 * - https://github.com/babel/babel/commits/main/packages/babel-helpers/src/helpers.ts
 * File helpers
 * - https://github.com/babel/babel/tree/main/packages/babel-helpers/src/helpers
 *
 */
const babelHelperClientDirectoryUrl = new URL("./babel_helpers/", import.meta.url).href;

// we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"
const getBabelHelperFileUrl = babelHelperName => {
  const babelHelperFileUrl = new URL(`./${babelHelperName}/${babelHelperName}.js`, babelHelperClientDirectoryUrl).href;
  return babelHelperFileUrl;
};
const babelHelperNameFromUrl = url => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null;
  }
  const afterBabelHelperDirectory = url.slice(babelHelperClientDirectoryUrl.length);
  const babelHelperName = afterBabelHelperDirectory.slice(0, afterBabelHelperDirectory.indexOf("/"));
  return babelHelperName;
};

/* eslint-disable camelcase */
// copied from
// https://github.com/babel/babel/blob/e498bee10f0123bb208baa228ce6417542a2c3c4/packages/babel-compat-data/data/plugins.json#L1
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module

const babelPluginCompatMap = {
  "proposal-numeric-separator": {
    chrome: "75",
    opera: "62",
    edge: "79",
    firefox: "70",
    safari: "13",
    node: "12.5",
    ios: "13",
    samsung: "11",
    electron: "6"
  },
  "proposal-class-properties": {
    chrome: "74",
    opera: "61",
    edge: "79",
    node: "12",
    electron: "6.1"
  },
  "proposal-private-methods": {
    chrome: "84",
    opera: "71"
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    node: "14",
    electron: "8.1"
  },
  "proposal-optional-chaining": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    node: "14",
    electron: "8.1"
  },
  "proposal-json-strings": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    electron: "3"
  },
  "proposal-optional-catch-binding": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-parameters": {
    chrome: "49",
    opera: "36",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37"
  },
  "proposal-async-generator-functions": {
    chrome: "63",
    opera: "50",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    electron: "3"
  },
  "proposal-object-rest-spread": {
    chrome: "60",
    opera: "47",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    electron: "2"
  },
  "transform-dotall-regex": {
    chrome: "62",
    opera: "49",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    electron: "3"
  },
  "proposal-unicode-property-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-async-to-generator": {
    chrome: "55",
    opera: "42",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    electron: "1.6"
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    opera: "39",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    electron: "1.3"
  },
  "transform-template-literals": {
    chrome: "41",
    opera: "28",
    edge: "13",
    electron: "0.22",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
    samsung: "3.4"
  },
  "transform-literals": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30"
  },
  "transform-function-name": {
    chrome: "51",
    opera: "38",
    edge: "79",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-arrow-functions": {
    chrome: "47",
    opera: "34",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-block-scoped-functions": {
    chrome: "41",
    opera: "28",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    electron: "0.22"
  },
  "transform-classes": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-object-super": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-shorthand-properties": {
    chrome: "43",
    opera: "30",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.28"
  },
  "transform-duplicate-keys": {
    chrome: "42",
    opera: "29",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    electron: "0.25"
  },
  "transform-computed-properties": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    electron: "0.30"
  },
  "transform-for-of": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-sticky-regex": {
    chrome: "49",
    opera: "36",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37"
  },
  "transform-unicode-escapes": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30"
  },
  "transform-unicode-regex": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    electron: "1.1"
  },
  "transform-spread": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-destructuring": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-block-scoping": {
    chrome: "49",
    opera: "36",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    electron: "0.37"
  },
  "transform-typeof-symbol": {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    electron: "0.20"
  },
  "transform-new-target": {
    chrome: "46",
    opera: "33",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-regenerator": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "1.1"
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  },
  "transform-reserved-words": {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  }
};

// copy of transform-async-to-generator
// so that async is not transpiled when supported
babelPluginCompatMap["transform-async-to-promises"] = babelPluginCompatMap["transform-async-to-generator"];
babelPluginCompatMap["regenerator-transform"] = babelPluginCompatMap["transform-regenerator"];

const getBaseBabelPluginStructure = ({
  url,
  isSupported
  // isJsModule,
  // getImportSpecifier,
}) => {
  const isBabelPluginNeeded = babelPluginName => {
    return !isSupported(babelPluginCompatMap[babelPluginName]);
  };
  const babelPluginStructure = {};
  if (isBabelPluginNeeded("proposal-numeric-separator")) {
    babelPluginStructure["proposal-numeric-separator"] = requireBabelPlugin("@babel/plugin-proposal-numeric-separator");
  }
  if (isBabelPluginNeeded("proposal-json-strings")) {
    babelPluginStructure["proposal-json-strings"] = requireBabelPlugin("@babel/plugin-proposal-json-strings");
  }
  if (isBabelPluginNeeded("proposal-object-rest-spread")) {
    babelPluginStructure["proposal-object-rest-spread"] = requireBabelPlugin("@babel/plugin-proposal-object-rest-spread");
  }
  if (isBabelPluginNeeded("proposal-optional-catch-binding")) {
    babelPluginStructure["proposal-optional-catch-binding"] = requireBabelPlugin("@babel/plugin-proposal-optional-catch-binding");
  }
  if (isBabelPluginNeeded("proposal-unicode-property-regex")) {
    babelPluginStructure["proposal-unicode-property-regex"] = requireBabelPlugin("@babel/plugin-proposal-unicode-property-regex");
  }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
      topLevelAwait: "ignore",
      // will be handled by "jsenv:top_level_await" plugin
      externalHelpers: false
      // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
      // externalHelpers: isJsModule,
      // externalHelpersPath: isJsModule ? getImportSpecifier(
      //     "babel-plugin-transform-async-to-promises/helpers.mjs",
      //   ) : null
    }];
  }

  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin("@babel/plugin-transform-arrow-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] = requireBabelPlugin("@babel/plugin-transform-block-scoped-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin("@babel/plugin-transform-block-scoping");
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin("@babel/plugin-transform-classes");
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin("@babel/plugin-transform-computed-properties");
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin("@babel/plugin-transform-destructuring");
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin("@babel/plugin-transform-dotall-regex");
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin("@babel/plugin-transform-duplicate-keys");
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] = requireBabelPlugin("@babel/plugin-transform-exponentiation-operator");
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin("@babel/plugin-transform-for-of");
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin("@babel/plugin-transform-function-name");
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin("@babel/plugin-transform-literals");
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin("@babel/plugin-transform-new-target");
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin("@babel/plugin-transform-object-super");
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin("@babel/plugin-transform-parameters");
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [requireBabelPlugin("@babel/plugin-transform-regenerator"), {
      asyncGenerators: true,
      generators: true,
      async: false
    }];
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [requireBabelPlugin("@babel/plugin-transform-shorthand-properties")];
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [requireBabelPlugin("@babel/plugin-transform-spread")];
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [requireBabelPlugin("@babel/plugin-transform-sticky-regex")];
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [requireBabelPlugin("@babel/plugin-transform-template-literals")];
  }
  if (isBabelPluginNeeded("transform-typeof-symbol") &&
  // prevent "typeof" to be injected into itself:
  // - not needed
  // - would create infinite attempt to transform typeof
  url !== getBabelHelperFileUrl("typeof")) {
    babelPluginStructure["transform-typeof-symbol"] = [requireBabelPlugin("@babel/plugin-transform-typeof-symbol")];
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [requireBabelPlugin("@babel/plugin-transform-unicode-regex")];
  }
  return babelPluginStructure;
};

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

const babelPluginBabelHelpersAsJsenvImports = (babel, {
  getImportSpecifier
}) => {
  return {
    name: "babel-helper-as-jsenv-import",
    pre: file => {
      const cachedHelpers = {};
      file.set("helperGenerator", name => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }
        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }
        const filePath = file.opts.filename;
        const fileUrl = pathToFileURL(filePath).href;
        if (babelHelperNameFromUrl(fileUrl) === name) {
          return undefined;
        }
        const babelHelperImportSpecifier = getBabelHelperFileUrl(name);
        const helper = injectJsImport({
          programPath: file.path,
          from: getImportSpecifier(babelHelperImportSpecifier),
          nameHint: `_${name}`,
          // disable interop, useless as we work only with js modules
          importedType: "es6"
          // importedInterop: "uncompiled",
        });

        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};

const newStylesheetClientFileUrl = new URL("./js/new_stylesheet.js", import.meta.url).href;
const babelPluginNewStylesheetAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  return {
    name: "new-stylesheet-as-jsenv-import",
    visitor: {
      Program: (programPath, babelState) => {
        if (babelState.filename) {
          const fileUrl = pathToFileURL(babelState.filename).href;
          if (fileUrl === newStylesheetClientFileUrl) {
            return;
          }
        }
        let usesNewStylesheet = false;
        programPath.traverse({
          NewExpression: path => {
            usesNewStylesheet = isNewCssStyleSheetCall(path.node);
            if (usesNewStylesheet) {
              path.stop();
            }
          },
          MemberExpression: path => {
            usesNewStylesheet = isDocumentAdoptedStyleSheets(path.node);
            if (usesNewStylesheet) {
              path.stop();
            }
          },
          CallExpression: path => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return;
            }
            if (path.node.arguments[0].type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return;
            }
            const sourcePath = path.get("arguments")[0];
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);
            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ImportDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);
            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportAllDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);
            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportNamedDeclaration: path => {
            if (!path.node.source) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return;
            }
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);
            if (usesNewStylesheet) {
              path.stop();
            }
          }
        });
        if (usesNewStylesheet) {
          injectJsImport({
            programPath,
            from: getImportSpecifier(newStylesheetClientFileUrl),
            sideEffect: true
          });
        }
      }
    }
  };
};
const isNewCssStyleSheetCall = node => {
  return node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "CSSStyleSheet";
};
const isDocumentAdoptedStyleSheets = node => {
  return node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "document" && node.property.type === "Identifier" && node.property.name === "adoptedStyleSheets";
};
const hasCssModuleQueryParam = path => {
  const {
    node
  } = path;
  return node.type === "StringLiteral" && new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`);
};
const hasImportTypeCssAssertion = path => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(path.node.assertions);
  return Boolean(importAssertionsDescriptor.type === "css");
};
const getImportAssertionsDescriptor = importAssertions => {
  const importAssertionsDescriptor = {};
  if (importAssertions) {
    importAssertions.forEach(importAssertion => {
      importAssertionsDescriptor[importAssertion.key.name] = importAssertion.value.value;
    });
  }
  return importAssertionsDescriptor;
};

const globalThisClientFileUrl = new URL("./js/global_this.js", import.meta.url).href;
const babelPluginGlobalThisAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  return {
    name: "global-this-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const fileUrl = pathToFileURL(filename).href;
        if (fileUrl === globalThisClientFileUrl) {
          return;
        }
        const {
          node
        } = path;
        // we should do this once, tree shaking will remote it but still
        if (node.name === "globalThis") {
          injectJsImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(globalThisClientFileUrl),
            sideEffect: true
          });
        }
      }
    }
  };
};

const regeneratorRuntimeClientFileUrl = new URL("./js/regenerator_runtime.js", import.meta.url).href;
const babelPluginRegeneratorRuntimeAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  return {
    name: "regenerator-runtime-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const fileUrl = pathToFileURL(filename).href;
        if (fileUrl === regeneratorRuntimeClientFileUrl) {
          return;
        }
        const {
          node
        } = path;
        if (node.name === "regeneratorRuntime") {
          injectJsImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(regeneratorRuntimeClientFileUrl),
            sideEffect: true
          });
        }
      }
    }
  };
};

const jsenvPluginBabel = ({
  getCustomBabelPlugins,
  babelHelpersAsImport = true
} = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    const isJsModule = urlInfo.type === "js_module";
    const isSupported = feature => RUNTIME_COMPAT.isSupported(context.clientRuntimeCompat, feature);
    const getImportSpecifier = clientFileUrl => {
      const [reference] = context.referenceUtils.inject({
        type: "js_import",
        expectedType: "js_module",
        specifier: clientFileUrl
      });
      return JSON.parse(reference.generatedSpecifier);
    };
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.url,
      isSupported,
      isJsModule,
      getImportSpecifier
    });
    if (getCustomBabelPlugins) {
      Object.assign(babelPluginStructure, getCustomBabelPlugins(context));
    }
    if (isJsModule && babelHelpersAsImport) {
      if (!isSupported("global_this")) {
        babelPluginStructure["global-this-as-jsenv-import"] = [babelPluginGlobalThisAsJsenvImport, {
          getImportSpecifier
        }];
      }
      if (!isSupported("async_generator_function")) {
        babelPluginStructure["regenerator-runtime-as-jsenv-import"] = [babelPluginRegeneratorRuntimeAsJsenvImport, {
          getImportSpecifier
        }];
      }
      if (!isSupported("new_stylesheet")) {
        babelPluginStructure["new-stylesheet-as-jsenv-import"] = [babelPluginNewStylesheetAsJsenvImport, {
          getImportSpecifier
        }];
      }
      if (Object.keys(babelPluginStructure).length > 0) {
        babelPluginStructure["babel-helper-as-jsenv-import"] = [babelPluginBabelHelpersAsJsenvImports, {
          getImportSpecifier
        }];
      }
    }
    // otherwise, concerning global_this, and new_stylesheet we must inject the code
    // (we cannot inject an import)

    const babelPlugins = Object.keys(babelPluginStructure).map(babelPluginName => babelPluginStructure[babelPluginName]);
    const {
      code,
      map
    } = await applyBabelPlugins({
      babelPlugins,
      urlInfo,
      options: {
        generatorOpts: {
          retainLines: context.dev
        }
      }
    });
    return {
      content: code,
      sourcemap: map
    };
  };
  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    finalizeUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel
    }
  };
};

const jsenvPluginTopLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    init: context => {
      if (context.isSupportedOnCurrentClients("top_level_await")) {
        return false;
      }
      // keep it untouched, systemjs will handle it
      if (context.systemJsTranspilation) {
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async urlInfo => {
        const usesTLA = await usesTopLevelAwait(urlInfo);
        if (!usesTLA) {
          return null;
        }
        const {
          code,
          map
        } = await applyBabelPlugins({
          urlInfo,
          babelPlugins: [[requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
            // Maybe we could pass target: "es6" when we support arrow function
            // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
            topLevelAwait: "simple"
            // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
            // externalHelpers: true,
            // externalHelpersPath: JSON.parse(
            //   context.referenceUtils.inject({
            //     type: "js_import",
            //     expectedType: "js_module",
            //     specifier:
            //       "babel-plugin-transform-async-to-promises/helpers.mjs",
            //   })[0],
            // ),
          }]]
        });

        return {
          content: code,
          sourcemap: map
        };
      }
    }
  };
};
const usesTopLevelAwait = async urlInfo => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }
  const {
    metadata
  } = await applyBabelPlugins({
    urlInfo,
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait]
  });
  return metadata.usesTopLevelAwait;
};
const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false;
        programPath.traverse({
          AwaitExpression: path => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction || closestFunction.type === "Program") {
              usesTopLevelAwait = true;
              path.stop();
            }
          }
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      }
    }
  };
};

const jsenvPluginImportMetaResolve = () => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: context => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      // keep it untouched, systemjs will handle it
      if (context.systemJsTranspilation) {
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        const magicSource = createMagicSource(urlInfo.content);
        context.referenceUtils._references.forEach(ref => {
          if (ref.subtype === "import_meta_resolve") {
            const originalSpecifierLength = Buffer.byteLength(ref.specifier);
            const specifierLength = Buffer.byteLength(ref.generatedSpecifier.slice(1, -1) // remove `"` around
            );

            const specifierLengthDiff = specifierLength - originalSpecifierLength;
            const end = ref.node.end + specifierLengthDiff;
            magicSource.replace({
              start: ref.node.start,
              end,
              replacement: `new URL(${ref.generatedSpecifier}, import.meta.url).href`
            });
            const currentLengthBeforeSpecifier = "import.meta.resolve(".length;
            const newLengthBeforeSpecifier = "new URL(".length;
            const lengthDiff = currentLengthBeforeSpecifier - newLengthBeforeSpecifier;
            ref.specifierColumn -= lengthDiff;
            ref.specifierStart -= lengthDiff;
            ref.specifierEnd = ref.specifierStart + Buffer.byteLength(ref.generatedSpecifier);
          }
        });
        return magicSource.toContentAndSourcemap();
      }
    }
  };
};

/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */
const jsenvPluginTranspilation = ({
  importAssertions = true,
  css = true,
  // build sets jsModuleFallbackOnJsClassic: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallbackOnJsClassic = true,
  topLevelAwait = true,
  importMetaResolve = true,
  babelHelpersAsImport = true,
  getCustomBabelPlugins
}) => {
  if (importAssertions === true) {
    importAssertions = {};
  }
  if (jsModuleFallbackOnJsClassic === true) {
    jsModuleFallbackOnJsClassic = {};
  }
  return [...(importMetaResolve ? [jsenvPluginImportMetaResolve()] : []), ...(importAssertions ? [jsenvPluginImportAssertions(importAssertions)] : []),
  // babel also so that rollup can bundle babel helpers for instance
  jsenvPluginBabel({
    topLevelAwait,
    getCustomBabelPlugins,
    babelHelpersAsImport
  }), ...(jsModuleFallbackOnJsClassic ? [jsenvPluginJsModuleFallback(jsModuleFallbackOnJsClassic)] : []), jsenvPluginAsJsModule(),
  // topLevelAwait must come after jsModuleFallback because it's related to the module format
  // so we want to wait to know the module format before transforming things related to top level await
  ...(topLevelAwait ? [jsenvPluginTopLevelAwait()] : []), ...(css ? [jsenvPluginCssTranspilation()] : [])];
};

const jsenvPluginNodeRuntime = ({
  runtimeCompat
}) => {
  const nodeFound = Object.keys(runtimeCompat).includes("node");
  if (!nodeFound) {
    return [];
  }

  // what do we need to do?
  return {
    name: "jsenv:node_runtime",
    appliesDuring: "*"
  };
};

// Some "smart" default applied to decide what should hot reload / fullreload:
// By default:
//   - hot reload on <img src="./image.png" />
//   - fullreload on <script src="./file.js" />
// Can be controlled by [hot-decline] and [hot-accept]:
//   - fullreload on <img src="./image.png" hot-decline />
//   - hot reload on <script src="./file.js" hot-accept />
const collectHotDataFromHtmlAst = htmlAst => {
  const hotReferences = [];
  const onSpecifier = ({
    specifier,
    node,
    attributeName,
    hotAccepted
  }) => {
    if (
    // explicitely enabled with [hot-accept] attribute
    hotAccepted === true || htmlNodeCanHotReload(node)) {
      hotReferences.push({
        type: `${node.nodeName}_${attributeName}`,
        specifier
      });
    }
  };
  const visitUrlSpecifierAttribute = ({
    node,
    attributeName,
    hotAccepted
  }) => {
    const value = getHtmlNodeAttribute(node, attributeName);
    if (value) {
      onSpecifier({
        specifier: value,
        node,
        attributeName,
        hotAccepted
      });
    }
  };
  const onNode = (node, {
    hotAccepted
  }) => {
    // explicitely disabled with [hot-decline] attribute
    if (hotAccepted === false) {
      return;
    }
    if (nodeNamesWithHref.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "href",
        hotAccepted
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-href",
        hotAccepted
      });
    }
    if (nodeNamesWithSrc.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "src",
        hotAccepted
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-src",
        hotAccepted
      });
    }
    if (nodeNamesWithSrcset.includes(node.nodeName)) {
      const srcset = getHtmlNodeAttribute(node, "srcset");
      if (srcset) {
        const srcCandidates = parseSrcSet(srcset);
        srcCandidates.forEach(srcCandidate => {
          onSpecifier({
            node,
            specifier: srcCandidate.specifier,
            attributeName: "srcset",
            hotAccepted
          });
        });
      }
    }
  };
  const iterate = (node, context) => {
    context = {
      ...context,
      ...getNodeContext(node)
    };
    onNode(node, context);
    const {
      childNodes
    } = node;
    if (childNodes) {
      let i = 0;
      while (i < childNodes.length) {
        const childNode = childNodes[i++];
        iterate(childNode, context);
      }
    }
  };
  iterate(htmlAst, {});
  return hotReferences;
};
const nodeNamesWithHref = ["link", "a", "image", "use"];
const nodeNamesWithSrc = ["script", "iframe", "img"];
const nodeNamesWithSrcset = ["img", "source"];
const getNodeContext = node => {
  const context = {};
  const hotAccept = getHtmlNodeAttribute(node, "hot-accept");
  if (hotAccept !== undefined) {
    context.hotAccepted = true;
  }
  const hotDecline = getHtmlNodeAttribute(node, "hot-decline");
  if (hotDecline !== undefined) {
    context.hotAccepted = false;
  }
  return context;
};
const htmlNodeCanHotReload = node => {
  if (node.nodeName === "link") {
    const {
      isStylesheet,
      isResourceHint,
      rel
    } = analyzeLinkNode(node);
    if (isStylesheet) {
      // stylesheets can be hot replaced by default
      return true;
    }
    if (isResourceHint) {
      return false;
    }
    return rel === "icon";
  }
  return [
  // "script", // script cannot hot reload
  "a",
  // Iframe will have their own event source client
  // and can hot reload independently
  // But if the iframe communicates with the parent iframe
  // then we canot know for sure if the communication is broken
  // ideally, if the iframe full-reload the page must full-reload too
  // if the iframe hot-reload we don't know but we could assume there is nothing to do
  // if there is [hot-accept] on the iframe
  "iframe", "img", "source", "image", "use"].includes(node.nodeName);
};

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        Object.assign(state.file.metadata, collectImportMetaProperties(programPath));
      }
    }
  };
};
const collectImportMetaProperties = programPath => {
  const importMetaHotPaths = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptDependencies = [];
  programPath.traverse({
    MemberExpression(path) {
      const {
        node
      } = path;
      const {
        object
      } = node;
      if (object.type !== "MetaProperty") {
        return;
      }
      const {
        property: objectProperty
      } = object;
      if (objectProperty.name !== "meta") {
        return;
      }
      const {
        property
      } = node;
      const {
        name
      } = property;
      if (name === "hot") {
        importMetaHotPaths.push(path);
      }
    },
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node;
        const args = callNode.arguments;
        if (args.length === 0) {
          hotAcceptSelf = true;
          return;
        }
        const firstArg = args[0];
        if (firstArg.type === "StringLiteral") {
          hotAcceptDependencies = [{
            specifierPath: path.get("arguments")[0]
          }];
          return;
        }
        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0];
          hotAcceptDependencies = firstArg.elements.map((arrayNode, index) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(`all array elements must be strings in "import.meta.hot.accept(array)"`);
            }
            return {
              specifierPath: firstArgPath.get(String(index))
            };
          });
          return;
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.accept(cb)`
        hotAcceptSelf = true;
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        hotDecline = true;
      }
    }
  });
  return {
    importMetaHotPaths,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies
  };
};
const isImportMetaHotMethodCall = (path, methodName) => {
  const {
    property,
    object
  } = path.node.callee;
  return property && property.name === methodName && object && object.property && object.property.name === "hot" && object.object.type === "MetaProperty";
};

const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = new URL("./js/import_meta_hot.js", import.meta.url).href;
  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        // during build we don't really care to parse html hot dependencies
        if (context.build) {
          return;
        }
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const hotReferences = collectHotDataFromHtmlAst(htmlAst);
        htmlUrlInfo.data.hotDecline = false;
        htmlUrlInfo.data.hotAcceptSelf = false;
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(({
          type,
          specifier
        }) => {
          const existingReference = context.referenceUtils.find(existingReference => {
            return existingReference.type === type && existingReference.specifier === specifier;
          });
          if (existingReference) {
            return existingReference.url;
          }
          const [reference] = context.referenceUtils.found({
            type,
            specifier
          });
          return reference.url;
        });
      },
      css: cssUrlInfo => {
        cssUrlInfo.data.hotDecline = false;
        cssUrlInfo.data.hotAcceptSelf = false;
        cssUrlInfo.data.hotAcceptDependencies = [];
      },
      js_module: async (urlInfo, context) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const {
          metadata
        } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          urlInfo
        });
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies
        } = metadata;
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies;
        if (importMetaHotPaths.length === 0) {
          return null;
        }
        if (context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotPaths);
        }
        return injectImportMetaHot(urlInfo, context, importMetaHotClientFileUrl);
      }
    }
  };
};
const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotPaths.forEach(path => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined"
    });
  });
  return magicSource.toContentAndSourcemap();
};

// For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel
const injectImportMetaHot = (urlInfo, context, importMetaHotClientFileUrl) => {
  const [importMetaHotClientFileReference] = context.referenceUtils.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl
  });
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(`import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier}
import.meta.hot = createImportMetaHot(import.meta.url)
`);
  return magicSource.toContentAndSourcemap();
};

const jsenvPluginHmr = () => {
  return {
    name: "jsenv:hmr",
    appliesDuring: "dev",
    redirectUrl: reference => {
      if (!reference.searchParams.has("hmr")) {
        reference.data.hmr = false;
        return null;
      }
      reference.data.hmr = true;
      const urlObject = new URL(reference.url);
      // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hmr");
      urlObject.searchParams.delete("v");
      return urlObject.href;
    },
    transformUrlSearchParams: (reference, context) => {
      if (reference.type === "package_json") {
        // maybe the if above shoulb be .isImplicit but it's just a detail anyway
        return null;
      }
      if (context.reference && !context.reference.data.hmr) {
        // parent do not use hmr search param
        return null;
      }
      if (!context.reference && !reference.data.hmr) {
        // entry point do not use hmr search param
        return null;
      }
      const urlInfo = context.urlGraph.getUrlInfo(reference.url);
      if (!urlInfo.modifiedTimestamp) {
        return null;
      }
      return {
        hmr: "",
        v: urlInfo.modifiedTimestamp
      };
    }
  };
};

const jsenvPluginAutoreloadClient = () => {
  const autoreloadClientFileUrl = new URL("./js/autoreload.js", import.meta.url).href;
  return {
    name: "jsenv:autoreload_client",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const [autoreloadClientReference] = context.referenceUtils.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl
        });
        injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
          tagName: "script",
          type: "module",
          src: autoreloadClientReference.generatedSpecifier
        }), "jsenv:autoreload_client");
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

const jsenvPluginAutoreloadServer = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: ({
        sendServerEvent,
        rootDirectoryUrl,
        urlGraph
      }) => {
        const formatUrlForClient = url => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            return urlToRelativeUrl(url, rootDirectoryUrl);
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`;
          }
          return url;
        };
        const notifyDeclined = ({
          cause,
          reason,
          declinedBy
        }) => {
          sendServerEvent({
            cause,
            type: "full",
            typeReason: reason,
            declinedBy
          });
        };
        const notifyAccepted = ({
          cause,
          reason,
          instructions
        }) => {
          sendServerEvent({
            cause,
            type: "hot",
            typeReason: reason,
            hotInstructions: instructions
          });
        };
        const propagateUpdate = firstUrlInfo => {
          if (!urlGraph.getUrlInfo(firstUrlInfo.url)) {
            return {
              declined: true,
              reason: `url not in the url graph`
            };
          }
          const iterate = (urlInfo, seen) => {
            if (urlInfo.data.hotAcceptSelf) {
              return {
                accepted: true,
                reason: urlInfo === firstUrlInfo ? `file accepts hot reload` : `a dependent file accepts hot reload`,
                instructions: [{
                  type: urlInfo.type,
                  boundary: formatUrlForClient(urlInfo.url),
                  acceptedBy: formatUrlForClient(urlInfo.url)
                }]
              };
            }
            const {
              dependents
            } = urlInfo;
            const instructions = [];
            for (const dependentUrl of dependents) {
              const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl);
              if (dependentUrlInfo.data.hotDecline) {
                return {
                  declined: true,
                  reason: `a dependent file declines hot reload`,
                  declinedBy: dependentUrl
                };
              }
              const {
                hotAcceptDependencies = []
              } = dependentUrlInfo.data;
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                instructions.push({
                  type: dependentUrlInfo.type,
                  boundary: formatUrlForClient(dependentUrl),
                  acceptedBy: formatUrlForClient(urlInfo.url)
                });
                continue;
              }
              if (seen.includes(dependentUrl)) {
                return {
                  declined: true,
                  reason: "circular dependency",
                  declinedBy: formatUrlForClient(dependentUrl)
                };
              }
              const dependentPropagationResult = iterate(dependentUrlInfo, [...seen, dependentUrl]);
              if (dependentPropagationResult.accepted) {
                instructions.push(...dependentPropagationResult.instructions);
                continue;
              }
              if (
              // declined explicitely by an other file, it must decline the whole update
              dependentPropagationResult.declinedBy) {
                return dependentPropagationResult;
              }
              // declined by absence of boundary, we can keep searching
            }

            if (instructions.length === 0) {
              return {
                declined: true,
                reason: `there is no file accepting hot reload while propagating update`
              };
            }
            return {
              accepted: true,
              reason: `${instructions.length} dependent file(s) accepts hot reload`,
              instructions
            };
          };
          const seen = [];
          return iterate(firstUrlInfo, seen);
        };
        clientFileChangeCallbackList.push(({
          url,
          event
        }) => {
          const onUrlInfo = urlInfo => {
            const relativeUrl = formatUrlForClient(urlInfo.url);
            const hotUpdate = propagateUpdate(urlInfo);
            if (hotUpdate.declined) {
              notifyDeclined({
                cause: `${relativeUrl} ${event}`,
                reason: hotUpdate.reason,
                declinedBy: hotUpdate.declinedBy
              });
            } else {
              notifyAccepted({
                cause: `${relativeUrl} ${event}`,
                reason: hotUpdate.reason,
                instructions: hotUpdate.instructions
              });
            }
          };
          const exactUrlInfo = urlGraph.getUrlInfo(url);
          if (exactUrlInfo) {
            onUrlInfo(exactUrlInfo);
          }
          urlGraph.urlInfoMap.forEach(urlInfo => {
            if (urlInfo === exactUrlInfo) return;
            const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
            if (urlWithoutSearch !== url) return;
            if (exactUrlInfo && exactUrlInfo.dependents.has(urlInfo.url)) return;
            onUrlInfo(urlInfo);
          });
        });
        clientFilesPruneCallbackList.push((prunedUrlInfos, firstUrlInfo) => {
          const mainHotUpdate = propagateUpdate(firstUrlInfo);
          const cause = `following files are no longer referenced: ${prunedUrlInfos.map(prunedUrlInfo => formatUrlForClient(prunedUrlInfo.url))}`;
          // now check if we can hot update the main resource
          // then if we can hot update all dependencies
          if (mainHotUpdate.declined) {
            notifyDeclined({
              cause,
              reason: mainHotUpdate.reason,
              declinedBy: mainHotUpdate.declinedBy
            });
            return;
          }
          // main can hot update
          let i = 0;
          const instructions = [];
          while (i < prunedUrlInfos.length) {
            const prunedUrlInfo = prunedUrlInfos[i++];
            if (prunedUrlInfo.data.hotDecline) {
              notifyDeclined({
                cause,
                reason: `a pruned file declines hot reload`,
                declinedBy: formatUrlForClient(prunedUrlInfo.url)
              });
              return;
            }
            instructions.push({
              type: "prune",
              boundary: formatUrlForClient(prunedUrlInfo.url),
              acceptedBy: formatUrlForClient(firstUrlInfo.url)
            });
          }
          notifyAccepted({
            cause,
            reason: mainHotUpdate.reason,
            instructions
          });
        });
      }
    },
    serve: (request, {
      rootDirectoryUrl,
      urlGraph
    }) => {
      if (request.pathname === "/__graph__") {
        const graphJson = JSON.stringify(urlGraph.toJSON(rootDirectoryUrl));
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson)
          },
          body: graphJson
        };
      }
      return null;
    }
  };
};

const jsenvPluginAutoreload = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
}) => {
  return [jsenvPluginHmr(), jsenvPluginAutoreloadClient(), jsenvPluginAutoreloadServer({
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList
  })];
};

const jsenvPluginCacheControl = ({
  versionedUrls = true,
  maxAge = SECONDS_IN_30_DAYS$1
}) => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({
      reference
    }) => {
      if (versionedUrls && reference.searchParams.has("v") && !reference.searchParams.has("hmr")) {
        return {
          headers: {
            "cache-control": `private,max-age=${maxAge},immutable`
          }
        };
      }
      return null;
    }
  };
};
const SECONDS_IN_30_DAYS$1 = 60 * 60 * 24 * 30;

const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html"
}) => {
  const ribbonClientFileUrl = new URL("./js/ribbon.js", import.meta.url);
  const associations = URL_META.resolveAssociations({
    ribbon: {
      [htmlInclude]: true
    }
  }, rootDirectoryUrl);
  return {
    name: "jsenv:ribbon",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo, context) => {
        if (urlInfo.data.isJsenvToolbar || urlInfo.data.noribbon) {
          return null;
        }
        const {
          ribbon
        } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(urlInfo.url),
          associations
        });
        if (!ribbon) {
          return null;
        }
        const htmlAst = parseHtmlString(urlInfo.content);
        const [ribbonClientFileReference] = context.referenceUtils.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: ribbonClientFileUrl.href
        });
        const paramsJson = JSON.stringify({
          text: context.dev ? "DEV" : "BUILD"
        }, null, "  ");
        injectHtmlNode(htmlAst, createHtmlNode({
          tagName: "script",
          type: "module",
          textContent: `import { injectRibbon } from "${ribbonClientFileReference.generatedSpecifier}"

injectRibbon(${paramsJson});`
        }), "jsenv:ribbon");
        return stringifyHtmlAst(htmlAst);
      }
    }
  };
};

const getCorePlugins = ({
  rootDirectoryUrl,
  runtimeCompat,
  nodeEsmResolution = {},
  webResolution = {},
  urlAnalysis = {},
  fileSystemMagicRedirection,
  directoryReferenceAllowed,
  supervisor,
  transpilation = true,
  inlining = true,
  clientAutoreload = false,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true
} = {}) => {
  if (cacheControl === true) {
    cacheControl = {};
  }
  if (supervisor === true) {
    supervisor = {};
  }
  if (fileSystemMagicRedirection === true) {
    fileSystemMagicRedirection = {};
  }
  if (clientAutoreload === true) {
    clientAutoreload = {};
  }
  if (ribbon === true) {
    ribbon = {};
  }
  return [jsenvPluginUrlAnalysis({
    rootDirectoryUrl,
    ...urlAnalysis
  }), jsenvPluginTranspilation(transpilation), jsenvPluginImportmap(),
  // before node esm to handle bare specifiers
  // + before node esm to handle importmap before inline content
  jsenvPluginInlineContentAnalysis(),
  // before "file urls" to resolve and load inline urls
  ...(inlining ? [jsenvPluginInlining()] : []), ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []),
  // after inline as it needs inline script to be cooked

  /* When resolving references the following applies by default:
     - http urls are resolved by jsenvPluginHttpUrls
     - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
     - reference inside a js module -> resolved by node esm
     - All the rest uses web standard url resolution
   */
  jsenvPluginFileUrls({
    directoryReferenceAllowed,
    ...fileSystemMagicRedirection
  }), jsenvPluginHttpUrls(), ...(nodeEsmResolution ? [jsenvPluginNodeEsmResolution(nodeEsmResolution)] : []), jsenvPluginWebResolution(webResolution), jsenvPluginUrlVersion(), jsenvPluginCommonJsGlobals(), jsenvPluginImportMetaScenarios(), ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []), jsenvPluginNodeRuntime({
    runtimeCompat
  }), jsenvPluginImportMetaHot(), ...(clientAutoreload ? [jsenvPluginAutoreload({
    ...clientAutoreload,
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList
  })] : []), ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []), ...(ribbon ? [jsenvPluginRibbon({
    rootDirectoryUrl,
    ...ribbon
  })] : [])];
};

const ensureUnixLineBreaks = stringOrBuffer => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n");
    return stringWithLinuxBreaks;
  }
  return ensureUnixLineBreaksOnBuffer(stringOrBuffer);
};

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const ensureUnixLineBreaksOnBuffer = buffer => {
  const int32Array = new Int32Array(buffer, 0, buffer.length);
  const int32ArrayWithLineBreaksNormalized = int32Array.filter((element, index, typedArray) => {
    if (element === 0x0d) {
      if (typedArray[index + 1] === 0x0a) {
        // Windows -> Unix
        return false;
      }
      // Mac OS -> Unix
      typedArray[index] = 0x0a;
    }
    return true;
  });
  return Buffer.from(int32ArrayWithLineBreaksNormalized);
};

const jsenvPluginLineBreakNormalization = () => {
  return {
    name: "jsenv:line_break_normalizer",
    appliesDuring: "build",
    transformUrlContent: urlInfo => {
      if (CONTENT_TYPE.isTextual(urlInfo.contentType)) {
        return ensureUnixLineBreaks(urlInfo.content);
      }
      return null;
    }
  };
};

const GRAPH = {
  map: (graph, callback) => {
    const array = [];
    graph.urlInfoMap.forEach(urlInfo => {
      array.push(callback(urlInfo));
    });
    return array;
  },
  forEach: (graph, callback) => {
    graph.urlInfoMap.forEach(callback);
  },
  filter: (graph, callback) => {
    const urlInfos = [];
    graph.urlInfoMap.forEach(urlInfo => {
      if (callback(urlInfo)) {
        urlInfos.push(urlInfo);
      }
    });
    return urlInfos;
  },
  find: (graph, callback) => {
    let found = null;
    for (const urlInfo of graph.urlInfoMap.values()) {
      if (callback(urlInfo)) {
        found = urlInfo;
        break;
      }
    }
    return found;
  }
};

const memoizeByFirstArgument = compute => {
  const urlCache = new Map();
  const fnWithMemoization = (url, ...args) => {
    const valueFromCache = urlCache.get(url);
    if (valueFromCache) {
      return valueFromCache;
    }
    const value = compute(url, ...args);
    urlCache.set(url, value);
    return value;
  };
  fnWithMemoization.forget = () => {
    urlCache.clear();
  };
  return fnWithMemoization;
};

const createBuildUrlsGenerator = ({
  buildDirectoryUrl,
  assetsDirectory
}) => {
  const cache = {};
  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename$1(url);
    }
    if (urlInfo.filename) {
      return urlInfo.filename;
    }
    return urlToFilename$1(url);
  };
  const generate = memoizeByFirstArgument((url, {
    urlInfo,
    parentUrlInfo
  }) => {
    const directoryPath = determineDirectoryPath({
      buildDirectoryUrl,
      assetsDirectory,
      urlInfo,
      parentUrlInfo
    });
    let names = cache[directoryPath];
    if (!names) {
      names = [];
      cache[directoryPath] = names;
    }
    const urlObject = new URL(url);
    let {
      search,
      hash
    } = urlObject;
    let name = getUrlName(url, urlInfo);
    let [basename, extension] = splitFileExtension(name);
    extension = extensionMappings[extension] || extension;
    let nameCandidate = `${basename}${extension}`; // reconstruct name in case extension was normalized
    let integer = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate);
        break;
      }
      integer++;
      nameCandidate = `${basename}${integer}${extension}`;
    }
    return `${buildDirectoryUrl}${directoryPath}${nameCandidate}${search}${hash}`;
  });
  return {
    generate
  };
};

// It's best to generate files with an extension representing what is inside the file
// and after build js files contains solely js (js or typescript is gone).
// This way a static file server is already configured to server the correct content-type
// (otherwise one would have to configure that ".jsx" is "text/javascript")
// To keep in mind: if you have "user.jsx" and "user.js" AND both file are not bundled
// you end up with "dist/js/user.js" and "dist/js/user2.js"
const extensionMappings = {
  ".jsx": ".js",
  ".ts": ".js",
  ".tsx": ".js"
};
const splitFileExtension = filename => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};
const determineDirectoryPath = ({
  buildDirectoryUrl,
  assetsDirectory,
  urlInfo,
  parentUrlInfo
}) => {
  if (urlInfo.type === "directory") {
    return "";
  }
  if (parentUrlInfo && parentUrlInfo.type === "directory") {
    const parentDirectoryPath = urlToRelativeUrl(parentUrlInfo.url, buildDirectoryUrl);
    return parentDirectoryPath;
  }
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      buildDirectoryUrl,
      assetsDirectory,
      urlInfo: parentUrlInfo
    });
    return parentDirectoryPath;
  }
  if (urlInfo.isEntryPoint) {
    return "";
  }
  if (urlInfo.type === "importmap") {
    return "";
  }
  if (urlInfo.type === "html") {
    return `${assetsDirectory}html/`;
  }
  if (urlInfo.type === "css") {
    return `${assetsDirectory}css/`;
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return `${assetsDirectory}js/`;
  }
  if (urlInfo.type === "json") {
    return `${assetsDirectory}json/`;
  }
  return `${assetsDirectory}other/`;
};

// https://bundlers.tooling.report/hashing/avoid-cascade/
const injectVersionMappingsAsGlobal = async ({
  urlInfo,
  kitchen,
  versionMappings
}) => {
  const injector = injectors[urlInfo.type];
  if (injector) {
    const {
      content,
      sourcemap
    } = await injector(urlInfo, {
      versionMappings,
      minification: kitchen.kitchenContext.minification
    });
    kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
      content,
      sourcemap
    });
  }
};
const injectors = {
  html: (urlInfo, {
    versionMappings,
    minification
  }) => {
    const htmlAst = parseHtmlString(urlInfo.content, {
      storeOriginalPositions: false
    });
    injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
      tagName: "script",
      textContent: generateClientCodeForVersionMappings(versionMappings, {
        globalName: "window",
        minification
      })
    }), "jsenv:versioning");
    return {
      content: stringifyHtmlAst(htmlAst)
    };
  },
  js_classic: (...args) => jsInjector(...args),
  js_module: (...args) => jsInjector(...args)
};
const jsInjector = (urlInfo, {
  versionMappings,
  minification
}) => {
  const magicSource = createMagicSource(urlInfo.content);
  const code = generateClientCodeForVersionMappings(versionMappings, {
    globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
    minification
  });
  magicSource.prepend(`${code}\n\n`);
  return magicSource.toContentAndSourcemap();
};
const generateClientCodeForVersionMappings = (versionMappings, {
  globalName,
  minification
}) => {
  if (minification) {
    return `;(function(){var m = ${JSON.stringify(versionMappings)}; ${globalName}.__v__ = function (s) { return m[s] || s }; })();`;
  }
  return `;(function() {
  var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")};
  ${globalName}.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();`;
};
const injectVersionMappingsAsImportmap = async ({
  urlInfo,
  kitchen,
  versionMappings
}) => {
  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
    tagName: "script",
    type: "importmap",
    textContent: kitchen.kitchenContext.minification ? JSON.stringify({
      imports: versionMappings
    }) : JSON.stringify({
      imports: versionMappings
    }, null, "  ")
  }), "jsenv:versioning");
  kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
    content: stringifyHtmlAst(htmlAst)
  });
};

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
const createVersionGenerator = () => {
  const hash = createHash("sha256");
  return {
    augmentWithContent: content => {
      hash.update(content);
    },
    augment: value => {
      hash.update(value);
    },
    generate: () => {
      return hash.digest("hex").slice(0, 8);
    }
  };
};

/*
 * Build is split in 3 steps:
 * 1. craft
 * 2. shape
 * 3. refine
 *
 * craft: prepare all the materials
 *  - resolve, fetch and transform all source files into "rawGraph"
 * shape: this step can drastically change url content and their relationships
 *  - bundling
 *  - optimizations (minification)
 * refine: perform minor changes on the url contents
 *  - cleaning html
 *  - url versioning
 *  - ressource hints
 *  - injecting urls into service workers
 */

// default runtimeCompat corresponds to
// "we can keep <script type="module"> intact":
// so script_type_module + dynamic_import + import_meta
const defaultRuntimeCompat = {
  // android: "8",
  chrome: "64",
  edge: "79",
  firefox: "67",
  ios: "12",
  opera: "51",
  safari: "11.3",
  samsung: "9.2"
};

/**
 * Generate an optimized version of source files into a directory
 * @param {Object} buildParameters
 * @param {string|url} buildParameters.sourceDirectoryUrl
 *        Directory containing source files
 * @param {string|url} buildParameters.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} buildParameters.entryPoints
 *        Object where keys are paths to source files and values are their future name in the build directory.
 *        Keys are relative to sourceDirectoryUrl
 * @param {object} buildParameters.runtimeCompat
 *        Code generated will be compatible with these runtimes
 * @param {string} [buildParameters.assetsDirectory=""]
 *        Directory where asset files will be written
 * @param {string|url} [buildParameters.base=""]
 *        Urls in build file contents will be prefixed with this string
 * @param {boolean} [buildParameters.versioning=true]
 *        Controls if url in build file contents are versioned
 * @param {('search_param'|'filename')} [buildParameters.versioningMethod="search_param"]
 *        Controls how url are versioned
 * @param {('none'|'inline'|'file'|'programmatic'} [buildParameters.sourcemaps="none"]
 *        Generate sourcemaps in the build directory
 * @return {Object} buildReturnValue
 * @return {Object} buildReturnValue.buildFileContents
 *        Contains all build file paths relative to the build directory and their content
 * @return {Object} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Object} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */
const build = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  assetsDirectory = "",
  runtimeCompat = defaultRuntimeCompat,
  base = runtimeCompat.node ? "./" : "/",
  plugins = [],
  sourcemaps = "none",
  sourcemapsSourcesContent,
  urlAnalysis = {},
  urlResolution,
  fileSystemMagicRedirection,
  directoryReferenceAllowed,
  scenarioPlaceholders,
  transpilation = {},
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param",
  // "filename", "search_param"
  versioningViaImportmap = true,
  lineBreakNormalization = process.platform === "win32",
  sourceFilesConfig = {},
  cooldownBetweenFileEvents,
  watch = false,
  directoryToClean,
  writeOnFileSystem = true,
  outDirectoryUrl,
  assetManifest = versioningMethod === "filename",
  assetManifestFileRelativeUrl = "asset-manifest.json",
  ...rest
}) => {
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(`${unexpectedParamNames.join(",")}: there is no such param`);
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl, "sourceDirectoryUrl");
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl, "buildDirectoryUrl");
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(outDirectoryUrl, "outDirectoryUrl");
    }
    if (typeof entryPoints !== "object" || entryPoints === null) {
      throw new TypeError(`entryPoints must be an object, got ${entryPoints}`);
    }
    const keys = Object.keys(entryPoints);
    keys.forEach(key => {
      if (!key.startsWith("./")) {
        throw new TypeError(`entryPoints keys must start with "./", found ${key}`);
      }
      const value = entryPoints[key];
      if (typeof value !== "string") {
        throw new TypeError(`entryPoints values must be strings, found "${value}" on key "${key}"`);
      }
      if (value.includes("/")) {
        throw new TypeError(`entryPoints values must be plain strings (no "/"), found "${value}" on key "${key}"`);
      }
    });
    if (!["filename", "search_param"].includes(versioningMethod)) {
      throw new TypeError(`versioningMethod must be "filename" or "search_param", got ${versioning}`);
    }
  }
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, abort);
    });
  }
  if (assetsDirectory && assetsDirectory[assetsDirectory.length - 1] !== "/") {
    assetsDirectory = `${assetsDirectory}/`;
  }
  if (directoryToClean === undefined) {
    if (assetsDirectory === undefined) {
      directoryToClean = buildDirectoryUrl;
    } else {
      directoryToClean = new URL(assetsDirectory, buildDirectoryUrl).href;
    }
  }
  const asFormattedBuildUrl = (generatedUrl, reference) => {
    if (base === "./") {
      const urlRelativeToParent = urlToRelativeUrl(generatedUrl, reference.parentUrl === sourceDirectoryUrl ? buildDirectoryUrl : reference.parentUrl);
      if (urlRelativeToParent[0] !== ".") {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        return `./${urlRelativeToParent}`;
      }
      return urlRelativeToParent;
    }
    const urlRelativeToBuildDirectory = urlToRelativeUrl(generatedUrl, buildDirectoryUrl);
    return `${base}${urlRelativeToBuildDirectory}`;
  };
  const runBuild = async ({
    signal,
    logLevel
  }) => {
    const logger = createLogger({
      logLevel
    });
    const buildOperation = Abort.startOperation();
    buildOperation.addAbortSignal(signal);
    const entryPointKeys = Object.keys(entryPoints);
    if (entryPointKeys.length === 1) {
      logger.info(`
build "${entryPointKeys[0]}"`);
    } else {
      logger.info(`
build ${entryPointKeys.length} entry points`);
    }
    const explicitJsModuleFallback = entryPointKeys.some(key => entryPoints[key].includes("?js_module_fallback"));
    const rawRedirections = new Map();
    const bundleRedirections = new Map();
    const bundleInternalRedirections = new Map();
    const finalRedirections = new Map();
    const versioningRedirections = new Map();
    const entryUrls = [];
    const rawGraph = createUrlGraph();
    const contextSharedDuringBuild = {
      systemJsTranspilation: (() => {
        const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
        if (nodeRuntimeEnabled) return false;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "script_type_module")) return true;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_dynamic")) return true;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_meta")) return true;
        if (versioning && versioningViaImportmap && !RUNTIME_COMPAT.isSupported(runtimeCompat, "importmap")) return true;
        return false;
      })(),
      minification: plugins.some(plugin => plugin.name === "jsenv:minification")
    };
    const rawGraphKitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      urlGraph: rawGraph,
      build: true,
      runtimeCompat,
      ...contextSharedDuringBuild,
      plugins: [...plugins, {
        appliesDuring: "build",
        fetchUrlContent: (urlInfo, context) => {
          if (context.reference.original) {
            rawRedirections.set(context.reference.original.url, context.reference.url);
          }
        },
        formatUrl: reference => {
          if (!reference.shouldHandle) {
            return `ignore:${reference.specifier}`;
          }
          return null;
        }
      }, ...getCorePlugins({
        rootDirectoryUrl: sourceDirectoryUrl,
        urlGraph: rawGraph,
        runtimeCompat,
        urlAnalysis,
        urlResolution,
        fileSystemMagicRedirection,
        directoryReferenceAllowed,
        transpilation: {
          ...transpilation,
          babelHelpersAsImport: !explicitJsModuleFallback,
          jsModuleFallbackOnJsClassic: false
        },
        inlining: false,
        scenarioPlaceholders
      })],
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl ? new URL("build/", outDirectoryUrl) : undefined
    });
    const buildUrlsGenerator = createBuildUrlsGenerator({
      buildDirectoryUrl,
      assetsDirectory
    });
    const buildDirectoryRedirections = new Map();
    const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
      if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
        throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`);
      }
      logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
      buildDirectoryRedirections.set(buildUrl, rawUrl);
    };
    const buildUrls = new Map();
    const bundleUrlInfos = {};
    const bundlers = {};
    const finalGraph = createUrlGraph();
    const urlAnalysisPlugin = jsenvPluginUrlAnalysis({
      rootDirectoryUrl: sourceDirectoryUrl,
      ...urlAnalysis
    });
    const finalGraphKitchen = createKitchen({
      logLevel,
      rootDirectoryUrl: buildDirectoryUrl,
      urlGraph: finalGraph,
      build: true,
      runtimeCompat,
      ...contextSharedDuringBuild,
      plugins: [urlAnalysisPlugin, ...(lineBreakNormalization ? [jsenvPluginLineBreakNormalization()] : []), jsenvPluginJsModuleFallback({
        systemJsInjection: true
      }), jsenvPluginInlineContentAnalysis({
        fetchInlineUrls: false
      }), jsenvPluginInlining(), {
        name: "jsenv:build",
        appliesDuring: "build",
        resolveUrl: reference => {
          const getUrl = () => {
            if (reference.type === "filesystem") {
              const parentRawUrl = buildDirectoryRedirections.get(reference.parentUrl);
              const parentUrl = ensurePathnameTrailingSlash(parentRawUrl);
              return new URL(reference.specifier, parentUrl).href;
            }
            if (reference.specifier[0] === "/") {
              return new URL(reference.specifier.slice(1), buildDirectoryUrl).href;
            }
            return new URL(reference.specifier, reference.baseUrl || reference.parentUrl).href;
          };
          let url = getUrl();
          //  url = rawRedirections.get(url) || url
          url = bundleRedirections.get(url) || url;
          url = bundleInternalRedirections.get(url) || url;
          return url;
        },
        // redirecting urls into the build directory
        redirectUrl: reference => {
          if (!reference.url.startsWith("file:")) {
            return null;
          }
          // referenced by resource hint
          // -> keep it untouched, it will be handled by "resync_resource_hints"
          if (reference.isResourceHint) {
            return reference.original ? reference.original.url : null;
          }
          // already a build url
          const rawUrl = buildDirectoryRedirections.get(reference.url);
          if (rawUrl) {
            return reference.url;
          }
          if (reference.isInline) {
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl);
            const parentRawUrl = parentUrlInfo.originalUrl;
            const rawUrlInfo = GRAPH.find(rawGraph, rawUrlInfo => {
              const {
                inlineUrlSite
              } = rawUrlInfo;
              // not inline
              if (!inlineUrlSite) return false;
              if (inlineUrlSite.url === parentRawUrl && inlineUrlSite.line === reference.specifierLine && inlineUrlSite.column === reference.specifierColumn) {
                return true;
              }
              if (rawUrlInfo.content === reference.content) {
                return true;
              }
              if (rawUrlInfo.originalContent === reference.content) {
                return true;
              }
              return false;
            });
            if (!rawUrlInfo) {
              // generated during final graph
              // (happens for JSON.parse injected for import assertions for instance)
              // throw new Error(`cannot find raw url for "${reference.url}"`)
              return reference.url;
            }
            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: rawUrlInfo,
              parentUrlInfo
            });
            associateBuildUrlAndRawUrl(buildUrl, rawUrlInfo.url, "inline content");
            return buildUrl;
          }
          // from "js_module_fallback":
          //   - injecting "?js_module_fallback" for the first time
          //   - injecting "?js_module_fallback" because the parentUrl has it
          if (reference.original) {
            const urlBeforeRedirect = reference.original.url;
            const urlAfterRedirect = reference.url;
            const isEntryPoint = reference.isEntryPoint || isWebWorkerEntryPointReference(reference);
            // the url info do not exists yet (it will be created after this "redirectUrl" hook)
            // And the content will be generated when url is cooked by url graph loader.
            // Here we just want to reserve an url for that file
            const urlInfo = {
              data: reference.data,
              isEntryPoint,
              type: reference.expectedType,
              subtype: reference.expectedSubtype,
              filename: reference.filename
            };
            if (urlIsInsideOf(urlBeforeRedirect, buildDirectoryUrl)) {
              // the redirection happened on a build url, happens due to:
              // 1. bundling
              const buildUrl = buildUrlsGenerator.generate(urlAfterRedirect, {
                urlInfo
              });
              finalRedirections.set(urlBeforeRedirect, buildUrl);
              return buildUrl;
            }
            const rawUrl = urlAfterRedirect;
            const buildUrl = buildUrlsGenerator.generate(rawUrl, {
              urlInfo
            });
            finalRedirections.set(urlBeforeRedirect, buildUrl);
            associateBuildUrlAndRawUrl(buildUrl, rawUrl, "redirected during postbuild");
            return buildUrl;
          }
          // from "js_module_fallback":
          //   - to inject "s.js"
          if (reference.injected) {
            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: {
                data: {},
                type: "js_classic"
              }
            });
            associateBuildUrlAndRawUrl(buildUrl, reference.url, "injected during postbuild");
            finalRedirections.set(buildUrl, buildUrl);
            return buildUrl;
          }
          const rawUrlInfo = rawGraph.getUrlInfo(reference.url);
          const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl);
          // files from root directory but not given to rollup nor postcss
          if (rawUrlInfo) {
            const referencedUrlObject = new URL(reference.url);
            referencedUrlObject.searchParams.delete("as_js_classic");
            const buildUrl = buildUrlsGenerator.generate(referencedUrlObject.href, {
              urlInfo: rawUrlInfo,
              parentUrlInfo
            });
            associateBuildUrlAndRawUrl(buildUrl, rawUrlInfo.url, "raw file");
            if (buildUrl.includes("?")) {
              associateBuildUrlAndRawUrl(asUrlWithoutSearch(buildUrl), rawUrlInfo.url, "raw file");
            }
            return buildUrl;
          }
          if (reference.type === "sourcemap_comment") {
            // inherit parent build url
            return generateSourcemapFileUrl(reference.parentUrl);
          }
          // files generated during the final graph:
          // - sourcemaps
          // const finalUrlInfo = finalGraph.getUrlInfo(url)
          const buildUrl = buildUrlsGenerator.generate(reference.url, {
            urlInfo: {
              data: {},
              type: "asset"
            }
          });
          return buildUrl;
        },
        formatUrl: reference => {
          if (!reference.generatedUrl.startsWith("file:")) {
            if (!versioning && reference.generatedUrl.startsWith("ignore:")) {
              return reference.generatedUrl.slice("ignore:".length);
            }
            return null;
          }
          if (reference.isResourceHint) {
            return null;
          }
          if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
            throw new Error(`urls should be inside build directory at this stage, found "${reference.url}"`);
          }
          const generatedUrlObject = new URL(reference.generatedUrl);
          generatedUrlObject.searchParams.delete("js_classic");
          generatedUrlObject.searchParams.delete("js_module");
          generatedUrlObject.searchParams.delete("js_module_fallback");
          generatedUrlObject.searchParams.delete("as_js_classic");
          generatedUrlObject.searchParams.delete("as_js_module");
          generatedUrlObject.searchParams.delete("as_json_module");
          generatedUrlObject.searchParams.delete("as_css_module");
          generatedUrlObject.searchParams.delete("as_text_module");
          generatedUrlObject.hash = "";
          const generatedUrl = generatedUrlObject.href;
          const specifier = asFormattedBuildUrl(generatedUrl, reference);
          buildUrls.set(specifier, reference.generatedUrl);
          return specifier;
        },
        fetchUrlContent: async (finalUrlInfo, context) => {
          const fromBundleOrRawGraph = url => {
            const bundleUrlInfo = bundleUrlInfos[url];
            if (bundleUrlInfo) {
              // logger.debug(`fetching from bundle ${url}`)
              return bundleUrlInfo;
            }
            const rawUrl = buildDirectoryRedirections.get(url) || url;
            const rawUrlInfo = rawGraph.getUrlInfo(rawUrl);
            if (!rawUrlInfo) {
              throw new Error(createDetailedMessage$1(`Cannot find url`, {
                url,
                "raw urls": Array.from(buildDirectoryRedirections.values()),
                "build urls": Array.from(buildDirectoryRedirections.keys())
              }));
            }
            // logger.debug(`fetching from raw graph ${url}`)
            if (rawUrlInfo.isInline) {
              // Inline content, such as <script> inside html, is transformed during the previous phase.
              // If we read the inline content it would be considered as the original content.
              // - It could be "fixed" by taking into account sourcemap and consider sourcemap sources
              //   as the original content.
              //   - But it would not work when sourcemap are not generated
              //   - would be a bit slower
              // - So instead of reading the inline content directly, we search into raw graph
              //   to get "originalContent" and "sourcemap"
              finalUrlInfo.type = rawUrlInfo.type;
              finalUrlInfo.subtype = rawUrlInfo.subtype;
              return rawUrlInfo;
            }
            return rawUrlInfo;
          };
          const {
            reference
          } = context;
          // reference injected during "postbuild":
          // - happens for "js_module_fallback" injecting "s.js"
          if (reference.injected) {
            const [ref, rawUrlInfo] = rawGraphKitchen.injectReference({
              ...reference,
              parentUrl: buildDirectoryRedirections.get(reference.parentUrl)
            });
            await rawGraphKitchen.cook(rawUrlInfo, {
              reference: ref
            });
            return rawUrlInfo;
          }
          if (reference.isInline) {
            if (reference.prev && !reference.prev.isInline) {
              const urlBeforeRedirect = findKey(finalRedirections, reference.prev.url);
              return fromBundleOrRawGraph(urlBeforeRedirect);
            }
            return fromBundleOrRawGraph(reference.url);
          }
          // reference updated during "postbuild":
          // - happens for "js_module_fallback"
          if (reference.original) {
            return fromBundleOrRawGraph(reference.original.url);
          }
          return fromBundleOrRawGraph(finalUrlInfo.url);
        }
      }, {
        name: "jsenv:optimize",
        appliesDuring: "build",
        finalizeUrlContent: async (urlInfo, context) => {
          await rawGraphKitchen.pluginController.callAsyncHooks("optimizeUrlContent", urlInfo, context, async optimizeReturnValue => {
            await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, optimizeReturnValue);
          });
        }
      }],
      sourcemaps,
      sourcemapsSourcesContent,
      sourcemapsSourcesRelative: !versioning,
      outDirectoryUrl: outDirectoryUrl ? new URL("postbuild/", outDirectoryUrl) : undefined
    });
    const finalEntryUrls = [];
    {
      const generateSourceGraph = createTaskLog("generate source graph", {
        disabled: logger.levels.debug || !logger.levels.info
      });
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`build/`, outDirectoryUrl));
        }
        const rawUrlGraphLoader = createUrlGraphLoader(rawGraphKitchen.kitchenContext);
        Object.keys(entryPoints).forEach(key => {
          const [entryReference, entryUrlInfo] = rawGraphKitchen.kitchenContext.prepareEntryPoint({
            trace: {
              message: `"${key}" in entryPoints parameter`
            },
            parentUrl: sourceDirectoryUrl,
            type: "entry_point",
            specifier: key
          });
          entryUrls.push(entryUrlInfo.url);
          entryUrlInfo.filename = entryPoints[key];
          entryUrlInfo.isEntryPoint = true;
          rawUrlGraphLoader.load(entryUrlInfo, {
            reference: entryReference
          });
        });
        await rawUrlGraphLoader.getAllLoadDonePromise(buildOperation);
      } catch (e) {
        generateSourceGraph.fail();
        throw e;
      }
      generateSourceGraph.done();
    }
    {
      {
        rawGraphKitchen.pluginController.plugins.forEach(plugin => {
          const bundle = plugin.bundle;
          if (!bundle) {
            return;
          }
          if (typeof bundle !== "object") {
            throw new Error(`bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`);
          }
          Object.keys(bundle).forEach(type => {
            const bundleFunction = bundle[type];
            if (!bundleFunction) {
              return;
            }
            const bundlerForThatType = bundlers[type];
            if (bundlerForThatType) {
              // first plugin to define a bundle hook wins
              return;
            }
            bundlers[type] = {
              plugin,
              bundleFunction: bundle[type],
              urlInfos: []
            };
          });
        });
        const addToBundlerIfAny = rawUrlInfo => {
          const bundler = bundlers[rawUrlInfo.type];
          if (bundler) {
            bundler.urlInfos.push(rawUrlInfo);
          }
        };
        GRAPH.forEach(rawGraph, rawUrlInfo => {
          // cleanup unused urls (avoid bundling things that are not actually used)
          // happens for:
          // - js import assertions
          // - as_js_classic
          if (!isUsed(rawUrlInfo)) {
            rawGraph.deleteUrlInfo(rawUrlInfo.url);
            return;
          }
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo);
          }
          if (rawUrlInfo.type === "html") {
            rawUrlInfo.dependencies.forEach(dependencyUrl => {
              const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl);
              if (dependencyUrlInfo.isInline) {
                if (dependencyUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  dependencyUrlInfo.references.forEach(inlineScriptRef => {
                    if (inlineScriptRef.type === "js_import") {
                      const inlineUrlInfo = rawGraph.getUrlInfo(inlineScriptRef.url);
                      addToBundlerIfAny(inlineUrlInfo);
                    }
                  });
                }
                // inline content cannot be bundled
                return;
              }
              addToBundlerIfAny(dependencyUrlInfo);
            });
            rawUrlInfo.references.forEach(reference => {
              if (reference.isResourceHint && reference.expectedType === "js_module") {
                const referencedUrlInfo = rawGraph.getUrlInfo(reference.url);
                if (referencedUrlInfo &&
                // something else than the resource hint is using this url
                referencedUrlInfo.dependents.size > 0) {
                  addToBundlerIfAny(referencedUrlInfo);
                }
              }
            });
            return;
          }
          // File referenced with new URL('./file.js', import.meta.url)
          // are entry points that should be bundled
          // For instance we will bundle service worker/workers detected like this
          if (rawUrlInfo.type === "js_module") {
            rawUrlInfo.references.forEach(reference => {
              if (reference.type !== "js_url") {
                return;
              }
              const referencedUrlInfo = rawGraph.getUrlInfo(reference.url);
              const bundler = bundlers[referencedUrlInfo.type];
              if (!bundler) {
                return;
              }
              let willAlreadyBeBundled = true;
              for (const dependent of referencedUrlInfo.dependents) {
                const dependentUrlInfo = rawGraph.getUrlInfo(dependent);
                for (const reference of dependentUrlInfo.references) {
                  if (reference.url === referencedUrlInfo.url) {
                    willAlreadyBeBundled = reference.subtype === "import_dynamic" || reference.type === "script";
                  }
                }
              }
              if (!willAlreadyBeBundled) {
                bundler.urlInfos.push(referencedUrlInfo);
              }
            });
          }
        });
        await Object.keys(bundlers).reduce(async (previous, type) => {
          await previous;
          const bundler = bundlers[type];
          const urlInfosToBundle = bundler.urlInfos;
          if (urlInfosToBundle.length === 0) {
            return;
          }
          const bundleTask = createTaskLog(`bundle "${type}"`, {
            disabled: logger.levels.debug || !logger.levels.info
          });
          try {
            const bundlerGeneratedUrlInfos = await rawGraphKitchen.pluginController.callAsyncHook({
              plugin: bundler.plugin,
              hookName: "bundle",
              value: bundler.bundleFunction
            }, urlInfosToBundle, {
              ...rawGraphKitchen.kitchenContext,
              buildDirectoryUrl,
              assetsDirectory
            });
            Object.keys(bundlerGeneratedUrlInfos).forEach(url => {
              const rawUrlInfo = rawGraph.getUrlInfo(url);
              const bundlerGeneratedUrlInfo = bundlerGeneratedUrlInfos[url];
              const bundleUrlInfo = {
                type,
                subtype: rawUrlInfo ? rawUrlInfo.subtype : undefined,
                isEntryPoint: rawUrlInfo ? rawUrlInfo.isEntryPoint : undefined,
                filename: rawUrlInfo ? rawUrlInfo.filename : undefined,
                originalUrl: rawUrlInfo ? rawUrlInfo.originalUrl : undefined,
                originalContent: rawUrlInfo ? rawUrlInfo.originalContent : undefined,
                ...bundlerGeneratedUrlInfo,
                data: {
                  ...(rawUrlInfo ? rawUrlInfo.data : {}),
                  ...bundlerGeneratedUrlInfo.data,
                  fromBundle: true
                }
              };
              if (bundlerGeneratedUrlInfo.sourceUrls) {
                bundlerGeneratedUrlInfo.sourceUrls.forEach(sourceUrl => {
                  const sourceRawUrlInfo = rawGraph.getUrlInfo(sourceUrl);
                  if (sourceRawUrlInfo) {
                    sourceRawUrlInfo.data.bundled = true;
                  }
                });
              }
              const buildUrl = buildUrlsGenerator.generate(url, {
                urlInfo: bundleUrlInfo
              });
              bundleRedirections.set(url, buildUrl);
              if (urlIsInsideOf(url, buildDirectoryUrl)) {
                if (bundlerGeneratedUrlInfo.data.isDynamicEntry) {
                  const rawUrlInfo = rawGraph.getUrlInfo(bundlerGeneratedUrlInfo.originalUrl);
                  rawUrlInfo.data.bundled = false;
                  bundleRedirections.set(bundlerGeneratedUrlInfo.originalUrl, buildUrl);
                  associateBuildUrlAndRawUrl(buildUrl, bundlerGeneratedUrlInfo.originalUrl, "bundle");
                } else {
                  bundleUrlInfo.data.generatedToShareCode = true;
                }
              } else {
                associateBuildUrlAndRawUrl(buildUrl, url, "bundle");
              }
              bundleUrlInfos[buildUrl] = bundleUrlInfo;
              if (buildUrl.includes("?")) {
                bundleUrlInfos[asUrlWithoutSearch(buildUrl)] = bundleUrlInfo;
              }
              if (bundlerGeneratedUrlInfo.data.bundleRelativeUrl) {
                const urlForBundler = new URL(bundlerGeneratedUrlInfo.data.bundleRelativeUrl, buildDirectoryUrl).href;
                if (urlForBundler !== buildUrl) {
                  bundleInternalRedirections.set(urlForBundler, buildUrl);
                }
              }
            });
          } catch (e) {
            bundleTask.fail();
            throw e;
          }
          bundleTask.done();
        }, Promise.resolve());
      }
      {
        const generateBuildGraph = createTaskLog("generate build graph", {
          disabled: logger.levels.debug || !logger.levels.info
        });
        try {
          if (outDirectoryUrl) {
            await ensureEmptyDirectory(new URL(`postbuild/`, outDirectoryUrl));
          }
          const finalUrlGraphLoader = createUrlGraphLoader(finalGraphKitchen.kitchenContext);
          entryUrls.forEach(entryUrl => {
            const [finalEntryReference, finalEntryUrlInfo] = finalGraphKitchen.kitchenContext.prepareEntryPoint({
              trace: {
                message: `entryPoint`
              },
              parentUrl: sourceDirectoryUrl,
              type: "entry_point",
              specifier: entryUrl
            });
            finalEntryUrls.push(finalEntryUrlInfo.url);
            finalUrlGraphLoader.load(finalEntryUrlInfo, {
              reference: finalEntryReference
            });
          });
          await finalUrlGraphLoader.getAllLoadDonePromise(buildOperation);
        } catch (e) {
          generateBuildGraph.fail();
          throw e;
        }
        generateBuildGraph.done();
      }
    }
    const versionMap = new Map();
    const versionedUrlMap = new Map();
    {
      inject_version_in_urls: {
        if (!versioning) {
          break inject_version_in_urls;
        }
        const versioningTask = createTaskLog("inject version in urls", {
          disabled: logger.levels.debug || !logger.levels.info
        });
        try {
          const canUseImportmap = versioningViaImportmap && finalEntryUrls.every(finalEntryUrl => {
            const finalEntryUrlInfo = finalGraph.getUrlInfo(finalEntryUrl);
            return finalEntryUrlInfo.type === "html";
          }) && finalGraphKitchen.kitchenContext.isSupportedOnCurrentClients("importmap");
          const workerReferenceSet = new Set();
          const isReferencedByWorker = (reference, graph) => {
            if (workerReferenceSet.has(reference)) {
              return true;
            }
            const urlInfo = graph.getUrlInfo(reference.url);
            const dependentWorker = graph.findDependent(urlInfo, dependentUrlInfo => {
              return isWebWorkerUrlInfo(dependentUrlInfo);
            });
            if (dependentWorker) {
              workerReferenceSet.add(reference);
              return true;
            }
            return Boolean(dependentWorker);
          };
          const preferWithoutVersioning = reference => {
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl);
            if (parentUrlInfo.jsQuote) {
              return {
                type: "global",
                source: `${parentUrlInfo.jsQuote}+__v__(${JSON.stringify(reference.specifier)})+${parentUrlInfo.jsQuote}`
              };
            }
            if (reference.type === "js_url") {
              return {
                type: "global",
                source: `__v__(${JSON.stringify(reference.specifier)})`
              };
            }
            if (reference.type === "js_import") {
              if (reference.subtype === "import_dynamic") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`
                };
              }
              if (reference.subtype === "import_meta_resolve") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`
                };
              }
              if (canUseImportmap && !isReferencedByWorker(reference, finalGraph)) {
                return {
                  type: "importmap",
                  source: JSON.stringify(reference.specifier)
                };
              }
            }
            return null;
          };

          // see also https://github.com/rollup/rollup/pull/4543
          const contentVersionMap = new Map();
          const hashCallbacks = [];
          GRAPH.forEach(finalGraph, urlInfo => {
            if (urlInfo.url.startsWith("data:")) {
              return;
            }
            if (urlInfo.type === "sourcemap") {
              return;
            }
            // ignore:
            // - inline files:
            //   they are already taken into account in the file where they appear
            // - ignored files:
            //   we don't know their content
            // - unused files without reference
            //   File updated such as style.css -> style.css.js or file.js->file.nomodule.js
            //   Are used at some point just to be discarded later because they need to be converted
            //   There is no need to version them and we could not because the file have been ignored
            //   so their content is unknown
            if (urlInfo.isInline) {
              return;
            }
            if (!urlInfo.shouldHandle) {
              return;
            }
            if (urlInfo.dependents.size === 0 && !urlInfo.isEntryPoint) {
              return;
            }
            const urlContent = urlInfo.type === "html" ? stringifyHtmlAst(parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false
            }), {
              cleanupJsenvAttributes: true
            }) : urlInfo.content;
            const contentVersionGenerator = createVersionGenerator();
            contentVersionGenerator.augmentWithContent(urlContent);
            const contentVersion = contentVersionGenerator.generate();
            contentVersionMap.set(urlInfo.url, contentVersion);
            const versionMutations = [];
            const seen = new Set();
            const visitReferences = urlInfo => {
              urlInfo.references.forEach(reference => {
                if (seen.has(reference)) return;
                seen.add(reference);
                const referencedUrlInfo = finalGraph.getUrlInfo(reference.url);
                versionMutations.push(() => {
                  const dependencyContentVersion = contentVersionMap.get(reference.url);
                  if (!dependencyContentVersion) {
                    // no content generated for this dependency
                    // (inline, data:, sourcemap, shouldHandle is false, ...)
                    return null;
                  }
                  if (preferWithoutVersioning(reference)) {
                    // when versioning is dynamic no need to take into account
                    // happens for:
                    // - specifier mapped by window.__v__()
                    // - specifier mapped by importmap
                    return null;
                  }
                  return dependencyContentVersion;
                });
                visitReferences(referencedUrlInfo);
              });
            };
            visitReferences(urlInfo);
            hashCallbacks.push(() => {
              let version;
              if (versionMutations.length === 0) {
                version = contentVersion;
              } else {
                const versionGenerator = createVersionGenerator();
                versionGenerator.augment(contentVersion);
                versionMutations.forEach(versionMutation => {
                  const value = versionMutation();
                  if (value) {
                    versionGenerator.augment(value);
                  }
                });
                version = versionGenerator.generate();
              }
              versionMap.set(urlInfo.url, version);
              const buildUrlObject = new URL(urlInfo.url);
              // remove ?js_module_fallback
              // this information is already hold into ".nomodule"
              buildUrlObject.searchParams.delete("js_module_fallback");
              buildUrlObject.searchParams.delete("as_js_classic");
              buildUrlObject.searchParams.delete("as_js_module");
              buildUrlObject.searchParams.delete("as_json_module");
              buildUrlObject.searchParams.delete("as_css_module");
              buildUrlObject.searchParams.delete("as_text_module");
              const buildUrl = buildUrlObject.href;
              finalRedirections.set(urlInfo.url, buildUrl);
              versionedUrlMap.set(urlInfo.url, normalizeUrl(injectVersionIntoBuildUrl({
                buildUrl,
                version,
                versioningMethod
              })));
            });
          });
          hashCallbacks.forEach(callback => {
            callback();
          });
          const versionMappings = {};
          const versionMappingsOnGlobalMap = new Set();
          const versionMappingsOnImportmap = new Set();
          const versioningKitchen = createKitchen({
            logLevel: logger.level,
            rootDirectoryUrl: buildDirectoryUrl,
            urlGraph: finalGraph,
            build: true,
            runtimeCompat,
            ...contextSharedDuringBuild,
            plugins: [urlAnalysisPlugin, jsenvPluginInlineContentAnalysis({
              fetchInlineUrls: false,
              analyzeConvertedScripts: true,
              // to be able to version their urls
              allowEscapeForVersioning: true
            }), {
              name: "jsenv:versioning",
              appliesDuring: "build",
              resolveUrl: reference => {
                const buildUrl = buildUrls.get(reference.specifier);
                if (buildUrl) {
                  return buildUrl;
                }
                const urlObject = new URL(reference.specifier, reference.baseUrl || reference.parentUrl);
                const url = urlObject.href;
                // during versioning we revisit the deps
                // but the code used to enforce trailing slash on directories
                // is not applied because "jsenv:file_url_resolution" is not used
                // so here we search if the url with a trailing slash exists
                if (reference.type === "filesystem" && !urlObject.pathname.endsWith("/")) {
                  const urlWithTrailingSlash = `${url}/`;
                  const specifier = findKey(buildUrls, urlWithTrailingSlash);
                  if (specifier) {
                    return urlWithTrailingSlash;
                  }
                }
                return url;
              },
              formatUrl: reference => {
                if (!reference.shouldHandle) {
                  if (reference.generatedUrl.startsWith("ignore:")) {
                    return reference.generatedUrl.slice("ignore:".length);
                  }
                  return null;
                }
                if (reference.isInline || reference.url.startsWith("data:")) {
                  return null;
                }
                if (reference.isResourceHint) {
                  return null;
                }
                // specifier comes from "normalize" hook done a bit earlier in this file
                // we want to get back their build url to access their infos
                const referencedUrlInfo = finalGraph.getUrlInfo(reference.url);
                if (!canUseVersionedUrl(referencedUrlInfo)) {
                  return reference.specifier;
                }
                if (!referencedUrlInfo.shouldHandle) {
                  return null;
                }
                const versionedUrl = versionedUrlMap.get(reference.url);
                if (!versionedUrl) {
                  // happens for sourcemap
                  return urlToRelativeUrl(referencedUrlInfo.url, reference.parentUrl);
                }
                const versionedSpecifier = asFormattedBuildUrl(versionedUrl, reference);
                versionMappings[reference.specifier] = versionedSpecifier;
                versioningRedirections.set(reference.url, versionedUrl);
                buildUrls.set(versionedSpecifier, versionedUrl);
                const withoutVersioning = preferWithoutVersioning(reference);
                if (withoutVersioning) {
                  if (withoutVersioning.type === "importmap") {
                    versionMappingsOnImportmap.add(reference.specifier);
                  } else {
                    versionMappingsOnGlobalMap.add(reference.specifier);
                  }
                  return () => withoutVersioning.source;
                }
                return versionedSpecifier;
              },
              fetchUrlContent: versionedUrlInfo => {
                if (versionedUrlInfo.isInline) {
                  const rawUrlInfo = rawGraph.getUrlInfo(buildDirectoryRedirections.get(versionedUrlInfo.url));
                  const finalUrlInfo = finalGraph.getUrlInfo(versionedUrlInfo.url);
                  return {
                    content: versionedUrlInfo.content,
                    contentType: versionedUrlInfo.contentType,
                    originalContent: rawUrlInfo ? rawUrlInfo.originalContent : undefined,
                    sourcemap: finalUrlInfo ? finalUrlInfo.sourcemap : undefined
                  };
                }
                return versionedUrlInfo;
              }
            }],
            sourcemaps,
            sourcemapsSourcesContent,
            sourcemapsSourcesRelative: true,
            outDirectoryUrl: outDirectoryUrl ? new URL("postbuild/", outDirectoryUrl) : undefined
          });
          const versioningUrlGraphLoader = createUrlGraphLoader(versioningKitchen.kitchenContext);
          finalEntryUrls.forEach(finalEntryUrl => {
            const [finalEntryReference, finalEntryUrlInfo] = finalGraphKitchen.kitchenContext.prepareEntryPoint({
              trace: {
                message: `entryPoint`
              },
              parentUrl: buildDirectoryUrl,
              type: "entry_point",
              specifier: finalEntryUrl
            });
            versioningUrlGraphLoader.load(finalEntryUrlInfo, {
              reference: finalEntryReference
            });
          });
          await versioningUrlGraphLoader.getAllLoadDonePromise(buildOperation);
          workerReferenceSet.clear();
          const actions = [];
          const visitors = [];
          if (versionMappingsOnImportmap.size) {
            const versionMappingsNeeded = {};
            versionMappingsOnImportmap.forEach(specifier => {
              versionMappingsNeeded[specifier] = versionMappings[specifier];
            });
            visitors.push(urlInfo => {
              if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsImportmap({
                    urlInfo,
                    kitchen: finalGraphKitchen,
                    versionMappings: versionMappingsNeeded
                  });
                });
              }
            });
          }
          if (versionMappingsOnGlobalMap.size) {
            const versionMappingsNeeded = {};
            versionMappingsOnGlobalMap.forEach(specifier => {
              versionMappingsNeeded[specifier] = versionMappings[specifier];
            });
            visitors.push(urlInfo => {
              if (urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsGlobal({
                    urlInfo,
                    kitchen: finalGraphKitchen,
                    versionMappings: versionMappingsNeeded
                  });
                });
              }
            });
          }
          if (visitors.length) {
            GRAPH.forEach(finalGraph, urlInfo => {
              visitors.forEach(visitor => visitor(urlInfo));
            });
            if (actions.length) {
              await Promise.all(actions.map(action => action()));
            }
          }
        } catch (e) {
          versioningTask.fail();
          throw e;
        }
        versioningTask.done();
      }
      {
        GRAPH.forEach(finalGraph, urlInfo => {
          if (!urlInfo.shouldHandle) {
            return;
          }
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          if (urlInfo.type === "html") {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false
            });
            urlInfo.content = stringifyHtmlAst(htmlAst, {
              cleanupJsenvAttributes: true
            });
          }
        });
      }
      /*
       * Update <link rel="preload"> and friends after build (once we know everything)
       * - Used to remove resource hint targeting an url that is no longer used:
       *   - because of bundlings
       *   - because of import assertions transpilation (file is inlined into JS)
       */
      {
        const actions = [];
        GRAPH.forEach(finalGraph, urlInfo => {
          if (urlInfo.type !== "html") {
            return;
          }
          actions.push(async () => {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false
            });
            const mutations = [];
            const hintsToInject = {};
            visitHtmlNodes(htmlAst, {
              link: node => {
                const href = getHtmlNodeAttribute(node, "href");
                if (href === undefined || href.startsWith("data:")) {
                  return;
                }
                const rel = getHtmlNodeAttribute(node, "rel");
                const isResourceHint = ["preconnect", "dns-prefetch", "prefetch", "preload", "modulepreload"].includes(rel);
                if (!isResourceHint) {
                  return;
                }
                const onBuildUrl = buildUrl => {
                  const buildUrlInfo = buildUrl ? finalGraph.getUrlInfo(buildUrl) : null;
                  if (!buildUrlInfo) {
                    logger.warn(`remove resource hint because cannot find "${href}" in the graph`);
                    mutations.push(() => {
                      removeHtmlNode(node);
                    });
                    return;
                  }
                  if (buildUrlInfo.dependents.size === 0) {
                    logger.warn(`remove resource hint because "${href}" not used anymore`);
                    mutations.push(() => {
                      removeHtmlNode(node);
                    });
                    return;
                  }
                  const buildUrlFormatted = versioningRedirections.get(buildUrlInfo.url) || buildUrlInfo.url;
                  const buildSpecifierBeforeRedirect = findKey(buildUrls, buildUrlFormatted);
                  mutations.push(() => {
                    setHtmlNodeAttributes(node, {
                      href: buildSpecifierBeforeRedirect,
                      ...(buildUrlInfo.type === "js_classic" ? {
                        crossorigin: undefined
                      } : {})
                    });
                  });
                  for (const dependencyUrl of buildUrlInfo.dependencies) {
                    const dependencyUrlInfo = finalGraph.urlInfoMap.get(dependencyUrl);
                    if (dependencyUrlInfo.data.generatedToShareCode) {
                      hintsToInject[dependencyUrl] = node;
                    }
                  }
                };
                if (href.startsWith("file:")) {
                  let url = href;
                  url = rawRedirections.get(url) || url;
                  const rawUrlInfo = rawGraph.getUrlInfo(url);
                  if (rawUrlInfo && rawUrlInfo.data.bundled) {
                    logger.warn(`remove resource hint on "${href}" because it was bundled`);
                    mutations.push(() => {
                      removeHtmlNode(node);
                    });
                  } else {
                    url = bundleRedirections.get(url) || url;
                    url = bundleInternalRedirections.get(url) || url;
                    url = finalRedirections.get(url) || url;
                    url = findKey(buildDirectoryRedirections, url) || url;
                    onBuildUrl(url);
                  }
                } else {
                  onBuildUrl(null);
                }
              }
            });
            Object.keys(hintsToInject).forEach(urlToHint => {
              const hintNode = hintsToInject[urlToHint];
              const urlFormatted = versioningRedirections.get(urlToHint) || urlToHint;
              const specifierBeforeRedirect = findKey(buildUrls, urlFormatted);
              const found = findHtmlNode(htmlAst, htmlNode => {
                return htmlNode.nodeName === "link" && getHtmlNodeAttribute(htmlNode, "href") === specifierBeforeRedirect;
              });
              if (!found) {
                mutations.push(() => {
                  const nodeToInsert = createHtmlNode({
                    tagName: "link",
                    href: specifierBeforeRedirect,
                    rel: getHtmlNodeAttribute(hintNode, "rel"),
                    as: getHtmlNodeAttribute(hintNode, "as"),
                    type: getHtmlNodeAttribute(hintNode, "type"),
                    crossorigin: getHtmlNodeAttribute(hintNode, "crossorigin")
                  });
                  insertHtmlNodeAfter(nodeToInsert, hintNode);
                });
              }
            });
            if (mutations.length > 0) {
              mutations.forEach(mutation => mutation());
              await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
                content: stringifyHtmlAst(htmlAst)
              });
            }
          });
        });
        await Promise.all(actions.map(resourceHintAction => resourceHintAction()));
        buildOperation.throwIfAborted();
      }
      {
        const actions = [];
        GRAPH.forEach(finalGraph, urlInfo => {
          if (!isUsed(urlInfo)) {
            actions.push(() => {
              finalGraph.deleteUrlInfo(urlInfo.url);
            });
          }
        });
        actions.forEach(action => action());
      }
      {
        const serviceWorkerEntryUrlInfos = GRAPH.filter(finalGraph, finalUrlInfo => {
          return finalUrlInfo.subtype === "service_worker" && finalUrlInfo.isEntryPoint;
        });
        if (serviceWorkerEntryUrlInfos.length > 0) {
          const serviceWorkerResources = {};
          GRAPH.forEach(finalGraph, urlInfo => {
            if (urlInfo.isInline || !urlInfo.shouldHandle) {
              return;
            }
            if (!urlInfo.url.startsWith("file:")) {
              return;
            }
            if (!canUseVersionedUrl(urlInfo)) {
              // when url is not versioned we compute a "version" for that url anyway
              // so that service worker source still changes and navigator
              // detect there is a change
              const specifier = findKey(buildUrls, urlInfo.url);
              serviceWorkerResources[specifier] = {
                version: versionMap.get(urlInfo.url)
              };
              return;
            }
            const specifier = findKey(buildUrls, urlInfo.url);
            const versionedUrl = versionedUrlMap.get(urlInfo.url);
            const versionedSpecifier = findKey(buildUrls, versionedUrl);
            serviceWorkerResources[specifier] = {
              version: versionMap.get(urlInfo.url),
              versionedUrl: versionedSpecifier
            };
          });
          serviceWorkerEntryUrlInfos.forEach(serviceWorkerEntryUrlInfo => {
            const magicSource = createMagicSource(serviceWorkerEntryUrlInfo.content);
            const serviceWorkerResourcesWithoutSwScriptItSelf = {
              ...serviceWorkerResources
            };
            const serviceWorkerSpecifier = findKey(buildUrls, serviceWorkerEntryUrlInfo.url);
            delete serviceWorkerResourcesWithoutSwScriptItSelf[serviceWorkerSpecifier];
            magicSource.prepend(`\nself.resourcesFromJsenvBuild = ${JSON.stringify(serviceWorkerResourcesWithoutSwScriptItSelf, null, "  ")};\n`);
            const {
              content,
              sourcemap
            } = magicSource.toContentAndSourcemap();
            finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(serviceWorkerEntryUrlInfo, {
              content,
              sourcemap
            });
          });
        }
        buildOperation.throwIfAborted();
      }
    }
    const buildManifest = {};
    const buildContents = {};
    const buildInlineRelativeUrls = [];
    const getBuildRelativeUrl = url => {
      const urlObject = new URL(url);
      urlObject.searchParams.delete("js_module_fallback");
      urlObject.searchParams.delete("as_css_module");
      urlObject.searchParams.delete("as_json_module");
      urlObject.searchParams.delete("as_text_module");
      url = urlObject.href;
      const buildRelativeUrl = urlToRelativeUrl(url, buildDirectoryUrl);
      return buildRelativeUrl;
    };
    GRAPH.forEach(finalGraph, urlInfo => {
      if (!urlInfo.shouldHandle) {
        return;
      }
      if (!urlInfo.url.startsWith("file:")) {
        return;
      }
      if (urlInfo.type === "directory") {
        return;
      }
      if (urlInfo.isInline) {
        const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
        buildContents[buildRelativeUrl] = urlInfo.content;
        buildInlineRelativeUrls.push(buildRelativeUrl);
      } else {
        const versionedUrl = versionedUrlMap.get(urlInfo.url);
        if (versionedUrl && canUseVersionedUrl(urlInfo)) {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
          const versionedBuildRelativeUrl = getBuildRelativeUrl(versionedUrl);
          if (versioningMethod === "search_param") {
            buildContents[buildRelativeUrl] = urlInfo.content;
          } else {
            buildContents[versionedBuildRelativeUrl] = urlInfo.content;
          }
          buildManifest[buildRelativeUrl] = versionedBuildRelativeUrl;
        } else {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
          buildContents[buildRelativeUrl] = urlInfo.content;
        }
      }
    });
    const buildFileContents = {};
    const buildInlineContents = {};
    Object.keys(buildContents).sort((a, b) => comparePathnames(a, b)).forEach(buildRelativeUrl => {
      if (buildInlineRelativeUrls.includes(buildRelativeUrl)) {
        buildInlineContents[buildRelativeUrl] = buildContents[buildRelativeUrl];
      } else {
        buildFileContents[buildRelativeUrl] = buildContents[buildRelativeUrl];
      }
    });
    if (writeOnFileSystem) {
      if (directoryToClean) {
        await ensureEmptyDirectory(directoryToClean);
      }
      const buildRelativeUrls = Object.keys(buildFileContents);
      buildRelativeUrls.forEach(buildRelativeUrl => {
        writeFileSync(new URL(buildRelativeUrl, buildDirectoryUrl), buildFileContents[buildRelativeUrl]);
      });
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        writeFileSync(new URL(assetManifestFileRelativeUrl, buildDirectoryUrl), JSON.stringify(buildManifest, null, "  "));
      }
    }
    logger.info(createUrlGraphSummary(finalGraph, {
      title: "build files"
    }));
    return {
      buildFileContents,
      buildInlineContents,
      buildManifest
    };
  };
  if (!watch) {
    return runBuild({
      signal: operation.signal,
      logLevel
    });
  }
  let resolveFirstBuild;
  let rejectFirstBuild;
  const firstBuildPromise = new Promise((resolve, reject) => {
    resolveFirstBuild = resolve;
    rejectFirstBuild = reject;
  });
  let buildAbortController;
  let watchFilesTask;
  const startBuild = async () => {
    const buildTask = createTaskLog("build");
    buildAbortController = new AbortController();
    try {
      const result = await runBuild({
        signal: buildAbortController.signal,
        logLevel: "warn"
      });
      buildTask.done();
      resolveFirstBuild(result);
      watchFilesTask = createTaskLog("watch files");
    } catch (e) {
      if (Abort.isAbortError(e)) {
        buildTask.fail(`build aborted`);
      } else if (e.code === "PARSE_ERROR") {
        buildTask.fail();
        console.error(e.stack);
        watchFilesTask = createTaskLog("watch files");
      } else {
        buildTask.fail();
        rejectFirstBuild(e);
        throw e;
      }
    }
  };
  startBuild();
  let startTimeout;
  const stopWatchingSourceFiles = watchSourceFiles(sourceDirectoryUrl, ({
    url,
    event
  }) => {
    if (watchFilesTask) {
      watchFilesTask.happen(`${url.slice(sourceDirectoryUrl.length)} ${event}`);
      watchFilesTask = null;
    }
    buildAbortController.abort();
    // setTimeout is to ensure the abortController.abort() above
    // is properly taken into account so that logs about abort comes first
    // then logs about re-running the build happens
    clearTimeout(startTimeout);
    startTimeout = setTimeout(startBuild, 20);
  }, {
    sourceFilesConfig,
    keepProcessAlive: true,
    cooldownBetweenFileEvents
  });
  operation.addAbortCallback(() => {
    stopWatchingSourceFiles();
  });
  await firstBuildPromise;
  return stopWatchingSourceFiles;
};
const findKey = (map, value) => {
  for (const [keyCandidate, valueCandidate] of map) {
    if (valueCandidate === value) {
      return keyCandidate;
    }
  }
  return undefined;
};
const injectVersionIntoBuildUrl = ({
  buildUrl,
  version,
  versioningMethod
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParams(buildUrl, {
      v: version
    });
  }
  const basename = urlToBasename(buildUrl);
  const extension = urlToExtension$1(buildUrl);
  const versionedFilename = `${basename}-${version}${extension}`;
  const versionedUrl = setUrlFilename(buildUrl, versionedFilename);
  return versionedUrl;
};
const isUsed = urlInfo => {
  // nothing uses this url anymore
  // - versioning update inline content
  // - file converted for import assertion or js_classic conversion
  if (urlInfo.isEntryPoint) {
    return true;
  }
  if (urlInfo.type === "sourcemap") {
    return true;
  }
  if (urlInfo.injected) {
    return true;
  }
  return urlInfo.dependents.size > 0;
};
const canUseVersionedUrl = urlInfo => {
  if (urlInfo.isEntryPoint) {
    return false;
  }
  return urlInfo.type !== "webmanifest";
};

const WEB_URL_CONVERTER = {
  asWebUrl: (fileUrl, webServer) => {
    if (urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      return moveUrl({
        url: fileUrl,
        from: webServer.rootDirectoryUrl,
        to: `${webServer.origin}/`
      });
    }
    const fsRootUrl = ensureWindowsDriveLetter("file:///", fileUrl);
    return `${webServer.origin}/@fs/${fileUrl.slice(fsRootUrl.length)}`;
  },
  asFileUrl: (webUrl, webServer) => {
    const {
      pathname,
      search
    } = new URL(webUrl);
    if (pathname.startsWith("/@fs/")) {
      const fsRootRelativeUrl = pathname.slice("/@fs/".length);
      return `file:///${fsRootRelativeUrl}${search}`;
    }
    return moveUrl({
      url: webUrl,
      from: `${webServer.origin}/`,
      to: webServer.rootDirectoryUrl
    });
  }
};

/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */
const serverEventsClientFileUrl = new URL("./js/server_events_client.js", import.meta.url).href;
const jsenvPluginServerEventsClientInjection = () => {
  return {
    name: "jsenv:server_events_client_injection",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const [serverEventsClientFileReference] = context.referenceUtils.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: serverEventsClientFileUrl
        });
        injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
          tagName: "script",
          type: "module",
          src: serverEventsClientFileReference.generatedSpecifier
        }), "jsenv:server_events");
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

const parseUserAgentHeader = memoizeByFirstArgument(userAgent => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1)
    };
  }
  const UA = requireFromJsenv("@financial-times/polyfill-useragent-normaliser");
  const {
    ua
  } = new UA(userAgent);
  const {
    family,
    major,
    minor,
    patch
  } = ua;
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion: family === "Other" ? "unknown" : `${major}.${minor}${patch}`
  };
});

const createFileService = ({
  signal,
  logLevel,
  serverStopCallbacks,
  serverEventsDispatcher,
  contextCache,
  sourceDirectoryUrl,
  sourceMainFilePath,
  sourceFilesConfig,
  runtimeCompat,
  plugins,
  urlAnalysis,
  urlResolution,
  fileSystemMagicRedirection,
  supervisor,
  transpilation,
  clientAutoreload,
  cooldownBetweenFileEvents,
  cacheControl,
  ribbon,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  outDirectoryUrl
}) => {
  const clientFileChangeCallbackList = [];
  const clientFilesPruneCallbackList = [];
  const stopWatchingSourceFiles = watchSourceFiles(sourceDirectoryUrl, fileInfo => {
    clientFileChangeCallbackList.forEach(callback => {
      callback(fileInfo);
    });
  }, {
    sourceFilesConfig,
    keepProcessAlive: false,
    cooldownBetweenFileEvents
  });
  serverStopCallbacks.push(stopWatchingSourceFiles);
  const getOrCreateContext = request => {
    const {
      runtimeName,
      runtimeVersion
    } = parseUserAgentHeader(request.headers["user-agent"] || "");
    const runtimeId = `${runtimeName}@${runtimeVersion}`;
    const existingContext = contextCache.get(runtimeId);
    if (existingContext) {
      return existingContext;
    }
    const watchAssociations = URL_META.resolveAssociations({
      watch: stopWatchingSourceFiles.watchPatterns
    }, sourceDirectoryUrl);
    const urlGraph = createUrlGraph({
      name: runtimeId
    });
    clientFileChangeCallbackList.push(({
      url
    }) => {
      const onUrlInfo = urlInfo => {
        urlGraph.considerModified(urlInfo);
      };
      const exactUrlInfo = urlGraph.getUrlInfo(url);
      if (exactUrlInfo) {
        onUrlInfo(exactUrlInfo);
      }
      urlGraph.urlInfoMap.forEach(urlInfo => {
        if (urlInfo === exactUrlInfo) return;
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== url) return;
        if (exactUrlInfo && exactUrlInfo.dependents.has(urlInfo.url)) return;
        onUrlInfo(urlInfo);
      });
    });
    const clientRuntimeCompat = {
      [runtimeName]: runtimeVersion
    };
    const kitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      mainFilePath: sourceMainFilePath,
      urlGraph,
      dev: true,
      runtimeCompat,
      clientRuntimeCompat,
      systemJsTranspilation: !RUNTIME_COMPAT.isSupported(clientRuntimeCompat, "script_type_module") || !RUNTIME_COMPAT.isSupported(clientRuntimeCompat, "import_dynamic") || !RUNTIME_COMPAT.isSupported(clientRuntimeCompat, "import_meta"),
      plugins: [...plugins, ...getCorePlugins({
        rootDirectoryUrl: sourceDirectoryUrl,
        runtimeCompat,
        urlAnalysis,
        urlResolution,
        fileSystemMagicRedirection,
        supervisor,
        transpilation,
        clientAutoreload,
        clientFileChangeCallbackList,
        clientFilesPruneCallbackList,
        cacheControl,
        ribbon
      })],
      supervisor,
      minification: false,
      sourcemaps,
      sourcemapsSourcesProtocol,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl ? new URL(`${runtimeName}@${runtimeVersion}/`, outDirectoryUrl) : undefined
    });
    urlGraph.createUrlInfoCallbackRef.current = urlInfo => {
      const {
        watch
      } = URL_META.applyAssociations({
        url: urlInfo.url,
        associations: watchAssociations
      });
      urlInfo.isWatched = watch;
      // si une urlInfo dépends de pleins d'autres alors
      // on voudrait check chacune de ces url infos (package.json dans mon cas)
      urlInfo.isValid = () => {
        if (!urlInfo.url.startsWith("file:")) {
          return false;
        }
        if (watch && urlInfo.contentEtag === undefined) {
          // we trust the watching mecanism
          // doing urlInfo.contentEtag = undefined
          // when file is modified
          return false;
        }
        if (!watch && urlInfo.contentEtag) {
          // file is not watched, check the filesystem
          let fileContentAsBuffer;
          try {
            fileContentAsBuffer = readFileSync$1(new URL(urlInfo.url));
          } catch (e) {
            if (e.code === "ENOENT") {
              // we should consider calling urlGraph.deleteUrlInfo(urlInfo)
              urlInfo.originalContentEtag = undefined;
              urlInfo.contentEtag = undefined;
              return false;
            }
            return false;
          }
          const fileContentEtag = bufferToEtag$1(fileContentAsBuffer);
          if (fileContentEtag !== urlInfo.originalContentEtag) {
            // we should consider calling urlGraph.considerModified(urlInfo)
            urlInfo.originalContentEtag = undefined;
            urlInfo.contentEtag = undefined;
            return false;
          }
        }
        for (const implicitUrl of urlInfo.implicitUrls) {
          const implicitUrlInfo = context.urlGraph.getUrlInfo(implicitUrl);
          if (implicitUrlInfo && !implicitUrlInfo.isValid()) {
            return false;
          }
        }
        return true;
      };
    };
    urlGraph.prunedUrlInfosCallbackRef.current = (urlInfos, firstUrlInfo) => {
      clientFilesPruneCallbackList.forEach(callback => {
        callback(urlInfos, firstUrlInfo);
      });
    };
    serverStopCallbacks.push(() => {
      kitchen.pluginController.callHooks("destroy", kitchen.kitchenContext);
    });
    {
      const allServerEvents = {};
      kitchen.pluginController.plugins.forEach(plugin => {
        const {
          serverEvents
        } = plugin;
        if (serverEvents) {
          Object.keys(serverEvents).forEach(serverEventName => {
            // we could throw on serverEvent name conflict
            // we could throw if serverEvents[serverEventName] is not a function
            allServerEvents[serverEventName] = serverEvents[serverEventName];
          });
        }
      });
      const serverEventNames = Object.keys(allServerEvents);
      if (serverEventNames.length > 0) {
        Object.keys(allServerEvents).forEach(serverEventName => {
          allServerEvents[serverEventName]({
            rootDirectoryUrl: sourceDirectoryUrl,
            urlGraph,
            dev: true,
            sendServerEvent: data => {
              serverEventsDispatcher.dispatch({
                type: serverEventName,
                data
              });
            }
          });
        });
        // "pushPlugin" so that event source client connection can be put as early as possible in html
        kitchen.pluginController.pushPlugin(jsenvPluginServerEventsClientInjection());
      }
    }
    const context = {
      rootDirectoryUrl: sourceDirectoryUrl,
      dev: true,
      runtimeName,
      runtimeVersion,
      urlGraph,
      kitchen
    };
    contextCache.set(runtimeId, context);
    return context;
  };
  return async request => {
    const {
      urlGraph,
      kitchen
    } = getOrCreateContext(request);
    const responseFromPlugin = await kitchen.pluginController.callAsyncHooksUntil("serve", request, kitchen.kitchenContext);
    if (responseFromPlugin) {
      return responseFromPlugin;
    }
    let reference;
    const parentUrl = inferParentFromRequest(request, sourceDirectoryUrl);
    if (parentUrl) {
      reference = urlGraph.inferReference(request.resource, parentUrl);
    }
    if (!reference) {
      const entryPoint = kitchen.injectReference({
        trace: {
          message: parentUrl || sourceDirectoryUrl
        },
        parentUrl: parentUrl || sourceDirectoryUrl,
        type: "http_request",
        specifier: request.resource
      });
      reference = entryPoint[0];
    }
    const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url);
    const ifNoneMatch = request.headers["if-none-match"];
    const urlInfoTargetedByCache = urlGraph.getParentIfInline(urlInfo);
    try {
      if (ifNoneMatch) {
        const [clientOriginalContentEtag, clientContentEtag] = ifNoneMatch.split("_");
        if (urlInfoTargetedByCache.originalContentEtag === clientOriginalContentEtag && urlInfoTargetedByCache.contentEtag === clientContentEtag && urlInfoTargetedByCache.isValid()) {
          const headers = {
            "cache-control": `private,max-age=0,must-revalidate`
          };
          Object.keys(urlInfo.headers).forEach(key => {
            if (key !== "content-length") {
              headers[key] = urlInfo.headers[key];
            }
          });
          return {
            status: 304,
            headers
          };
        }
      }

      // urlInfo objects are reused, they must be "reset" before cooking them again
      if ((urlInfo.error || urlInfo.contentEtag) && !urlInfo.isInline && urlInfo.type !== "sourcemap") {
        urlInfo.error = null;
        urlInfo.sourcemap = null;
        urlInfo.sourcemapIsWrong = null;
        urlInfo.sourcemapReference = null;
        urlInfo.content = null;
        urlInfo.originalContent = null;
        urlInfo.type = null;
        urlInfo.subtype = null;
        urlInfo.timing = {};
      }
      await kitchen.cook(urlInfo, {
        request,
        reference
      });
      let {
        response
      } = urlInfo;
      if (response) {
        return response;
      }
      response = {
        url: reference.url,
        status: 200,
        headers: {
          // when we send eTag to the client the next request to the server
          // will send etag in request headers.
          // If they match jsenv bypass cooking and returns 304
          // This must not happen when a plugin uses "no-store" or "no-cache" as it means
          // plugin logic wants to happens for every request to this url
          ...(urlInfo.headers["cache-control"] === "no-store" || urlInfo.headers["cache-control"] === "no-cache" ? {} : {
            "cache-control": `private,max-age=0,must-revalidate`,
            // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
            "eTag": `${urlInfoTargetedByCache.originalContentEtag}_${urlInfoTargetedByCache.contentEtag}`
          }),
          ...urlInfo.headers,
          "content-type": urlInfo.contentType,
          "content-length": Buffer.byteLength(urlInfo.content)
        },
        body: urlInfo.content,
        timing: urlInfo.timing
      };
      kitchen.pluginController.callHooks("augmentResponse", {
        reference,
        urlInfo
      }, kitchen.kitchenContext, returnValue => {
        response = composeTwoResponses(response, returnValue);
      });
      return response;
    } catch (e) {
      urlInfo.error = e;
      const originalError = e ? e.cause || e : e;
      if (originalError.asResponse) {
        return originalError.asResponse();
      }
      const code = originalError.code;
      if (code === "PARSE_ERROR") {
        // when possible let browser re-throw the syntax error
        // it's not possible to do that when url info content is not available
        // (happens for js_module_fallback for instance)
        if (urlInfo.content !== undefined) {
          return {
            url: reference.url,
            status: 200,
            // reason becomes the http response statusText, it must not contain invalid chars
            // https://github.com/nodejs/node/blob/0c27ca4bc9782d658afeaebcec85ec7b28f1cc35/lib/_http_common.js#L221
            statusText: e.reason,
            statusMessage: originalError.message,
            headers: {
              "content-type": urlInfo.contentType,
              "content-length": Buffer.byteLength(urlInfo.content),
              "cache-control": "no-store"
            },
            body: urlInfo.content
          };
        }
        return {
          url: reference.url,
          status: 500,
          statusText: e.reason,
          statusMessage: originalError.message,
          headers: {
            "cache-control": "no-store"
          },
          body: urlInfo.content
        };
      }
      if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html"
          },
          canReadDirectory: true,
          rootDirectoryUrl: sourceDirectoryUrl
        });
      }
      if (code === "NOT_ALLOWED") {
        return {
          url: reference.url,
          status: 403,
          statusText: originalError.reason
        };
      }
      if (code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: originalError.reason,
          statusMessage: originalError.message
        };
      }
      return {
        url: reference.url,
        status: 500,
        statusText: e.reason,
        statusMessage: e.stack
      };
    }
  };
};
const inferParentFromRequest = (request, sourceDirectoryUrl) => {
  const {
    referer
  } = request.headers;
  if (!referer) {
    return null;
  }
  const refererUrlObject = new URL(referer);
  refererUrlObject.searchParams.delete("hmr");
  refererUrlObject.searchParams.delete("v");
  return WEB_URL_CONVERTER.asFileUrl(referer, {
    origin: request.origin,
    rootDirectoryUrl: sourceDirectoryUrl
  });
};

/**
 * Start a server for source files:
 * - cook source files according to jsenv plugins
 * - inject code to autoreload the browser when a file is modified
 * @param {Object} devServerParameters
 * @param {string|url} devServerParameters.sourceDirectoryUrl Root directory of the project
 * @return {Object} A dev server object
 */
const startDevServer = async ({
  sourceDirectoryUrl,
  sourceMainFilePath = "./index.html",
  port = 3456,
  hostname,
  acceptAnyIp,
  https,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  logLevel = process.env.IMPORTED_BY_TEST_PLAN ? "warn" : "info",
  serverLogLevel = "warn",
  services = [],
  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  onStop = () => {},
  sourceFilesConfig,
  clientAutoreload = true,
  cooldownBetweenFileEvents,
  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  urlAnalysis = {},
  urlResolution,
  supervisor = true,
  fileSystemMagicRedirection,
  transpilation,
  cacheControl = true,
  ribbon = true,
  // toolbar = false,

  sourcemaps = "inline",
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  outDirectoryUrl,
  ...rest
}) => {
  // params type checking
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(`${unexpectedParamNames.join(",")}: there is no such param`);
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl, "sourceDirectoryUrl");
    if (typeof sourceMainFilePath !== "string") {
      throw new TypeError(`sourceMainFilePath must be a string, got ${sourceMainFilePath}`);
    }
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(outDirectoryUrl, "outDirectoryUrl");
    }
  }
  const logger = createLogger({
    logLevel
  });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, abort);
    });
  }
  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info
  });
  const serverStopCallbacks = [];
  const serverEventsDispatcher = createServerEventsDispatcher();
  serverStopCallbacks.push(() => {
    serverEventsDispatcher.destroy();
  });
  const contextCache = new Map();
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive: process.env.IMPORTED_BY_TEST_PLAN ? false : keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,
    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    services: [{
      handleRequest: request => {
        if (request.headers["x-server-inspect"]) {
          return {
            status: 200
          };
        }
        if (request.pathname === "/__params__.json") {
          const json = JSON.stringify({
            sourceDirectoryUrl
          });
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(json)
            },
            body: json
          };
        }
        return null;
      },
      injectResponseHeaders: () => {
        return {
          server: "jsenv_dev_server/1"
        };
      }
    }, jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowedRequestHeaders: [...jsenvAccessControlAllowedHeaders, "x-jsenv-execution-id"],
      accessControlAllowCredentials: true,
      timingAllowOrigin: true
    }), ...services, {
      name: "jsenv:omega_file_service",
      handleRequest: createFileService({
        signal,
        logLevel,
        serverStopCallbacks,
        serverEventsDispatcher,
        contextCache,
        sourceDirectoryUrl,
        sourceMainFilePath,
        sourceFilesConfig,
        runtimeCompat,
        plugins,
        urlAnalysis,
        urlResolution,
        fileSystemMagicRedirection,
        supervisor,
        transpilation,
        clientAutoreload,
        cooldownBetweenFileEvents,
        cacheControl,
        ribbon,
        sourcemaps,
        sourcemapsSourcesProtocol,
        sourcemapsSourcesContent,
        outDirectoryUrl
      }),
      handleWebsocket: (websocket, {
        request
      }) => {
        if (request.headers["sec-websocket-protocol"] === "jsenv") {
          serverEventsDispatcher.addWebsocket(websocket, request);
        }
      }
    }, {
      name: "jsenv:omega_error_handler",
      handleError: error => {
        const getResponseForError = () => {
          if (error && error.asResponse) {
            return error.asResponse();
          }
          if (error && error.statusText === "Unexpected directory operation") {
            return {
              status: 403
            };
          }
          return convertFileSystemErrorToResponseProperties(error);
        };
        const response = getResponseForError();
        if (!response) {
          return null;
        }
        const body = JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body
        });
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body)
          },
          body
        };
      }
    },
    // default error handling
    jsenvServiceErrorHandler({
      sendErrorDetails: true
    })]
  });
  server.stoppedPromise.then(reason => {
    onStop();
    serverStopCallbacks.forEach(serverStopCallback => {
      serverStopCallback(reason);
    });
    serverStopCallbacks.length = 0;
  });
  startDevServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach(key => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    },
    contextCache
  };
};

/*
 * startBuildServer is mean to interact with the build files;
 * files that will be deployed to production server(s).
 * We want to be as close as possible from the production in order to:
 * - run lighthouse
 * - run an automated test tool such as cypress, playwright
 * - see exactly how build file behaves (debug, measure perf, etc)
 * For these reasons "startBuildServer" must be as close as possible from a static file server.
 * It is not meant to provide a nice developper experience: this is the role "startDevServer".
 *
 * Conclusion:
 * "startBuildServer" must be as close as possible from a static file server because
 * we want to be in the user shoes and we should not alter build files.
 */

/**
 * Start a server for build files.
 * @param {Object} buildServerParameters
 * @param {string|url} buildServerParameters.buildDirectoryUrl Directory where build files are written
 * @return {Object} A build server object
 */
const startBuildServer = async ({
  buildDirectoryUrl,
  buildMainFilePath = "index.html",
  port = 9779,
  services = [],
  acceptAnyIp,
  hostname,
  https,
  http2,
  logLevel,
  serverLogLevel = "warn",
  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  ...rest
}) => {
  // params validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(`${unexpectedParamNames.join(",")}: there is no such param`);
    }
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl, "buildDirectoryUrl");
    if (buildMainFilePath) {
      if (typeof buildMainFilePath !== "string") {
        throw new TypeError(`buildMainFilePath must be a string, got ${buildMainFilePath}`);
      }
      if (buildMainFilePath[0] === "/") {
        buildMainFilePath = buildMainFilePath.slice(1);
      } else {
        const buildMainFileUrl = new URL(buildMainFilePath, buildDirectoryUrl).href;
        if (!buildMainFileUrl.startsWith(buildDirectoryUrl)) {
          throw new Error(`buildMainFilePath must be relative, got ${buildMainFilePath}`);
        }
        buildMainFilePath = buildMainFileUrl.slice(buildDirectoryUrl.length);
      }
      if (!existsSync(new URL(buildMainFilePath, buildDirectoryUrl))) {
        buildMainFilePath = null;
      }
    }
  }
  const logger = createLogger({
    logLevel
  });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, abort);
    });
  }
  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !logger.levels.info
  });
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive: process.env.IMPORTED_BY_TEST_PLAN ? false : keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,
    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    serverTiming: true,
    requestWaitingMs: 60_000,
    services: [jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
      accessControlAllowCredentials: true,
      timingAllowOrigin: true
    }), ...services, {
      name: "jsenv:build_files_service",
      handleRequest: createBuildFilesService({
        buildDirectoryUrl,
        buildMainFilePath
      })
    }, jsenvServiceErrorHandler({
      sendErrorDetails: true
    })]
  });
  startBuildServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach(key => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    }
  };
};
const createBuildFilesService = ({
  buildDirectoryUrl,
  buildMainFilePath
}) => {
  return request => {
    const urlIsVersioned = new URL(request.url).searchParams.has("v");
    if (buildMainFilePath && request.resource === "/") {
      request = {
        ...request,
        resource: `/${buildMainFilePath}`
      };
    }
    return fetchFileSystem(new URL(request.resource.slice(1), buildDirectoryUrl), {
      headers: request.headers,
      cacheControl: urlIsVersioned ? `private,max-age=${SECONDS_IN_30_DAYS},immutable` : "private,max-age=0,must-revalidate",
      etagEnabled: true,
      compressionEnabled: !request.pathname.endsWith(".mp4"),
      rootDirectoryUrl: buildDirectoryUrl,
      canReadDirectory: true
    });
  };
};
const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;

export { build, startBuildServer, startDevServer };
