import { pathToFileURL, fileURLToPath } from "node:url";
import { chmod, stat, lstat, readdir, promises, unlink, openSync, closeSync, rmdir, watch, readdirSync, statSync, writeFileSync as writeFileSync$1, mkdirSync, createReadStream, readFile, existsSync, readFileSync, realpathSync } from "node:fs";
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
import { injectJsImport, visitJsAstUntil, applyBabelPlugins, parseHtmlString, visitHtmlNodes, getHtmlNodeAttribute, analyzeScriptNode, getHtmlNodeText, stringifyHtmlAst, setHtmlNodeAttributes, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, generateUrlForInlineContent, parseJsWithAcorn, parseSrcSet, getHtmlNodePosition, getHtmlNodeAttributePosition, getUrlForContentInsideHtml, removeHtmlNodeText, setHtmlNodeText, parseCssUrls, parseJsUrls, getUrlForContentInsideJs, findHtmlNode, removeHtmlNode, analyzeLinkNode, injectHtmlNode, insertHtmlNodeAfter } from "@jsenv/ast";
import { sourcemapConverter, createMagicSource, composeTwoSourcemaps, SOURCEMAP, generateSourcemapFileUrl, generateSourcemapDataUrl } from "@jsenv/sourcemap";
import { createRequire } from "node:module";
import { systemJsClientFileUrlDefault, convertJsModuleToJsClassic } from "@jsenv/js-module-fallback";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";
import { jsenvPluginSupervisor } from "@jsenv/plugin-supervisor";

/*
 * data:[<mediatype>][;base64],<data>
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs#syntax
 */

/* eslint-env browser, node */

const DATA_URL = {
  parse: (string) => {
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

    contentType =
      contentType === "" ? "text/plain;charset=US-ASCII" : contentType;
    const afterComma = afterDataProtocol.slice(commaIndex + 1);
    return {
      contentType,
      base64Flag,
      data: afterComma,
    };
  },

  stringify: ({ contentType, base64Flag = true, data }) => {
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
  },
};

// consider switching to https://babeljs.io/docs/en/babel-code-frame
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1


const stringifyUrlSite = (
  { url, line, column, content },
  {
    showCodeFrame = true,
    numberOfSurroundingLinesToShow,
    lineMaxLength,
    color,
  } = {},
) => {
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
    color,
  });

  return `${string}
${sourceLoc}`;
};

const showSourceLocation = ({
  content,
  line,
  column,
  numberOfSurroundingLinesToShow = 1,
  lineMaxLength = 120,
} = {}) => {
  let mark = (string) => string;
  let aside = (string) => string;
  // if (color) {
  //   mark = (string) => ANSI.color(string, ANSI.RED)
  //   aside = (string) => ANSI.color(string, ANSI.GREY)
  // }

  const lines = content.split(/\r?\n/);
  if (line === 0) line = 1;
  let lineRange = {
    start: line - 1,
    end: line,
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
    const lineNumberRightSpacing = " ".repeat(
      lineNumberMaxWidth - lineNumberWidth,
    );
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`;
    const lineFormatted = `${aside(asideSource)} ${lineSourceTruncated}`;
    if (isMainLine) {
      if (column === undefined) {
        return `${mark(">")} ${lineFormatted}`;
      }
      const spacing = stringToSpaces(
        `${asideSource} ${lineSourceTruncated.slice(
          0,
          column - columnRange.start - 1,
        )}`,
      );
      return `${mark(">")} ${lineFormatted}
  ${spacing}${mark("^")}`;
    }
    return `  ${lineFormatted}`;
  }).join(`
`);
};

const applyColumnRange = ({ start, end }, line) => {
  if (typeof start !== "number") {
    throw new TypeError(`start must be a number, received ${start}`);
  }
  if (typeof end !== "number") {
    throw new TypeError(`end must be a number, received ${end}`);
  }
  if (end < start) {
    throw new Error(
      `end must be greater than start, but ${end} is smaller than ${start}`,
    );
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

const stringToSpaces = (string) => string.replace(/[^\t]/g, " ");

// const getLineRangeLength = ({ start, end }) => end - start

const moveLineRangeUp = ({ start, end }, number) => {
  return {
    start: start - number,
    end,
  };
};

const moveLineRangeDown = ({ start, end }, number) => {
  return {
    start,
    end: end + number,
  };
};

const lineRangeWithinLines = ({ start, end }, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end,
  };
};

const urlToScheme$1 = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }

  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const urlToResource = (url) => {
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

const urlToPathname$1 = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
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

const urlToExtension$1 = (url) => {
  const pathname = urlToPathname$1(url);
  return pathnameToExtension$1(pathname);
};

const pathnameToExtension$1 = (pathname) => {
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

const asUrlWithoutSearch = (url) => {
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

const isValidUrl$1 = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
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
  if (isValidUrl$1(specifier)) {
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
  if (isValidUrl$1(specifier)) {
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

const setUrlFilename = (url, filename) => {
  const urlObject = new URL(url);
  let { origin, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const parentPathname = new URL("./", urlObject).pathname;
  return `${origin}${parentPathname}${filename}${search}${hash}`;
};

const ensurePathnameTrailingSlash = (url) => {
  const urlObject = new URL(url);
  const { pathname } = urlObject;
  if (pathname.endsWith("/")) {
    return url;
  }
  let { origin } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const { search, hash } = urlObject;
  return `${origin}${pathname}/${search}${hash}`;
};

const isFileSystemPath$1 = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }
  if (value[0] === "/") {
    return true;
  }
  return startsWithWindowsDriveLetter$1(value);
};

const startsWithWindowsDriveLetter$1 = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl$1 = (value) => {
  if (!isFileSystemPath$1(value)) {
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};

const getCallerPosition = () => {
  const { prepareStackTrace } = Error;
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace;
    return stack;
  };
  const { stack } = new Error();
  const callerCallsite = stack[2];
  const fileName = callerCallsite.getFileName();
  return {
    url:
      fileName && isFileSystemPath$1(fileName)
        ? fileSystemPathToUrl$1(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
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

  if (
    urlObject.username !== baseUrlObject.username ||
    urlObject.password !== baseUrlObject.password ||
    urlObject.host !== baseUrlObject.host
  ) {
    const afterUrlScheme = String(url).slice(urlObject.protocol.length);
    return afterUrlScheme;
  }

  const { pathname, hash, search } = urlObject;
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
    const baseSpecificParentPathname =
      pathnameToParentPathname$1(baseSpecificPathname);
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(
      /.*?\//g,
      "../",
    );
    const relativeUrl = `${relativeDirectoriesNotation}${specificPathname}${search}${hash}`;
    return relativeUrl;
  }

  const relativeUrl = `${specificPathname}${search}${hash}`;
  return relativeUrl;
};

const pathnameToParentPathname$1 = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const moveUrl = ({ url, from, to, preferRelative }) => {
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

const urlToFilename$1 = (url) => {
  const pathname = urlToPathname$1(url);
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

const urlToBasename = (url) => {
  const filename = urlToFilename$1(url);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};

const urlToFileSystemPath = (url) => {
  let urlString = String(url);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  const fileSystemPath = fileURLToPath(urlString);
  return fileSystemPath;
};

const validateDirectoryUrl = (value) => {
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
          message: `must be a valid url`,
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: `must be a string or an url`,
    };
  }
  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"',
    };
  }
  return {
    valid: true,
    value: ensurePathnameTrailingSlash(urlString),
  };
};

const assertAndNormalizeDirectoryUrl = (
  directoryUrl,
  name = "directoryUrl",
) => {
  const { valid, message, value } = validateDirectoryUrl(directoryUrl);
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
          message: "must be a valid url",
        };
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: "must be a string or an url",
    };
  }

  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"',
    };
  }

  return {
    valid: true,
    value: urlString,
  };
};

const assertAndNormalizeFileUrl = (
  fileUrl,
  baseUrl,
  name = "fileUrl",
) => {
  const { valid, message, value } = validateFileUrl(fileUrl, baseUrl);
  if (!valid) {
    throw new TypeError(`${name} ${message}, got ${fileUrl}`);
  }
  return value;
};

const statsToType = (stats) => {
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

const permissionsToBinaryFlags = ({ owner, group, others }) => {
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
        execute: getPermissionOrComputeDefault("execute", "owner", permissions),
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions),
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault(
          "execute",
          "others",
          permissions,
        ),
      },
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }

  return new Promise((resolve, reject) => {
    chmod(new URL(sourceUrl), binaryFlags, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const actionLevels = { read: 0, write: 1, execute: 2 };
const subjectLevels = { others: 0, group: 1, owner: 2 };

const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];
    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }

    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(
      (actionFallbackCandidate) =>
        actionLevels[actionFallbackCandidate] > actionLevel &&
        actionFallbackCandidate in subjectPermissions,
    );
    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }

  const subjectLevel = subjectLevels[subject];
  // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?
  const subjectFallback = Object.keys(subjectLevels).find(
    (subjectFallbackCandidate) =>
      subjectLevels[subjectFallbackCandidate] > subjectLevel &&
      subjectFallbackCandidate in permissions,
  );
  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions
      ? subjectPermissions[action]
      : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }

  return false;
};

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */


const isWindows$3 = process.platform === "win32";

const readEntryStat = async (
  source,
  { nullIfNotFound = false, followLink = true } = {},
) => {
  let sourceUrl = assertAndNormalizeFileUrl(source);
  if (sourceUrl.endsWith("/")) sourceUrl = sourceUrl.slice(0, -1);

  const sourcePath = urlToFileSystemPath(sourceUrl);

  const handleNotFoundOption = nullIfNotFound
    ? {
        handleNotFoundError: () => null,
      }
    : {};

  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows$3
      ? {
          // Windows can EPERM on stat
          handlePermissionDeniedError: async (error) => {
            console.error(
              `trying to fix windows EPERM after stats on ${sourcePath}`,
            );

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
                },
              });
              return stats;
            } catch (e) {
              console.error(
                `error while trying to fix windows EPERM after stats on ${sourcePath}: ${e.stack}`,
              );
              throw error;
            }
          },
        }
      : {}),
  });
};

const readStat = (
  sourcePath,
  {
    followLink,
    handleNotFoundError = null,
    handlePermissionDeniedError = null,
  } = {},
) => {
  const nodeMethod = followLink ? stat : lstat;

  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else if (
          handlePermissionDeniedError &&
          (error.code === "EPERM" || error.code === "EACCES")
        ) {
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

const bufferToEtag$1 = (buffer) => {
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
    cleanCallbacks.forEach((clean) => {
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

  Object.keys(raceDescription).forEach((candidateName) => {
    const register = raceDescription[candidateName];
    const returnValue = register((data) => {
      if (status !== "racing") {
        return;
      }
      status = "done";
      clean();
      winnerCallback({
        name: candidateName,
        data,
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

  const add = (callback) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "add", status });
      return removeNoop;
    }

    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    // don't register twice
    const existingCallback = callbacks.find((callbackCandidate) => {
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

  const notify = (param) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "call", status });
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

const emitUnexpectedActionWarning = ({ action, status }) => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(
      `"${action}" should not happen when callback list is ${status}`,
      {
        CODE: "UNEXPECTED_ACTION_ON_CALLBACK_LIST",
        detail: `Code is potentially executed when it should not`,
      },
    );
  } else {
    console.warn(
      `"${action}" should not happen when callback list is ${status}`,
    );
  }
};

const emitCallbackDuplicationWarning = () => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`Trying to add a callback already in the list`, {
      CODE: "CALLBACK_DUPLICATION",
      detail: `Code is potentially executed more than it should`,
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
  isAbortError: (error) => {
    return error && error.name === "AbortError";
  },

  startOperation: () => {
    return createOperation();
  },

  throwIfAborted: (signal) => {
    if (signal.aborted) {
      const error = new Error(`The operation was aborted`);
      error.name = "AbortError";
      error.type = "aborted";
      throw error;
    }
  },
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
  const addAbortCallback = (callback) => {
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

  const addEndCallback = (callback) => {
    return endCallbackList.add(callback);
  };

  const end = async ({ abortAfterEnd = false } = {}) => {
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

  const addAbortSignal = (
    signal,
    { onAbort = callbackNoop, onRemove = callbackNoop } = {},
  ) => {
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

    const cancelRace = raceCallbacks(
      {
        operation_abort: (cb) => {
          return addAbortCallback(cb);
        },
        operation_end: (cb) => {
          return addEndCallback(cb);
        },
        child_abort: (cb) => {
          return addEventListener(signal, "abort", cb);
        },
      },
      (winner) => {
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
          },
        };
        raceEffects[winner.name](winner.value);
      },
    );

    return () => {
      cancelRace();
      applyRemoveEffects();
    };
  };

  const addAbortSource = (abortSourceCallback) => {
    const abortSource = {
      cleaned: false,
      signal: null,
      remove: callbackNoop,
    };
    const abortSourceController = new AbortController();
    const abortSourceSignal = abortSourceController.signal;
    abortSource.signal = abortSourceSignal;
    if (operationSignal.aborted) {
      return abortSource;
    }
    const returnValue = abortSourceCallback((value) => {
      abortSourceController.abort(value);
    });
    const removeAbortSignal = addAbortSignal(abortSourceSignal, {
      onRemove: () => {
        if (typeof returnValue === "function") {
          returnValue();
        }
        abortSource.cleaned = true;
      },
    });
    abortSource.remove = removeAbortSignal;
    return abortSource;
  };

  const timeout = (ms) => {
    return addAbortSource((abort) => {
      const timeoutId = setTimeout(abort, ms);
      // an abort source return value is called when:
      // - operation is aborted (by an other source)
      // - operation ends
      return () => {
        clearTimeout(timeoutId);
      };
    });
  };

  const withSignal = async (asyncCallback) => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      },
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

  const withSignalSync = (callback) => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const removeAbortSignal = addAbortSignal(signal, {
      onAbort: () => {
        abortController.abort();
      },
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
    end,
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
  return raceCallbacks(
    {
      ...(processTeardownEvents.SIGHUP ? SIGHUP_CALLBACK : {}),
      ...(processTeardownEvents.SIGTERM ? SIGTERM_CALLBACK : {}),
      ...(processTeardownEvents.SIGINT ? SIGINT_CALLBACK : {}),
      ...(processTeardownEvents.beforeExit ? BEFORE_EXIT_CALLBACK : {}),
      ...(processTeardownEvents.exit ? EXIT_CALLBACK : {}),
    },
    callback,
  );
};

const SIGHUP_CALLBACK = {
  SIGHUP: (cb) => {
    process.on("SIGHUP", cb);
    return () => {
      process.removeListener("SIGHUP", cb);
    };
  },
};

const SIGTERM_CALLBACK = {
  SIGTERM: (cb) => {
    process.on("SIGTERM", cb);
    return () => {
      process.removeListener("SIGTERM", cb);
    };
  },
};

const BEFORE_EXIT_CALLBACK = {
  beforeExit: (cb) => {
    process.on("beforeExit", cb);
    return () => {
      process.removeListener("beforeExit", cb);
    };
  },
};

const EXIT_CALLBACK = {
  exit: (cb) => {
    process.on("exit", cb);
    return () => {
      process.removeListener("exit", cb);
    };
  },
};

const SIGINT_CALLBACK = {
  SIGINT: (cb) => {
    process.on("SIGINT", cb);
    return () => {
      process.removeListener("SIGINT", cb);
    };
  },
};

const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(
      `${name} must be a url but looks like a windows pathname, got ${value}`,
    );
  }
  if (!hasScheme$1(value)) {
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

const hasScheme$1 = (specifier) => /^[a-zA-Z]+:/.test(specifier);

const resolveAssociations = (associations, baseUrl) => {
  assertUrlLike(baseUrl, "baseUrl");
  const associationsResolved = {};
  Object.keys(associations).forEach((key) => {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      Object.keys(value).forEach((pattern) => {
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

const asFlatAssociations = (associations) => {
  if (!isPlainObject(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    );
  }
  const flatAssociations = {};
  Object.keys(associations).forEach((associationName) => {
    const associationValue = associations[associationName];
    if (isPlainObject(associationValue)) {
      Object.keys(associationValue).forEach((pattern) => {
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
const applyPatternMatching = ({ url, pattern }) => {
  assertUrlLike(pattern, "pattern");
  assertUrlLike(url, "url");
  const { matched, patternIndex, index, groups } = applyMatching(pattern, url);
  const matchGroups = [];
  let groupIndex = 0;
  groups.forEach((group) => {
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
        groups.push({ string: "" });
      }
      return false; // fail because string shorter than expected
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
      // the next char must not the one expected by remainingPattern[0]
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

const applyAssociations = ({ url, associations }) => {
  assertUrlLike(url);
  const flatAssociations = asFlatAssociations(associations);
  return Object.keys(flatAssociations).reduce((previousValue, pattern) => {
    const { matched } = applyPatternMatching({
      pattern,
      url,
    });
    if (matched) {
      const value = flatAssociations[pattern];
      if (isPlainObject(previousValue) && isPlainObject(value)) {
        return {
          ...previousValue,
          ...value,
        };
      }
      return value;
    }
    return previousValue;
  }, {});
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
  const newUrl = parts.reduce((previous, value, index) => {
    return `${previous}${value}${
      index === parts.length - 1 ? "" : matchGroups[index]
    }`;
  }, "");
  return newUrl;
};

const urlChildMayMatch = ({ url, associations, predicate }) => {
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
  Object.keys(flatAssociations).forEach((pattern) => {
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
  });
  if (someFullMatch) {
    return Boolean(predicate(fullMatchMeta));
  }
  return partialMatchMetaArray.some((partialMatchMeta) =>
    predicate(partialMatchMeta),
  );
};

const URL_META = {
  resolveAssociations,
  applyAssociations,
  urlChildMayMatch,
  applyPatternMatching,
  applyAliases,
};

const readDirectory = async (url, { emfileMaxWait = 1000 } = {}) => {
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
        await new Promise((resolve) => setTimeout(resolve), attemptCount);
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
    const leftPartExists = i in leftPartArray;
    const rightPartExists = i in rightPartArray;

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
const { mkdir } = promises;

const writeDirectory = async (
  destination,
  { recursive = true, allowUseless = false } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  const destinationStats = await readEntryStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false,
  });

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }
      throw new Error(`directory already exists at ${destinationPath}`);
    }

    const destinationType = statsToType(destinationStats);
    throw new Error(
      `cannot write directory at ${destinationPath} because there is a ${destinationType}`,
    );
  }

  try {
    await mkdir(destinationPath, { recursive });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};

const removeEntry = async (
  source,
  {
    signal = new AbortController().signal,
    allowUseless = false,
    recursive = false,
    maxRetries = 3,
    retryDelay = 100,
    onlyContent = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  const removeOperation = Abort.startOperation();
  removeOperation.addAbortSignal(signal);

  try {
    removeOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false,
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
    if (
      sourceStats.isFile() ||
      sourceStats.isSymbolicLink() ||
      sourceStats.isCharacterDevice() ||
      sourceStats.isBlockDevice()
    ) {
      await removeNonDirectory(
        sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl,
        {
          maxRetries,
          retryDelay,
        },
      );
    } else if (sourceStats.isDirectory()) {
      await removeDirectory(ensurePathnameTrailingSlash(sourceUrl), {
        signal: removeOperation.signal,
        recursive,
        maxRetries,
        retryDelay,
        onlyContent,
      });
    }
  } finally {
    await removeOperation.end();
  }
};

const removeNonDirectory = (sourceUrl, { maxRetries, retryDelay }) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);

  let retryCount = 0;
  const attempt = () => {
    return unlinkNaive(sourcePath, {
      ...(retryCount >= maxRetries
        ? {}
        : {
            handleTemporaryError: async () => {
              retryCount++;
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve(attempt());
                }, retryCount * retryDelay);
              });
            },
          }),
    });
  };
  return attempt();
};

const unlinkNaive = (sourcePath, { handleTemporaryError = null } = {}) => {
  return new Promise((resolve, reject) => {
    unlink(sourcePath, (error) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve();
        } else if (
          handleTemporaryError &&
          (error.code === "EBUSY" ||
            error.code === "EMFILE" ||
            error.code === "ENFILE" ||
            error.code === "ENOENT")
        ) {
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

const removeDirectory = async (
  rootDirectoryUrl,
  { signal, maxRetries, retryDelay, recursive, onlyContent },
) => {
  const removeDirectoryOperation = Abort.startOperation();
  removeDirectoryOperation.addAbortSignal(signal);

  const visit = async (sourceUrl) => {
    removeDirectoryOperation.throwIfAborted();
    const sourceStats = await readEntryStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false,
    });

    // file/directory not found
    if (sourceStats === null) {
      return;
    }

    if (
      sourceStats.isFile() ||
      sourceStats.isCharacterDevice() ||
      sourceStats.isBlockDevice()
    ) {
      await visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      await visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      await visitDirectory(`${sourceUrl}/`);
    }
  };

  const visitDirectory = async (directoryUrl) => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive
      ? {
          handleNotEmptyError: async () => {
            await removeDirectoryContent(directoryUrl);
            await visitDirectory(directoryUrl);
          },
        }
      : {};
    removeDirectoryOperation.throwIfAborted();
    await removeDirectoryNaive(directoryPath, {
      ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32"
        ? {
            handlePermissionError: async (error) => {
              console.error(
                `trying to fix windows EPERM after readir on ${directoryPath}`,
              );

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
                console.error(
                  `error while trying to fix windows EPERM after readir on ${directoryPath}: ${openOrCloseError.stack}`,
                );
                throw error;
              }

              await removeDirectoryNaive(directoryPath, {
                ...optionsFromRecursive,
              });
            },
          }
        : {}),
    });
  };

  const removeDirectoryContent = async (directoryUrl) => {
    removeDirectoryOperation.throwIfAborted();
    const names = await readDirectory(directoryUrl);
    await Promise.all(
      names.map(async (name) => {
        const url = resolveUrl$1(name, directoryUrl);
        await visit(url);
      }),
    );
  };

  const visitFile = async (fileUrl) => {
    await removeNonDirectory(fileUrl, { maxRetries, retryDelay });
  };

  const visitSymbolicLink = async (symbolicLinkUrl) => {
    await removeNonDirectory(symbolicLinkUrl, { maxRetries, retryDelay });
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

const removeDirectoryNaive = (
  directoryPath,
  { handleNotEmptyError = null, handlePermissionError = null } = {},
) => {
  return new Promise((resolve, reject) => {
    rmdir(directoryPath, (error, lstatObject) => {
      if (error) {
        if (handlePermissionError && error.code === "EPERM") {
          resolve(handlePermissionError(error));
        } else if (error.code === "ENOENT") {
          resolve();
        } else if (
          handleNotEmptyError &&
          // linux os
          (error.code === "ENOTEMPTY" ||
            // SunOS
            error.code === "EEXIST")
        ) {
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

const ensureEmptyDirectory = async (source) => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (stats === null) {
    // if there is nothing, create a directory
    return writeDirectory(source, { allowUseless: true });
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    return removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true,
    });
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
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
    throw new Error(
      `absolute baseUrl expected but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
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
  const baseUrlOrFallback = baseUrl.startsWith("file://")
    ? baseUrl
    : baseUrlFallback;
  const driveLetter = extractDriveLetter(
    baseUrlOrFallback.slice("file://".length),
  );
  if (!driveLetter) {
    throw new Error(
      `drive letter expected on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }
  return `file:///${driveLetter}:${afterProtocol}`;
};

const extractDriveLetter = (resource) => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(resource[1]) && resource[2] === ":") {
    return resource[1];
  }
  return null;
};

process.platform === "win32";

const guardTooFastSecondCallPerFile = (
  callback,
  cooldownBetweenFileEvents = 40,
) => {
  const previousCallMsMap = new Map();
  return (fileEvent) => {
    const { relativeUrl } = fileEvent;
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
    watcher.on("error", async (error) => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = openSync(sourcePath, "r");
          closeSync(fd);
        } catch (e) {
          if (e.code === "ENOENT") {
            return;
          }
          console.error(
            `error while trying to get rid of windows EPERM: ${e.stack}`,
          );
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

  const registerCleanupCallback = (callback) => {
    if (typeof callback !== "function")
      throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };

  const cleanup = async (reason) => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map((callback) => callback(reason)));
  };

  return { registerCleanupCallback, cleanup };
};

const fsWatchSupportsRecursive = false;

const registerDirectoryLifecycle = (
  source,
  {
    debug = false,
    added,
    updated,
    removed,
    watchPatterns = {
      "./**/*": true,
    },
    notifyExistent = false,
    keepProcessAlive = true,
    recursive = false,
    // filesystem might dispatch more events than expected
    // Code can use "cooldownBetweenFileEvents" to prevent that
    // BUT it is UNADVISED to rely on this as explained later (search for "is lying" in this file)
    // For this reason"cooldownBetweenFileEvents" should be reserved to scenarios
    // like unit tests
    cooldownBetweenFileEvents = 0,
  },
) => {
  const sourceUrl = assertAndNormalizeDirectoryUrl(source);
  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }
  if (!undefinedOrFunction(updated)) {
    throw new TypeError(
      `updated must be a function or undefined, got ${updated}`,
    );
  }
  if (!undefinedOrFunction(removed)) {
    throw new TypeError(
      `removed must be a function or undefined, got ${removed}`,
    );
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCallPerFile(added, cooldownBetweenFileEvents);
    }
    if (updated) {
      updated = guardTooFastSecondCallPerFile(
        updated,
        cooldownBetweenFileEvents,
      );
    }
    if (removed) {
      removed = guardTooFastSecondCallPerFile(
        removed,
        cooldownBetweenFileEvents,
      );
    }
  }

  const associations = URL_META.resolveAssociations(
    { watch: watchPatterns },
    sourceUrl,
  );
  const getWatchPatternValue = ({ url, type }) => {
    if (type === "directory") {
      let firstMeta = false;
      URL_META.urlChildMayMatch({
        url: `${url}/`,
        associations,
        predicate: ({ watch }) => {
          if (watch) {
            firstMeta = watch;
          }
          return watch;
        },
      });
      return firstMeta;
    }
    const { watch } = URL_META.applyAssociations({ url, associations });
    return watch;
  };
  const tracker = trackResources();
  const infoMap = new Map();
  const readEntryInfo = (url) => {
    try {
      const relativeUrl = urlToRelativeUrl(url, source);
      const previousInfo = infoMap.get(relativeUrl);
      const stat = statSync(new URL(url));
      const type = statsToType(stat);
      const patternValue = previousInfo
        ? previousInfo.patternValue
        : getWatchPatternValue({ url, type });
      return {
        previousInfo,
        url,
        relativeUrl,
        type,
        stat,
        patternValue,
      };
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          type: null,
          stat: null,
        };
      }
      throw e;
    }
  };

  const handleDirectoryEvent = ({
    directoryRelativeUrl,
    filename,
    eventType,
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
        relativeUrlCandidateArray = relativeUrlCandidateArray.filter(
          (relativeUrlCandidate) => {
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
            const afterDirectory = relativeUrlCandidate.slice(
              directoryRelativeUrl.length + 1,
            );
            // deep inside this directory
            if (afterDirectory.includes("/")) {
              return false;
            }
            return true;
          },
        );
      }
      const removedEntryRelativeUrl = relativeUrlCandidateArray.find(
        (relativeUrlCandidate) => {
          try {
            statSync(new URL(relativeUrlCandidate, sourceUrl));
            return false;
          } catch (e) {
            if (e.code === "ENOENT") {
              return true;
            }
            throw e;
          }
        },
      );
      if (removedEntryRelativeUrl) {
        handleEntryLost(infoMap.get(removedEntryRelativeUrl));
      }
    }
  };

  const handleChange = (relativeUrl) => {
    const entryUrl = new URL(relativeUrl, sourceUrl).href;
    const entryInfo = readEntryInfo(entryUrl);
    if (entryInfo.type === null) {
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
    const { previousInfo } = entryInfo;
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
  const handleEntryFound = (entryInfo, { notify = true } = {}) => {
    infoMap.set(entryInfo.relativeUrl, entryInfo);
    if (entryInfo.type === "directory") {
      const directoryUrl = `${entryInfo.url}/`;
      readdirSync(new URL(directoryUrl)).forEach((entryName) => {
        const childEntryUrl = new URL(entryName, directoryUrl).href;
        const childEntryInfo = readEntryInfo(childEntryUrl);
        if (childEntryInfo.type !== null && childEntryInfo.patternValue) {
          handleEntryFound(childEntryInfo, { notify });
        }
      });
      // we must watch manually every directory we find
      {
        const watcher = createWatcher(urlToFileSystemPath(entryInfo.url), {
          persistent: keepProcessAlive,
        });
        tracker.registerCleanupCallback(() => {
          watcher.close();
        });
        watcher.on("change", (eventType, filename) => {
          handleDirectoryEvent({
            directoryRelativeUrl: entryInfo.relativeUrl,
            filename: filename
              ? // replace back slashes with slashes
                filename.replace(/\\/g, "/")
              : "",
            eventType,
          });
        });
      }
    }
    if (added && entryInfo.patternValue && notify) {
      added({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.stat.mtimeMs,
      });
    }
  };
  const handleEntryLost = (entryInfo) => {
    infoMap.delete(entryInfo.relativeUrl);
    if (removed && entryInfo.patternValue) {
      removed({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.stat.mtimeMs,
      });
    }
  };
  const handleEntryUpdated = (entryInfo) => {
    infoMap.set(entryInfo.relativeUrl, entryInfo);
    if (updated && entryInfo.patternValue && shouldCallUpdated(entryInfo)) {
      updated({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.stat.mtimeMs,
        previousMtime: entryInfo.previousInfo.stat.mtimeMs,
      });
    }
  };

  readdirSync(new URL(sourceUrl)).forEach((entry) => {
    const entryUrl = new URL(entry, sourceUrl).href;
    const entryInfo = readEntryInfo(entryUrl);
    if (entryInfo.type !== null && entryInfo.patternValue) {
      handleEntryFound(entryInfo, {
        notify: notifyExistent,
      });
    }
  });
  if (debug) {
    const relativeUrls = Array.from(infoMap.keys());
    if (relativeUrls.length === 0) {
      console.debug(`No file found`);
    } else {
      console.debug(
        `${relativeUrls.length} file found: 
${relativeUrls.join("\n")}`,
      );
    }
  }
  const watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive,
    persistent: keepProcessAlive,
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({
      ...fileSystemPathToDirectoryRelativeUrlAndFilename(fileSystemPath),
      eventType,
    });
  });

  return tracker.cleanup;
};

const shouldCallUpdated = (entryInfo) => {
  const { stat, previousInfo } = entryInfo;
  if (!stat.atimeMs) {
    return true;
  }
  if (stat.atimeMs < stat.mtimeMs) {
    return true;
  }
  if (stat.mtimeMs > previousInfo.stat.mtimeMs) {
    return true;
  }
  return false;
};

const undefinedOrFunction = (value) => {
  return typeof value === "undefined" || typeof value === "function";
};

const fileSystemPathToDirectoryRelativeUrlAndFilename = (path) => {
  if (!path) {
    return {
      directoryRelativeUrl: "",
      filename: "",
    };
  }

  const normalizedPath = path.replace(/\\/g, "/"); // replace back slashes with slashes
  const slashLastIndex = normalizedPath.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return {
      directoryRelativeUrl: "",
      filename: normalizedPath,
    };
  }

  const directoryRelativeUrl = normalizedPath.slice(0, slashLastIndex);
  const filename = normalizedPath.slice(slashLastIndex + 1);
  return {
    directoryRelativeUrl,
    filename,
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
        recursive: true,
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
		if ('GITHUB_ACTIONS' in env || 'GITEA_ACTIONS' in env) {
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

const setANSIColor = canUseColors
  ? (text, ANSI_COLOR) => `${ANSI_COLOR}${text}${RESET}`
  : (text) => text;

const ANSI = {
  supported: canUseColors,

  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  GREY,
  RESET,

  color: setANSIColor,
};

function isUnicodeSupported() {
	if (process$1.platform !== 'win32') {
		return process$1.env.TERM !== 'linux'; // Linux console (kernel)
	}

	return Boolean(process$1.env.CI)
		|| Boolean(process$1.env.WT_SESSION) // Windows Terminal
		|| Boolean(process$1.env.TERMINUS_SUBLIME) // Terminus (<0.2.27)
		|| process$1.env.ConEmuTask === '{cmd::Cmder}' // ConEmu and cmder
		|| process$1.env.TERM_PROGRAM === 'Terminus-Sublime'
		|| process$1.env.TERM_PROGRAM === 'vscode'
		|| process$1.env.TERM === 'xterm-256color'
		|| process$1.env.TERM === 'alacritty'
		|| process$1.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm';
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

  supported: canUseUnicode,
};

const createDetailedMessage$1 = (message, details = {}) => {
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

const msAsDuration = (ms) => {
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
  const { primary, remaining } = parseMs(ms);
  if (!remaining) {
    return formatDurationUnit(primary, primary.name === "second" ? 1 : 0);
  }
  return `${formatDurationUnit(primary, 0)} and ${formatDurationUnit(
    remaining,
    0,
  )}`;
};

const formatDurationUnit = (unit, decimals) => {
  const count = setRoundedPrecision(unit.count, {
    decimals,
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

const byteAsFileSize = (numberOfBytes) => {
  return formatBytes(numberOfBytes);
};

const formatBytes = (number, { fixedDecimals = false } = {}) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  );
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  const maxDecimals = unitNumber < 100 ? 1 : 0;
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals: maxDecimals,
    decimalsWhenSmall: 1,
  });
  if (fixedDecimals) {
    return `${unitNumberRounded.toFixed(maxDecimals)} ${unitName}`;
  }
  return `${unitNumberRounded} ${unitName}`;
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
		returnValue += ESC + (-x) + 'D';
	} else if (x > 0) {
		returnValue += ESC + x + 'C';
	}

	if (y < 0) {
		returnValue += ESC + (-y) + 'A';
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

ansiEscapes.clearTerminal = isWindows
	? `${ansiEscapes.eraseScreen}${ESC}0f`
	// 1. Erases the screen (Only done in case `2` is not supported)
	// 2. Erases the whole screen including scrollback buffer
	// 3. Moves cursor to the top-left position
	// More info: https://www.real-world-systems.com/docs/ANSIcode.html
	: `${ansiEscapes.eraseScreen}${ESC}3J${ESC}H`;

ansiEscapes.enterAlternativeScreen = ESC + '?1049h';
ansiEscapes.exitAlternativeScreen = ESC + '?1049l';

ansiEscapes.beep = BEL;

ansiEscapes.link = (text, url) => [
	OSC,
	'8',
	SEP,
	SEP,
	url,
	BEL,
	text,
	OSC,
	'8',
	SEP,
	SEP,
	BEL,
].join('');

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
			returnValue += (
				hasX
					? [message, options.length, options.x, options.y]
					: [options.length, message]
			).join('|');
		} else {
			returnValue += message;
		}

		return returnValue + BEL;
	},
};

/*
 *
 */

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = (stream) => {
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
  newLine = "after",
} = {}) => {
  const { columns = 80, rows = 24 } = stream;

  const log = {
    onVerticalOverflow: () => {},
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
    logLines.forEach((logLine) => {
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

  const doWrite = (string) => {
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

  const dynamicWrite = (callback) => {
    const outputFromOutside = streamOutputSpy();
    const string = callback({ outputFromOutside });
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
    destroy,
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
  effect = () => {},
  animated = true,
}) => {
  let frameIndex = 0;
  let interval;
  let running = true;

  const spinner = {
    message: undefined,
  };

  const update = (message) => {
    spinner.message = running ? `${frames[frameIndex]} ${message}` : message;
    return spinner.message;
  };
  spinner.update = update;

  let cleanup;
  if (animated && ANSI.supported) {
    running = true;
    cleanup = effect();
    log.write(update(render()));

    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
      log.dynamicWrite(({ outputFromOutside }) => {
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
  const startMs = Date.now();
  const log = createLog();
  let message = label;
  const taskSpinner = startSpinner({
    log,
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
        `${UNICODE.OK} ${label} (done in ${msAsDuration(msEllapsed)})`,
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

const memoize = (compute) => {
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

const timeStart = (name) => {
  // as specified in https://w3c.github.io/server-timing/#the-performanceservertiming-interface
  // duration is a https://www.w3.org/TR/hr-time-2/#sec-domhighrestimestamp
  const startTimestamp = performance$1.now();
  const timeEnd = () => {
    const endTimestamp = performance$1.now();
    const timing = {
      [name]: endTimestamp - startTimestamp,
    };
    return timing;
  };
  return timeEnd;
};

const timeFunction = (name, fn) => {
  const timeEnd = timeStart(name);
  const returnValue = fn();
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((value) => {
      return [timeEnd(), value];
    });
  }
  return [timeEnd(), returnValue];
};

const HOOK_NAMES$1 = [
  "serverListening",
  "redirectRequest",
  "handleRequest",
  "handleWebsocket",
  "handleError",
  "onResponsePush",
  "injectResponseHeaders",
  "responseReady",
  "serverStopped",
];

const createServiceController = (services) => {
  const flatServices = flattenAndFilterServices(services);
  const hookGroups = {};

  const addService = (service) => {
    Object.keys(service).forEach((key) => {
      if (key === "name") return;
      const isHook = HOOK_NAMES$1.includes(key);
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${service.name}" service`,
        );
      }
      const hookName = key;
      const hookValue = service[hookName];
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = []);
        group.push({
          service,
          name: hookName,
          value: hookValue,
        });
      }
    });
  };
  flatServices.forEach((service) => {
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
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
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
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
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
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
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
      const visit = (index) => {
        if (index >= hooks.length) {
          return resolve();
        }
        const hook = hooks[index];
        const returnValue = callAsyncHook(hook, info, context);
        return Promise.resolve(returnValue).then((output) => {
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
    getCurrentHookName: () => currentHookName,
  };
};

const flattenAndFilterServices = (services) => {
  const flatServices = [];
  const visitServiceEntry = (serviceEntry) => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach((value) => visitServiceEntry(value));
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
  services.forEach((serviceEntry) => visitServiceEntry(serviceEntry));
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

const parseMultipleHeader = (
  multipleHeaderString,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  const values = multipleHeaderString.split(",");
  const multipleHeader = {};
  values.forEach((value) => {
    const valueTrimmed = value.trim();
    const valueParts = valueTrimmed.split(";");
    const name = valueParts[0];
    const nameValidation = validateName(name);
    if (!nameValidation) {
      return;
    }

    const properties = parseHeaderProperties(valueParts.slice(1), {
      validateProperty,
    });
    multipleHeader[name] = properties;
  });
  return multipleHeader;
};

const parseHeaderProperties = (headerProperties, { validateProperty }) => {
  const properties = headerProperties.reduce((previous, valuePart) => {
    const [propertyName, propertyValueString] = valuePart.split("=");
    const propertyValue = parseHeaderPropertyValue(propertyValueString);
    const property = { name: propertyName, value: propertyValue };
    const propertyValidation = validateProperty(property);
    if (!propertyValidation) {
      return previous;
    }
    return {
      ...previous,
      [property.name]: property.value,
    };
  }, {});
  return properties;
};

const parseHeaderPropertyValue = (headerPropertyValueString) => {
  const firstChar = headerPropertyValueString[0];
  const lastChar =
    headerPropertyValueString[headerPropertyValueString.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return headerPropertyValueString.slice(1, -1);
  }
  if (isNaN(headerPropertyValueString)) {
    return headerPropertyValueString;
  }
  return parseFloat(headerPropertyValueString);
};

const stringifyMultipleHeader = (
  multipleHeader,
  { validateName = () => true, validateProperty = () => true } = {},
) => {
  return Object.keys(multipleHeader)
    .filter((name) => {
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
    })
    .map((name) => {
      const headerProperties = multipleHeader[name];
      const headerPropertiesString = stringifyHeaderProperties(
        headerProperties,
        {
          validateProperty,
        },
      );
      if (headerPropertiesString.length) {
        return `${name};${headerPropertiesString}`;
      }
      return name;
    })
    .join(", ");
};

const stringifyHeaderProperties = (headerProperties, { validateProperty }) => {
  const headerPropertiesString = Object.keys(headerProperties)
    .map((name) => {
      const property = {
        name,
        value: headerProperties[name],
      };
      return property;
    })
    .filter((property) => {
      const propertyValidation = validateProperty(property);
      if (!propertyValidation) {
        return false;
      }
      return true;
    })
    .map(stringifyHeaderProperty)
    .join(";");
  return headerPropertiesString;
};

const stringifyHeaderProperty = ({ name, value }) => {
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
const timingToServerTimingResponseHeaders = (timing) => {
  const serverTimingHeader = {};
  Object.keys(timing).forEach((key, index) => {
    const name = letters[index] || "zz";
    serverTimingHeader[name] = {
      desc: key,
      dur: timing[key],
    };
  });
  const serverTimingHeaderString =
    stringifyServerTimingHeader(serverTimingHeader);

  return { "server-timing": serverTimingHeaderString };
};

const stringifyServerTimingHeader = (serverTimingHeader) => {
  return stringifyMultipleHeader(serverTimingHeader, {
    validateName: validateServerTimingName,
  });
};

// (),/:;<=>?@[\]{}" Don't allowed
// Minimal length is one symbol
// Digits, alphabet characters,
// and !#$%&'*+-.^_`|~ are allowed
// https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
// https://tools.ietf.org/html/rfc7230#section-3.2.6
const validateServerTimingName = (name) => {
  const valid = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/gi.test(name);
  if (!valid) {
    console.warn(`server timing contains invalid symbols`);
    return false;
  }
  return true;
};

const letters = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

const listenEvent = (
  objectWithEventEmitter,
  eventName,
  callback,
  { once = false } = {},
) => {
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
  privateKey,
}) => {
  const httpServer = http.createServer();
  const tlsServer = await createSecureServer({
    certificate,
    privateKey,
    http2,
    http1Allowed,
  });
  const netServer = net.createServer({
    allowHalfOpen: false,
  });

  listenEvent(netServer, "connection", (socket) => {
    detectSocketProtocol(socket, (protocol) => {
      if (protocol === "http") {
        httpServer.emit("connection", socket);
        return;
      }

      if (protocol === "tls") {
        tlsServer.emit("connection", socket);
        return;
      }

      const response = [
        `HTTP/1.1 400 Bad Request`,
        `Content-Length: 0`,
        "",
        "",
      ].join("\r\n");
      socket.write(response);
      socket.end();
      socket.destroy();
      netServer.emit(
        "clientError",
        new Error("protocol error, Neither http, nor tls"),
        socket,
      );
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
  http1Allowed,
}) => {
  if (http2) {
    const { createSecureServer } = await import("node:http2");
    return createSecureServer({
      cert: certificate,
      key: privateKey,
      allowHTTP1: http1Allowed,
    });
  }

  const { createServer } = await import("node:https");
  return createServer({
    cert: certificate,
    key: privateKey,
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

const trackServerPendingConnections = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingConnections(nodeServer);
  }
  return trackHttp1ServerPendingConnections(nodeServer);
};

// const trackHttp2ServerPendingSessions = () => {}

const trackHttp1ServerPendingConnections = (nodeServer) => {
  const pendingConnections = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (connection) => {
      pendingConnections.add(connection);
      listenEvent(
        connection,
        "close",
        () => {
          pendingConnections.delete(connection);
        },
        { once: true },
      );
    },
  );

  const stop = async (reason) => {
    removeConnectionListener();
    const pendingConnectionsArray = Array.from(pendingConnections);
    pendingConnections.clear();

    await Promise.all(
      pendingConnectionsArray.map(async (pendingConnection) => {
        await destroyConnection(pendingConnection, reason);
      }),
    );
  };

  return { stop };
};

const destroyConnection = (connection, reason) => {
  return new Promise((resolve, reject) => {
    connection.destroy(reason, (error) => {
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
    const removeHttpRequestListener = listenEvent(
      nodeServer._httpServer,
      "request",
      requestCallback,
    );
    const removeTlsRequestListener = listenEvent(
      nodeServer._tlsServer,
      "request",
      requestCallback,
    );
    return () => {
      removeHttpRequestListener();
      removeTlsRequestListener();
    };
  }
  return listenEvent(nodeServer, "request", requestCallback);
};

const trackServerPendingRequests = (nodeServer, { http2 }) => {
  if (http2) {
    // see http2.js: we rely on https://nodejs.org/api/http2.html#http2_compatibility_api
    return trackHttp1ServerPendingRequests(nodeServer);
  }
  return trackHttp1ServerPendingRequests(nodeServer);
};

const trackHttp1ServerPendingRequests = (nodeServer) => {
  const pendingClients = new Set();

  const removeRequestListener = listenRequest(
    nodeServer,
    (nodeRequest, nodeResponse) => {
      const client = { nodeRequest, nodeResponse };
      pendingClients.add(client);
      nodeResponse.once("close", () => {
        pendingClients.delete(client);
      });
    },
  );

  const stop = async ({ status, reason }) => {
    removeRequestListener();
    const pendingClientsArray = Array.from(pendingClients);
    pendingClients.clear();
    await Promise.all(
      pendingClientsArray.map(({ nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          nodeResponse.writeHead(status, String(reason));
        }

        // http2
        if (nodeResponse.close) {
          return new Promise((resolve, reject) => {
            if (nodeResponse.closed) {
              resolve();
            } else {
              nodeResponse.close((error) => {
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
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve();
          } else {
            nodeResponse.once("close", () => {
              resolve();
            });
            nodeResponse.destroy();
          }
        });
      }),
    );
  };

  return { stop };
};

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}

const createObservable = (producer) => {
  if (typeof producer !== "function") {
    throw new TypeError(`producer must be a function, got ${producer}`);
  }

  const observable = {
    [Symbol.observable]: () => observable,
    subscribe: ({
      next = () => {},
      error = (value) => {
        throw value;
      },
      complete = () => {},
    }) => {
      let cleanup = () => {};
      const subscription = {
        closed: false,
        unsubscribe: () => {
          subscription.closed = true;
          cleanup();
        },
      };

      const producerReturnValue = producer({
        next: (value) => {
          if (subscription.closed) return;
          next(value);
        },
        error: (value) => {
          if (subscription.closed) return;
          error(value);
        },
        complete: () => {
          if (subscription.closed) return;
          complete();
        },
      });
      if (typeof producerReturnValue === "function") {
        cleanup = producerReturnValue;
      }
      return subscription;
    },
  };

  return observable;
};

const isObservable = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "object" || typeof value === "function") {
    return Symbol.observable in value;
  }

  return false;
};

const observableFromValue = (value) => {
  if (isObservable(value)) {
    return value;
  }

  return createObservable(({ next, complete }) => {
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

const observableFromNodeStream = (
  nodeStream,
  {
    readableStreamLifetime = 120_000, // 2s
  } = {},
) => {
  const observable = createObservable(({ next, error, complete }) => {
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
    nodeStream.on("data", (data) => {
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
      process.emitWarning(
        `Readable stream not used after ${
          readableStreamLifetime / 1000
        } seconds. It will be destroyed to release resources`,
        {
          CODE: "READABLE_STREAM_TIMEOUT",
          // url is for http client request
          detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
        },
      );
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

const normalizeHeaderName = (headerName) => {
  headerName = String(headerName);
  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

const normalizeHeaderValue = (headerValue) => {
  return String(headerValue);
};

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/


const headersFromObject = (headersObject) => {
  const headers = {};

  Object.keys(headersObject).forEach((headerName) => {
    if (headerName[0] === ":") {
      // exclude http2 headers
      return;
    }
    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(
      headersObject[headerName],
    );
  });

  return headers;
};

const fromNodeRequest = (
  nodeRequest,
  { serverOrigin, signal, requestBodyLifetime },
) => {
  const headers = headersFromObject(nodeRequest.headers);
  const body = observableFromNodeStream(nodeRequest, {
    readableStreamLifetime: requestBodyLifetime,
  });

  let requestOrigin;
  if (nodeRequest.upgrade) {
    requestOrigin = serverOrigin;
  } else if (nodeRequest.authority) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.authority}`
      : `http://${nodeRequest.authority}`;
  } else if (nodeRequest.headers.host) {
    requestOrigin = nodeRequest.connection.encrypted
      ? `https://${nodeRequest.headers.host}`
      : `http://${nodeRequest.headers.host}`;
  } else {
    requestOrigin = serverOrigin;
  }

  return Object.freeze({
    signal,
    http2: Boolean(nodeRequest.stream),
    origin: requestOrigin,
    ...getPropertiesFromResource({
      resource: nodeRequest.url,
      baseUrl: requestOrigin,
    }),
    method: nodeRequest.method,
    headers,
    body,
  });
};

const applyRedirectionToRequest = (
  request,
  { resource, pathname, ...rest },
) => {
  return {
    ...request,
    ...(resource
      ? getPropertiesFromResource({
          resource,
          baseUrl: request.url,
        })
      : pathname
      ? getPropertiesFromPathname({
          pathname,
          baseUrl: request.url,
        })
      : {}),
    ...rest,
  };
};

const getPropertiesFromResource = ({ resource, baseUrl }) => {
  const urlObject = new URL(resource, baseUrl);
  let pathname = urlObject.pathname;

  return {
    url: String(urlObject),
    searchParams: urlObject.searchParams,
    pathname,
    resource,
  };
};

const getPropertiesFromPathname = ({ pathname, baseUrl }) => {
  return getPropertiesFromResource({
    resource: `${pathname}${new URL(baseUrl).search}`,
    baseUrl,
  });
};

const createPushRequest = (request, { signal, pathname, method }) => {
  const pushRequest = Object.freeze({
    ...request,
    parent: request,
    signal,
    http2: true,
    ...(pathname
      ? getPropertiesFromPathname({
          pathname,
          baseUrl: request.url,
        })
      : {}),
    method: method || request.method,
    headers: getHeadersInheritedByPushRequest(request),
    body: undefined,
  });
  return pushRequest;
};

const getHeadersInheritedByPushRequest = (request) => {
  const headersInherited = { ...request.headers };
  // mtime sent by the client in request headers concerns the main request
  // Time remains valid for request to other resources so we keep it
  // in child requests
  // delete childHeaders["if-modified-since"]

  // eTag sent by the client in request headers concerns the main request
  // A request made to an other resource must not inherit the eTag
  delete headersInherited["if-none-match"];

  return headersInherited;
};

const normalizeBodyMethods = (body) => {
  if (isObservable(body)) {
    return {
      asObservable: () => body,
      destroy: () => {},
    };
  }

  if (isFileHandle(body)) {
    return {
      asObservable: () => fileHandleToObservable(body),
      destroy: () => {
        body.close();
      },
    };
  }

  if (isNodeStream(body)) {
    return {
      asObservable: () => observableFromNodeStream(body),
      destroy: () => {
        body.destroy();
      },
    };
  }

  return {
    asObservable: () => observableFromValue(body),
    destroy: () => {},
  };
};

const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};

const fileHandleToReadableStream = (fileHandle) => {
  const fileReadableStream =
    typeof fileHandle.createReadStream === "function"
      ? fileHandle.createReadStream()
      : createReadStream(
          "/toto", // is it ok to pass a fake path like this?
          {
            fd: fileHandle.fd,
            emitClose: true,
            // autoClose: true
          },
        );
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream;
};

const fileHandleToObservable = (fileHandle) => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};

const isNodeStream = (value) => {
  if (value === undefined) {
    return false;
  }

  if (
    value instanceof Stream ||
    value instanceof Writable ||
    value instanceof Readable
  ) {
    return true;
  }

  return false;
};

const writeNodeResponse = async (
  responseStream,
  { status, statusText, headers, body, bodyEncoding },
  { signal, ignoreBody, onAbort, onError, onHeadersSent, onEnd } = {},
) => {
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
    onHeadersSent,
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

  await new Promise((resolve) => {
    const observable = bodyMethods.asObservable();
    const subscription = observable.subscribe({
      next: (data) => {
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
      error: (value) => {
        responseStream.emit("error", value);
      },
      complete: () => {
        responseStream.end();
      },
    });

    raceCallbacks(
      {
        abort: (cb) => {
          signal.addEventListener("abort", cb);
          return () => {
            signal.removeEventListener("abort", cb);
          };
        },
        error: (cb) => {
          responseStream.on("error", cb);
          return () => {
            responseStream.removeListener("error", cb);
          };
        },
        close: (cb) => {
          responseStream.on("close", cb);
          return () => {
            responseStream.removeListener("close", cb);
          };
        },
        finish: (cb) => {
          responseStream.on("finish", cb);
          return () => {
            responseStream.removeListener("finish", cb);
          };
        },
      },
      (winner) => {
        const raceEffects = {
          abort: () => {
            subscription.unsubscribe();
            responseStream.destroy();
            onAbort();
            resolve();
          },
          error: (error) => {
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
          },
        };
        raceEffects[winner.name](winner.data);
      },
    );
  });
};

const writeHead = (
  responseStream,
  { status, statusText, headers, onHeadersSent },
) => {
  const responseIsHttp2ServerResponse =
    responseStream instanceof Http2ServerResponse;
  const responseIsServerHttp2Stream =
    responseStream.constructor.name === "ServerHttp2Stream";
  let nodeHeaders = headersToNodeHeaders(headers, {
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L112
    ignoreConnectionHeader:
      responseIsHttp2ServerResponse || responseIsServerHttp2Stream,
  });
  if (statusText === undefined) {
    statusText = statusTextFromStatus(status);
  }
  if (responseIsServerHttp2Stream) {
    nodeHeaders = {
      ...nodeHeaders,
      ":status": status,
    };
    responseStream.respond(nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (
    // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
    responseIsHttp2ServerResponse
  ) {
    responseStream.writeHead(status, nodeHeaders);
    onHeadersSent({ nodeHeaders, status, statusText });
    return;
  }

  try {
    responseStream.writeHead(status, statusText, nodeHeaders);
  } catch (e) {
    if (
      e.code === "ERR_INVALID_CHAR" &&
      e.message.includes("Invalid character in statusMessage")
    ) {
      throw new Error(`Invalid character in statusMessage
--- status message ---
${statusText}`);
    }
    throw e;
  }
  onHeadersSent({ nodeHeaders, status, statusText });
};

const statusTextFromStatus = (status) =>
  http.STATUS_CODES[status] || "not specified";

const headersToNodeHeaders = (headers, { ignoreConnectionHeader }) => {
  const nodeHeaders = {};

  Object.keys(headers).forEach((name) => {
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

const colorizeResponseStatus = (status) => {
  const statusType = statusToType(status);
  if (statusType === "information") return `${cyan}${status}${close}`;
  if (statusType === "success") return `${green}${status}${close}`;
  if (statusType === "redirection") return `${magenta}${status}${close}`;
  if (statusType === "client_error") return `${yellow}${status}${close}`;
  if (statusType === "server_error") return `${red}${status}${close}`;
  return status;
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const statusToType = (status) => {
  if (statusIsInformation(status)) return "information";
  if (statusIsSuccess(status)) return "success";
  if (statusIsRedirection(status)) return "redirection";
  if (statusIsClientError(status)) return "client_error";
  if (statusIsServerError(status)) return "server_error";
  return "unknown";
};

const statusIsInformation = (status) => status >= 100 && status < 200;

const statusIsSuccess = (status) => status >= 200 && status < 300;

const statusIsRedirection = (status) => status >= 300 && status < 400;

const statusIsClientError = (status) => status >= 400 && status < 500;

const statusIsServerError = (status) => status >= 500 && status < 600;

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname,
}) => {
  const listeningOperation = Abort.startOperation();

  try {
    listeningOperation.addAbortSignal(signal);

    if (portHint) {
      listeningOperation.throwIfAborted();
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname,
      });
    }
    listeningOperation.throwIfAborted();
    port = await startListening({ server, port, hostname });
    listeningOperation.addAbortCallback(() => stopListening(server));
    listeningOperation.throwIfAborted();

    return port;
  } finally {
    await listeningOperation.end();
  }
};

const findFreePort = async (
  initialPort = 1,
  {
    signal = new AbortController().signal,
    hostname = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
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
        throw new Error(
          `${hostname} has no available port between ${min} and ${max}`,
        );
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
      hostname,
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

const startListening = ({ server, port, hostname }) => {
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

const stopListening = (server) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("close", resolve);
    server.close();
  });
};

const composeTwoObjects = (
  firstObject,
  secondObject,
  { keysComposition, strict = false, forceLowerCase = false } = {},
) => {
  if (forceLowerCase) {
    return applyCompositionForcingLowerCase(firstObject, secondObject, {
      keysComposition,
      strict,
    });
  }

  return applyCaseSensitiveComposition(firstObject, secondObject, {
    keysComposition,
    strict,
  });
};

const applyCaseSensitiveComposition = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const composed = {};
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: keyExistsIn(key, firstObject) ? key : null,
        secondKey: keyExistsIn(key, secondObject) ? key : null,
      });
    });
    return composed;
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    composed[key] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key,
      firstKey: keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(key, secondObject) ? key : null,
    });
  });
  return composed;
};

const applyCompositionForcingLowerCase = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const firstObjectKeyMapping = {};
    Object.keys(firstObject).forEach((key) => {
      firstObjectKeyMapping[key.toLowerCase()] = key;
    });
    const secondObjectKeyMapping = {};
    Object.keys(secondObject).forEach((key) => {
      secondObjectKeyMapping[key.toLowerCase()] = key;
    });
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: firstObjectKeyMapping[key] || null,
        secondKey: secondObjectKeyMapping[key] || null,
      });
    });
  }

  const composed = {};
  Object.keys(firstObject).forEach((key) => {
    composed[key.toLowerCase()] = firstObject[key];
  });
  Object.keys(secondObject).forEach((key) => {
    const keyLowercased = key.toLowerCase();

    composed[key.toLowerCase()] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key: keyLowercased,
      firstKey: keyExistsIn(keyLowercased, firstObject)
        ? keyLowercased
        : keyExistsIn(key, firstObject)
        ? key
        : null,
      secondKey: keyExistsIn(keyLowercased, secondObject)
        ? keyLowercased
        : keyExistsIn(key, secondObject)
        ? key
        : null,
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
  keysComposition,
}) => {
  if (!firstKey) {
    return secondObject[secondKey];
  }

  if (!secondKey) {
    return firstObject[firstKey];
  }

  const keyForCustomComposition = keyExistsIn(key, keysComposition)
    ? key
    : null;
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
    forceLowerCase: true,
  });
};

const composeHeaderValues = (value, nextValue) => {
  const headerValues = value.split(", ");
  nextValue.split(", ").forEach((value) => {
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
  "vary": composeHeaderValues,
};

const composeTwoResponses = (firstResponse, secondResponse) => {
  return composeTwoObjects(firstResponse, secondResponse, {
    keysComposition: RESPONSE_KEYS_COMPOSITION,
    strict: true,
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
    return { ...prevTiming, ...timing };
  },
};

const listenServerConnectionError = (
  nodeServer,
  connectionErrorCallback,
  { ignoreErrorAfterConnectionIsDestroyed = true } = {},
) => {
  const cleanupSet = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (socket) => {
      const removeSocketErrorListener = listenEvent(
        socket,
        "error",
        (error) => {
          if (ignoreErrorAfterConnectionIsDestroyed && socket.destroyed) {
            return;
          }
          connectionErrorCallback(error, socket);
        },
      );
      const removeOnceSocketCloseListener = listenEvent(
        socket,
        "close",
        () => {
          removeSocketErrorListener();
          cleanupSet.delete(cleanup);
        },
        {
          once: true,
        },
      );
      const cleanup = () => {
        removeSocketErrorListener();
        removeOnceSocketCloseListener();
      };
      cleanupSet.add(cleanup);
    },
  );
  return () => {
    removeConnectionListener();
    cleanupSet.forEach((cleanup) => {
      cleanup();
    });
    cleanupSet.clear();
  };
};

const createReason = (reasonString) => {
  return {
    toString: () => reasonString,
  };
};

const STOP_REASON_INTERNAL_ERROR = createReason("Internal error");
const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP");
const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM");
const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason(
  "process before exit",
);
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
    getFirstInternalIp: ({ preferIpv6 }) => {
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
    getFirstExternalIp: ({ preferIpv6 }) => {
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
    },
  };
};

const isIpV4 = (networkAddress) => {
  // node 18.5
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4;
  }
  return networkAddress.family === "IPv4";
};

const isIpV6 = (networkAddress) => !isIpV4(networkAddress);

const parseHostname = (hostname) => {
  if (hostname === "0.0.0.0") {
    return {
      type: "ip",
      label: "unspecified",
      version: 4,
    };
  }
  if (
    hostname === "::" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0000"
  ) {
    return {
      type: "ip",
      label: "unspecified",
      version: 6,
    };
  }
  if (hostname === "127.0.0.1") {
    return {
      type: "ip",
      label: "loopback",
      version: 4,
    };
  }
  if (
    hostname === "::1" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
  ) {
    return {
      type: "ip",
      label: "loopback",
      version: 6,
    };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 0) {
    return {
      type: "hostname",
    };
  }
  return {
    type: "ip",
    version: ipVersion,
  };
};

const applyDnsResolution = async (
  hostname,
  { verbatim = false } = {},
) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, { verbatim }, (error, address, family) => {
      if (error) {
        reject(error);
      } else {
        resolve({ address, family });
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
  port = 0, // assign a random available port
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
  requestWaitingCallback = ({ request, warn, requestWaitingMs }) => {
    warn(
      createDetailedMessage$1(
        `still no response found for request after ${requestWaitingMs} ms`,
        {
          "request url": request.url,
          "request headers": JSON.stringify(request.headers, null, "  "),
        },
      ),
    );
  },
  // timeAllocated to start responding to a request
  // after this delay the server will respond with 504
  responseTimeout = 60_000 * 10, // 10s
  // time allocated to server code to start reading the request body
  // after this delay the underlying stream is destroyed, attempting to read it would throw
  // if used the stream stays opened, it's only if the stream is not read at all that it gets destroyed
  requestBodyLifetime = 60_000 * 2, // 2s
  ...rest
} = {}) => {
  // param validations
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    if (https) {
      if (typeof https !== "object") {
        throw new TypeError(`https must be an object, got ${https}`);
      }
      const { certificate, privateKey } = https;
      if (!certificate || !privateKey) {
        throw new TypeError(
          `https must be an object with { certificate, privateKey }`,
        );
      }
    }
    if (http2 && !https) {
      throw new Error(`http2 needs https`);
    }
  }
  const logger = createLogger({ logLevel });
  // param warnings and normalization
  {
    if (
      redirectHttpToHttps === undefined &&
      https &&
      !allowHttpRequestOnHttps
    ) {
      redirectHttpToHttps = true;
    }
    if (redirectHttpToHttps && !https) {
      logger.warn(`redirectHttpToHttps ignored because protocol is http`);
      redirectHttpToHttps = false;
    }
    if (allowHttpRequestOnHttps && redirectHttpToHttps) {
      logger.warn(
        `redirectHttpToHttps ignored because allowHttpRequestOnHttps is enabled`,
      );
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
    exit: stopOnExit,
  };

  let status = "starting";
  let nodeServer;
  const startServerOperation = Abort.startOperation();
  const stopCallbackList = createCallbackListNotifiedOnce();
  const serverOrigins = {
    local: "", // favors hostname when possible
  };

  try {
    startServerOperation.addAbortSignal(signal);
    startServerOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(processTeardownEvents, ({ name }) => {
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
      http1Allowed,
    });
    startServerOperation.throwIfAborted();

    // https://nodejs.org/api/net.html#net_server_unref
    if (!keepProcessAlive) {
      nodeServer.unref();
    }

    const createOrigin = (hostname) => {
      const protocol = https ? "https" : "http";
      if (isIP(hostname) === 6) {
        return `${protocol}://[${hostname}]`;
      }
      return `${protocol}://${hostname}`;
    };

    const ipGetters = createIpGetters();
    let hostnameToListen;
    if (acceptAnyIp) {
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
      serverOrigins.externalip = createOrigin(firstExternalIp);
      hostnameToListen = preferIpv6 ? "::" : "0.0.0.0";
    } else {
      hostnameToListen = hostname;
    }
    const hostnameInfo = parseHostname(hostname);
    if (hostnameInfo.type === "ip") {
      if (acceptAnyIp) {
        throw new Error(
          `hostname cannot be an ip when acceptAnyIp is enabled, got ${hostname}`,
        );
      }

      preferIpv6 = hostnameInfo.version === 6;
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      serverOrigins.local = createOrigin(firstInternalIp);
      serverOrigins.localip = createOrigin(firstInternalIp);
      if (hostnameInfo.label === "unspecified") {
        const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
        serverOrigins.externalip = createOrigin(firstExternalIp);
      } else if (hostnameInfo.label === "loopback") {
        // nothing
      } else {
        serverOrigins.local = createOrigin(hostname);
      }
    } else {
      const hostnameDnsResolution = await applyDnsResolution(hostname, {
        verbatim: true,
      });
      if (hostnameDnsResolution) {
        const hostnameIp = hostnameDnsResolution.address;
        serverOrigins.localip = createOrigin(hostnameIp);
        serverOrigins.local = createOrigin(hostname);
      } else {
        const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
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
      hostname: hostnameToListen,
    });

    // normalize origins (remove :80 when port is 80 for instance)
    Object.keys(serverOrigins).forEach((key) => {
      serverOrigins[key] = new URL(`${serverOrigins[key]}:${port}`).origin;
    });

    serviceController.callHooks("serverListening", { port });
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
  stopCallbackList.add(({ reason }) => {
    logger.info(`${serverName} stopping server (reason: ${reason})`);
  });
  stopCallbackList.add(async () => {
    await stopListening(nodeServer);
  });
  let stoppedResolve;
  const stoppedPromise = new Promise((resolve) => {
    stoppedResolve = resolve;
  });
  const stop = memoize(async (reason = STOP_REASON_NOT_SPECIFIED) => {
    status = "stopping";
    await Promise.all(stopCallbackList.notify({ reason }));
    serviceController.callHooks("serverStopped", { reason });
    status = "stopped";
    stoppedResolve(reason);
  });

  const cancelProcessTeardownRace = raceProcessTeardownEvents(
    processTeardownEvents,
    (winner) => {
      stop(PROCESS_TEARDOWN_EVENTS_MAP[winner.name]);
    },
  );
  stopCallbackList.add(cancelProcessTeardownRace);

  const onError = (error) => {
    if (status === "stopping" && error.code === "ECONNRESET") {
      return;
    }
    throw error;
  };

  status = "opened";

  const removeConnectionErrorListener = listenServerConnectionError(
    nodeServer,
    onError,
  );
  stopCallbackList.add(removeConnectionErrorListener);

  const connectionsTracker = trackServerPendingConnections(nodeServer, {
    http2,
  });
  // opened connection must be shutdown before the close event is emitted
  stopCallbackList.add(connectionsTracker.stop);

  const pendingRequestsTracker = trackServerPendingRequests(nodeServer, {
    http2,
  });
  // ensure pending requests got a response from the server
  stopCallbackList.add((reason) => {
    pendingRequestsTracker.stop({
      status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
      reason,
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
          location: `${serverOrigin}${nodeRequest.url}`,
        });
        nodeResponse.end();
        return;
      }

      const receiveRequestOperation = Abort.startOperation();
      receiveRequestOperation.addAbortSource((abort) => {
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
      receiveRequestOperation.addAbortSource((abort) => {
        return stopCallbackList.add(abort);
      });

      const sendResponseOperation = Abort.startOperation();
      sendResponseOperation.addAbortSignal(receiveRequestOperation.signal);
      sendResponseOperation.addAbortSource((abort) => {
        return stopCallbackList.add(abort);
      });

      const request = fromNodeRequest(nodeRequest, {
        serverOrigin,
        signal: receiveRequestOperation.signal,
      });

      // Handling request is asynchronous, we buffer logs for that request
      // until we know what happens with that request
      // It delays logs until we know of the request will be handled
      // but it's mandatory to make logs readable.
      const rootRequestNode = {
        logs: [],
        children: [],
      };
      const addRequestLog = (node, { type, value }) => {
        node.logs.push({ type, value });
      };
      const onRequestHandled = (node) => {
        if (node !== rootRequestNode) {
          // keep buffering until root request write logs for everyone
          return;
        }
        const prefixLines = (string, prefix) => {
          return string.replace(/^(?!\s*$)/gm, prefix);
        };
        const writeLog = (
          { type, value },
          { someLogIsError, someLogIsWarn, depth },
        ) => {
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
          requestNode.logs.forEach((log) => {
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

          writeLog(firstLog, { someLogIsError, someLogIsWarn, depth });
          middleLogs.forEach((log) => {
            writeLog(log, { someLogIsError, someLogIsWarn, depth });
          });
          requestNode.children.forEach((child) => {
            visitRequestNodeToLog(child, depth + 1);
          });
          if (lastLog) {
            writeLog(lastLog, {
              someLogIsError,
              someLogIsWarn,
              depth: depth + 1,
            });
          }
        };
        visitRequestNodeToLog(rootRequestNode, 0);
      };
      nodeRequest.on("error", (error) => {
        if (error.message === "aborted") {
          addRequestLog(rootRequestNode, {
            type: "debug",
            value: createDetailedMessage$1(`request aborted by client`, {
              "error message": error.message,
            }),
          });
        } else {
          // I'm not sure this can happen but it's here in case
          addRequestLog(rootRequestNode, {
            type: "error",
            value: createDetailedMessage$1(`"error" event emitted on request`, {
              "error stack": error.stack,
            }),
          });
        }
      });

      const pushResponse = async ({ path, method }, { requestNode }) => {
        const http2Stream = nodeResponse.stream;

        // being able to push a stream is nice to have
        // so when it fails it's not critical
        const onPushStreamError = (e) => {
          addRequestLog(requestNode, {
            type: "error",
            value: createDetailedMessage$1(
              `An error occured while pushing a stream to the response for ${request.resource}`,
              {
                "error stack": e.stack,
              },
            ),
          });
        };

        // not aborted, let's try to push a stream into that response
        // https://nodejs.org/docs/latest-v16.x/api/http2.html#http2streampushstreamheaders-options-callback
        let pushStream;
        try {
          pushStream = await new Promise((resolve, reject) => {
            http2Stream.pushStream(
              {
                ":path": path,
                ...(method ? { ":method": method } : {}),
              },
              async (
                error,
                pushStream,
                // headers
              ) => {
                if (error) {
                  reject(error);
                }
                resolve(pushStream);
              },
            );
          });
        } catch (e) {
          onPushStreamError(e);
          return;
        }

        const abortController = new AbortController();
        // It's possible to get NGHTTP2_REFUSED_STREAM errors here
        // https://github.com/nodejs/node/issues/20824
        const pushErrorCallback = (error) => {
          onPushStreamError(error);
          abortController.abort();
        };
        pushStream.on("error", pushErrorCallback);
        sendResponseOperation.addEndCallback(() => {
          pushStream.removeListener("error", onPushStreamError);
        });

        await sendResponseOperation.withSignal(async (signal) => {
          const pushResponseOperation = Abort.startOperation();
          pushResponseOperation.addAbortSignal(signal);
          pushResponseOperation.addAbortSignal(abortController.signal);

          const pushRequest = createPushRequest(request, {
            signal: pushResponseOperation.signal,
            pathname: path,
            method,
          });

          try {
            const responseProperties = await handleRequest(pushRequest, {
              requestNode,
            });
            if (!abortController.signal.aborted) {
              if (pushStream.destroyed) {
                abortController.abort();
              } else if (!http2Stream.pushAllowed) {
                abortController.abort();
              } else if (responseProperties.requestAborted) {
              } else {
                const responseLength =
                  responseProperties.headers["content-length"] || 0;
                const { effectiveRecvDataLength, remoteWindowSize } =
                  http2Stream.session.state;
                if (
                  effectiveRecvDataLength + responseLength >
                  remoteWindowSize
                ) {
                  addRequestLog(requestNode, {
                    type: "debug",
                    value: `Aborting stream to prevent exceeding remoteWindowSize`,
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
              responseProperties,
            });
          } finally {
            await pushResponseOperation.end();
          }
        });
      };

      const handleRequest = async (request, { requestNode }) => {
        let requestReceivedMeasure;
        if (serverTiming) {
          requestReceivedMeasure = performance.now();
        }
        addRequestLog(requestNode, {
          type: "info",
          value: request.parent
            ? `Push ${request.resource}`
            : `${request.method} ${request.url}`,
        });
        const warn = (value) => {
          addRequestLog(requestNode, {
            type: "warn",
            value,
          });
        };

        let requestWaitingTimeout;
        if (requestWaitingMs) {
          requestWaitingTimeout = setTimeout(
            () => requestWaitingCallback({ request, warn, requestWaitingMs }),
            requestWaitingMs,
          ).unref();
        }

        serviceController.callHooks(
          "redirectRequest",
          request,
          { warn },
          (newRequestProperties) => {
            if (newRequestProperties) {
              request = applyRedirectionToRequest(request, {
                original: request.original || request,
                previous: request,
                ...newRequestProperties,
              });
            }
          },
        );

        let handleRequestReturnValue;
        let errorWhileHandlingRequest = null;
        let handleRequestTimings = serverTiming ? {} : null;

        let timeout;
        const timeoutPromise = new Promise((resolve) => {
          timeout = setTimeout(() => {
            resolve({
              // the correct status code should be 500 because it's
              // we don't really know what takes time
              // in practice it's often because server is trying to reach an other server
              // that is not responding so 504 is more correct
              status: 504,
              statusText: `server timeout after ${
                responseTimeout / 1000
              }s waiting to handle request`,
            });
          }, responseTimeout);
        });
        const handleRequestPromise = serviceController.callAsyncHooksUntil(
          "handleRequest",
          request,
          {
            timing: handleRequestTimings,
            warn,
            pushResponse: async ({ path, method }) => {
              if (typeof path !== "string" || path[0] !== "/") {
                addRequestLog(requestNode, {
                  type: "warn",
                  value: `response push ignored because path is invalid (must be a string starting with "/", found ${path})`,
                });
                return;
              }
              if (!request.http2) {
                addRequestLog(requestNode, {
                  type: "warn",
                  value: `response push ignored because request is not http2`,
                });
                return;
              }
              const canPushStream = testCanPushStream(nodeResponse.stream);
              if (!canPushStream.can) {
                addRequestLog(requestNode, {
                  type: "debug",
                  value: `response push ignored because ${canPushStream.reason}`,
                });
                return;
              }

              let preventedByService = null;
              const prevent = () => {
                preventedByService = serviceController.getCurrentService();
              };
              serviceController.callHooksUntil(
                "onResponsePush",
                { path, method },
                {
                  request,
                  warn,
                  prevent,
                },
                () => preventedByService,
              );
              if (preventedByService) {
                addRequestLog(requestNode, {
                  type: "debug",
                  value: `response push prevented by "${preventedByService.name}" service`,
                });
                return;
              }

              const requestChildNode = { logs: [], children: [] };
              requestNode.children.push(requestChildNode);
              await pushResponse(
                { path, method },
                {
                  requestNode: requestChildNode,
                  parentHttp2Stream: nodeResponse.stream,
                },
              );
            },
          },
        );
        try {
          handleRequestReturnValue = await Promise.race([
            timeoutPromise,
            handleRequestPromise,
          ]);
        } catch (e) {
          errorWhileHandlingRequest = e;
        }
        clearTimeout(timeout);

        let responseProperties;
        if (errorWhileHandlingRequest) {
          if (
            errorWhileHandlingRequest.name === "AbortError" &&
            request.signal.aborted
          ) {
            responseProperties = { requestAborted: true };
          } else {
            // internal error, create 500 response
            if (
              // stopOnInternalError stops server only if requestToResponse generated
              // a non controlled error (internal error).
              // if requestToResponse gracefully produced a 500 response (it did not throw)
              // then we can assume we are still in control of what we are doing
              stopOnInternalError
            ) {
              // il faudrais pouvoir stop que les autres response ?
              stop(STOP_REASON_INTERNAL_ERROR);
            }
            const handleErrorReturnValue =
              await serviceController.callAsyncHooksUntil(
                "handleError",
                errorWhileHandlingRequest,
                {
                  request,
                  warn,
                },
              );
            if (!handleErrorReturnValue) {
              throw errorWhileHandlingRequest;
            }
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage$1(
                `internal error while handling request`,
                {
                  "error stack": errorWhileHandlingRequest.stack,
                },
              ),
            });
            responseProperties = composeTwoResponses(
              {
                status: 500,
                statusText: "Internal Server Error",
                headers: {
                  // ensure error are not cached
                  "cache-control": "no-store",
                  "content-type": "text/plain",
                },
              },
              handleErrorReturnValue,
            );
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
            ...rest,
          };
        }

        if (serverTiming) {
          const responseReadyMeasure = performance.now();
          const timeToStartResponding =
            responseReadyMeasure - requestReceivedMeasure;
          const serverTiming = {
            ...handleRequestTimings,
            ...responseProperties.timing,
            "time to start responding": timeToStartResponding,
          };
          responseProperties.headers = composeTwoHeaders(
            responseProperties.headers,
            timingToServerTimingResponseHeaders(serverTiming),
          );
        }
        if (requestWaitingMs) {
          clearTimeout(requestWaitingTimeout);
        }
        if (
          request.method !== "HEAD" &&
          responseProperties.headers["content-length"] > 0 &&
          !responseProperties.body
        ) {
          addRequestLog(requestNode, {
            type: "warn",
            value: `content-length header is ${responseProperties.headers["content-length"]} but body is empty`,
          });
        }
        serviceController.callHooks(
          "injectResponseHeaders",
          responseProperties,
          {
            request,
            warn,
          },
          (returnValue) => {
            if (returnValue) {
              responseProperties.headers = composeTwoHeaders(
                responseProperties.headers,
                returnValue,
              );
            }
          },
        );
        serviceController.callHooks("responseReady", responseProperties, {
          request,
          warn,
        });
        return responseProperties;
      };

      const sendResponse = async ({
        signal,
        request,
        requestNode,
        responseStream,
        responseProperties,
      }) => {
        // When "pushResponse" is called and the parent response has no body
        // the parent response is immediatly ended. It means child responses (pushed streams)
        // won't get a chance to be pushed.
        // To let a chance to pushed streams we wait a little before sending the response
        const ignoreBody = request.method === "HEAD";
        const bodyIsEmpty = !responseProperties.body || ignoreBody;
        if (bodyIsEmpty && requestNode.children.length > 0) {
          await new Promise((resolve) => setTimeout(resolve));
        }

        await writeNodeResponse(responseStream, responseProperties, {
          signal,
          ignoreBody,
          onAbort: () => {
            addRequestLog(requestNode, {
              type: "info",
              value: `response aborted`,
            });
            onRequestHandled(requestNode);
          },
          onError: (error) => {
            addRequestLog(requestNode, {
              type: "error",
              value: createDetailedMessage$1(
                `An error occured while sending response`,
                {
                  "error stack": error.stack,
                },
              ),
            });
            onRequestHandled(requestNode);
          },
          onHeadersSent: ({ status, statusText }) => {
            const statusType = statusToType(status);
            addRequestLog(requestNode, {
              type:
                status === 404 && request.pathname === "/favicon.ico"
                  ? "debug"
                  : {
                      information: "info",
                      success: "info",
                      redirection: "info",
                      client_error: "warn",
                      server_error: "error",
                    }[statusType],
              value: `${colorizeResponseStatus(status)} ${
                responseProperties.statusMessage || statusText
              }`,
            });
          },
          onEnd: () => {
            onRequestHandled(requestNode);
          },
        });
      };

      try {
        if (receiveRequestOperation.signal.aborted) {
          return;
        }
        const responseProperties = await handleRequest(request, {
          requestNode: rootRequestNode,
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
          responseProperties,
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
    serviceController.services.forEach((service) => {
      const { handleWebsocket } = service;
      if (handleWebsocket) {
        websocketHandlers.push(handleWebsocket);
      }
    });
    if (websocketHandlers.length > 0) {
      const websocketClients = new Set();
      const { WebSocketServer } = await import("./js/ws.js");
      let websocketServer = new WebSocketServer({ noServer: true });
      const websocketOrigin = https
        ? `wss://${hostname}:${port}`
        : `ws://${hostname}:${port}`;
      server.websocketOrigin = websocketOrigin;
      const upgradeCallback = (nodeRequest, socket, head) => {
        websocketServer.handleUpgrade(
          nodeRequest,
          socket,
          head,
          async (websocket) => {
            websocketClients.add(websocket);
            websocket.once("close", () => {
              websocketClients.delete(websocket);
            });
            const request = fromNodeRequest(nodeRequest, {
              serverOrigin: websocketOrigin,
              signal: new AbortController().signal,
              requestBodyLifetime,
            });
            serviceController.callAsyncHooksUntil(
              "handleWebsocket",
              websocket,
              {
                request,
              },
            );
          },
        );
      };

      // see server-polyglot.js, upgrade must be listened on https server when used
      const facadeServer = nodeServer._tlsServer || nodeServer;
      const removeUpgradeCallback = listenEvent(
        facadeServer,
        "upgrade",
        upgradeCallback,
      );
      stopCallbackList.add(removeUpgradeCallback);
      stopCallbackList.add(() => {
        websocketClients.forEach((websocketClient) => {
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
      logger.info(
        `${serverName} started at ${serverOrigins.local} (${serverOrigins.network})`,
      );
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
    addEffect: (callback) => {
      const cleanup = callback();
      if (typeof cleanup === "function") {
        stopCallbackList.add(cleanup);
      }
    },
  });
  return server;
};

const createNodeServer = async ({
  https,
  redirectHttpToHttps,
  allowHttpRequestOnHttps,
  http2,
  http1Allowed,
}) => {
  if (https) {
    const { certificate, privateKey } = https;
    if (redirectHttpToHttps || allowHttpRequestOnHttps) {
      return createPolyglotServer({
        certificate,
        privateKey,
        http2,
        http1Allowed,
      });
    }
    const { createServer } = await import("node:https");
    return createServer({
      cert: certificate,
      key: privateKey,
    });
  }
  const { createServer } = await import("node:http");
  return createServer();
};

const testCanPushStream = (http2Stream) => {
  if (!http2Stream.pushAllowed) {
    return {
      can: false,
      reason: `stream.pushAllowed is false`,
    };
  }

  // See https://nodejs.org/dist/latest-v16.x/docs/api/http2.html#http2sessionstate
  // And https://github.com/google/node-h2-auto-push/blob/67a36c04cbbd6da7b066a4e8d361c593d38853a4/src/index.ts#L100-L106
  const { remoteWindowSize } = http2Stream.session.state;
  if (remoteWindowSize === 0) {
    return {
      can: false,
      reason: `no more remoteWindowSize`,
    };
  }

  return {
    can: true,
  };
};

const PROCESS_TEARDOWN_EVENTS_MAP = {
  SIGHUP: STOP_REASON_PROCESS_SIGHUP,
  SIGTERM: STOP_REASON_PROCESS_SIGTERM,
  SIGINT: STOP_REASON_PROCESS_SIGINT,
  beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
  exit: STOP_REASON_PROCESS_EXIT,
};

const mediaTypeInfos = {
  "application/json": {
    extensions: ["json"],
    isTextual: true,
  },
  "application/importmap+json": {
    extensions: ["importmap"],
    isTextual: true,
  },
  "application/manifest+json": {
    extensions: ["webmanifest"],
    isTextual: true,
  },
  "application/octet-stream": {},
  "application/pdf": {
    extensions: ["pdf"],
  },
  "application/xml": {
    extensions: ["xml"],
  },
  "application/x-gzip": {
    extensions: ["gz"],
  },
  "application/wasm": {
    extensions: ["wasm"],
  },
  "application/zip": {
    extensions: ["zip"],
  },
  "audio/basic": {
    extensions: ["au", "snd"],
  },
  "audio/mpeg": {
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"],
  },
  "audio/midi": {
    extensions: ["midi", "mid", "kar", "rmi"],
  },
  "audio/mp4": {
    extensions: ["m4a", "mp4a"],
  },
  "audio/ogg": {
    extensions: ["oga", "ogg", "spx"],
  },
  "audio/webm": {
    extensions: ["weba"],
  },
  "audio/x-wav": {
    extensions: ["wav"],
  },
  "font/ttf": {
    extensions: ["ttf"],
  },
  "font/woff": {
    extensions: ["woff"],
  },
  "font/woff2": {
    extensions: ["woff2"],
  },
  "image/png": {
    extensions: ["png"],
  },
  "image/gif": {
    extensions: ["gif"],
  },
  "image/jpeg": {
    extensions: ["jpg"],
  },
  "image/svg+xml": {
    extensions: ["svg", "svgz"],
    isTextual: true,
  },
  "text/plain": {
    extensions: ["txt"],
  },
  "text/html": {
    extensions: ["html"],
  },
  "text/css": {
    extensions: ["css"],
  },
  "text/javascript": {
    extensions: ["js", "cjs", "mjs", "ts", "jsx", "tsx"],
  },
  "text/x-sass": {
    extensions: ["sass"],
  },
  "text/x-scss": {
    extensions: ["scss"],
  },
  "text/cache-manifest": {
    extensions: ["appcache"],
  },
  "video/mp4": {
    extensions: ["mp4", "mp4v", "mpg4"],
  },
  "video/mpeg": {
    extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"],
  },
  "video/ogg": {
    extensions: ["ogv"],
  },
  "video/webm": {
    extensions: ["webm"],
  },
};

const CONTENT_TYPE = {
  parse: (string) => {
    const [mediaType, charset] = string.split(";");
    return { mediaType: normalizeMediaType(mediaType), charset };
  },

  stringify: ({ mediaType, charset }) => {
    if (charset) {
      return `${mediaType};${charset}`;
    }
    return mediaType;
  },

  asMediaType: (value) => {
    if (typeof value === "string") {
      return CONTENT_TYPE.parse(value).mediaType;
    }
    if (typeof value === "object") {
      return value.mediaType;
    }
    return null;
  },

  isJson: (value) => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    return (
      mediaType === "application/json" ||
      /^application\/\w+\+json$/.test(mediaType)
    );
  },

  isTextual: (value) => {
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

  isBinary: (value) => !CONTENT_TYPE.isTextual(value),

  asFileExtension: (value) => {
    const mediaType = CONTENT_TYPE.asMediaType(value);
    const mediaTypeInfo = mediaTypeInfos[mediaType];
    return mediaTypeInfo ? `.${mediaTypeInfo.extensions[0]}` : "";
  },

  fromUrlExtension: (url) => {
    const { pathname } = new URL(url);
    const extensionWithDot = extname(pathname);
    if (!extensionWithDot || extensionWithDot === ".") {
      return "application/octet-stream";
    }
    const extension = extensionWithDot.slice(1);
    const mediaTypeFound = Object.keys(mediaTypeInfos).find((mediaType) => {
      const mediaTypeInfo = mediaTypeInfos[mediaType];
      return (
        mediaTypeInfo.extensions && mediaTypeInfo.extensions.includes(extension)
      );
    });
    return mediaTypeFound || "application/octet-stream";
  },
};

const normalizeMediaType = (value) => {
  if (value === "application/javascript") {
    return "text/javascript";
  }
  return value;
};

const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }

  if (value[0] === "/") {
    return true;
  }

  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }
  return String(pathToFileURL(value));
};

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';

const bufferToEtag = (buffer) => {
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

const convertFileSystemErrorToResponseProperties = (error) => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: `EACCES: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: `EPERM: No permission to read file at ${error.path}`,
    };
  }
  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: `ENOENT: File not found at ${error.path}`,
    };
  }
  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: `EBUSY: File is busy ${error.path}`,
      headers: {
        "retry-after": 0.01, // retry in 10ms
      },
    };
  }
  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "EMFILE: too many file opened",
      headers: {
        "retry-after": 0.1, // retry in 100ms
      },
    };
  }
  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: `EISDIR: Unexpected directory operation at ${error.path}`,
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
  getAcceptanceScore,
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
  const { headers = {} } = request;
  const requestAcceptEncodingHeader = headers["accept-encoding"];
  if (!requestAcceptEncodingHeader) {
    return null;
  }

  const encodingsAccepted = parseAcceptEncodingHeader(
    requestAcceptEncodingHeader,
  );
  return pickAcceptedContent({
    accepteds: encodingsAccepted,
    availables: availableEncodings,
    getAcceptanceScore: getEncodingAcceptanceScore,
  });
};

const parseAcceptEncodingHeader = (acceptEncodingHeaderString) => {
  const acceptEncodingHeader = parseMultipleHeader(acceptEncodingHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const encodingsAccepted = [];
  Object.keys(acceptEncodingHeader).forEach((key) => {
    const { q = 1 } = acceptEncodingHeader[key];
    const value = key;
    encodingsAccepted.push({
      value,
      quality: q,
    });
  });
  encodingsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return encodingsAccepted;
};

const getEncodingAcceptanceScore = ({ value, quality }, availableEncoding) => {
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
  const { headers = {} } = request;
  const requestAcceptHeader = headers.accept;
  if (!requestAcceptHeader) {
    return null;
  }

  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader);
  return pickAcceptedContent({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore,
  });
};

const parseAcceptHeader = (acceptHeader) => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const accepts = [];
  Object.keys(acceptHeaderObject).forEach((key) => {
    const { q = 1 } = acceptHeaderObject[key];
    const value = key;
    accepts.push({
      value,
      quality: q,
    });
  });
  accepts.sort((a, b) => {
    return b.quality - a.quality;
  });
  return accepts;
};

const getContentTypeAcceptanceScore = (
  { value, quality },
  availableContentType,
) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value);
  const [availableType, availableSubtype] =
    decomposeContentType(availableContentType);

  const typeAccepted = acceptedType === "*" || acceptedType === availableType;
  const subtypeAccepted =
    acceptedSubtype === "*" || acceptedSubtype === availableSubtype;

  if (typeAccepted && subtypeAccepted) {
    return quality;
  }
  return -1;
};

const decomposeContentType = (fullType) => {
  const [type, subtype] = fullType.split("/");
  return [type, subtype];
};

const serveDirectory = (
  url,
  { headers = {}, rootDirectoryUrl } = {},
) => {
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
          "content-length": directoryContentJson.length,
        },
        body: directoryContentJson,
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
      ${directoryContentArray.map((filename) => {
        const fileUrl = String(new URL(filename, url));
        const fileUrlRelativeToServer = fileUrl.slice(
          String(rootDirectoryUrl).length,
        );
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
          "content-length": Buffer.byteLength(directoryAsHtml),
        },
        body: directoryAsHtml,
      };
    },
  };
  const bestContentType = pickContentType(
    { headers },
    Object.keys(responseProducers),
  );
  return responseProducers[bestContentType || "application/json"]();
};

/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */


const fetchFileSystem = async (
  filesystemUrl,
  {
    // signal,
    method = "GET",
    headers = {},
    etagEnabled = false,
    etagMemory = true,
    etagMemoryMaxSize = 1000,
    mtimeEnabled = false,
    compressionEnabled = false,
    compressionSizeThreshold = 1024,
    cacheControl = etagEnabled || mtimeEnabled
      ? "private,max-age=0,must-revalidate"
      : "no-store",
    canReadDirectory = false,
    rootDirectoryUrl, //  = `${pathToFileURL(process.cwd())}/`,
  } = {},
) => {
  const urlString = asUrlString(filesystemUrl);
  if (!urlString) {
    return create500Response(
      `fetchFileSystem first parameter must be a file url, got ${filesystemUrl}`,
    );
  }
  if (!urlString.startsWith("file://")) {
    return create500Response(
      `fetchFileSystem url must use "file://" scheme, got ${filesystemUrl}`,
    );
  }
  if (rootDirectoryUrl) {
    let rootDirectoryUrlString = asUrlString(rootDirectoryUrl);
    if (!rootDirectoryUrlString) {
      return create500Response(
        `rootDirectoryUrl must be a string or an url, got ${rootDirectoryUrl}`,
      );
    }
    if (!rootDirectoryUrlString.endsWith("/")) {
      rootDirectoryUrlString = `${rootDirectoryUrlString}/`;
    }
    if (!urlString.startsWith(rootDirectoryUrlString)) {
      return create500Response(
        `fetchFileSystem url must be inside root directory, got ${urlString}`,
      );
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
    console.warn(
      `cannot enable both etag and mtime, mtime disabled in favor of etag.`,
    );
    mtimeEnabled = false;
  }

  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    };
  }

  const sourceUrl = `file://${new URL(urlString).pathname}`;
  try {
    const [readStatTiming, sourceStat] = await timeFunction(
      "file service>read file stat",
      () => statSync(new URL(sourceUrl)),
    );
    if (sourceStat.isDirectory()) {
      if (canReadDirectory) {
        return serveDirectory(urlString, {
          headers,
          canReadDirectory,
          rootDirectoryUrl,
        });
      }
      return {
        status: 403,
        statusText: "not allowed to read directory",
      };
    }
    // not a file, give up
    if (!sourceStat.isFile()) {
      return {
        status: 404,
        timing: readStatTiming,
      };
    }

    const clientCacheResponse = await getClientCacheResponse({
      headers,
      etagEnabled,
      etagMemory,
      etagMemoryMaxSize,
      mtimeEnabled,
      sourceStat,
      sourceUrl,
    });

    // send 304 (redirect response to client cache)
    // because the response body does not have to be transmitted
    if (clientCacheResponse.status === 304) {
      return composeTwoResponses(
        {
          timing: readStatTiming,
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        },
        clientCacheResponse,
      );
    }

    let response;
    if (compressionEnabled && sourceStat.size >= compressionSizeThreshold) {
      const compressedResponse = await getCompressedResponse({
        headers,
        sourceUrl,
      });
      if (compressedResponse) {
        response = compressedResponse;
      }
    }
    if (!response) {
      response = await getRawResponse({
        sourceStat,
        sourceUrl,
      });
    }

    const intermediateResponse = composeTwoResponses(
      {
        timing: readStatTiming,
        headers: {
          ...(cacheControl ? { "cache-control": cacheControl } : {}),
          // even if client cache is disabled, server can still
          // send his own cache control but client should just ignore it
          // and keep sending cache-control: 'no-store'
          // if not, uncomment the line below to preserve client
          // desire to ignore cache
          // ...(headers["cache-control"] === "no-store" ? { "cache-control": "no-store" } : {}),
        },
      },
      response,
    );
    return composeTwoResponses(intermediateResponse, clientCacheResponse);
  } catch (e) {
    return composeTwoResponses(
      {
        headers: {
          ...(cacheControl ? { "cache-control": cacheControl } : {}),
        },
      },
      convertFileSystemErrorToResponseProperties(e) || {},
    );
  }
};

const create500Response = (message) => {
  return {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(message),
    },
    body: message,
  };
};

const getClientCacheResponse = async ({
  headers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  sourceStat,
  sourceUrl,
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means resource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (
    headers["cache-control"] === "no-store" ||
    // let's disable it on no-cache too
    headers["cache-control"] === "no-cache"
  ) {
    return { status: 200 };
  }

  if (etagEnabled) {
    return getEtagResponse({
      headers,
      etagMemory,
      etagMemoryMaxSize,
      sourceStat,
      sourceUrl,
    });
  }

  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      sourceStat,
    });
  }

  return { status: 200 };
};

const getEtagResponse = async ({
  headers,
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat,
}) => {
  const [computeEtagTiming, fileContentEtag] = await timeFunction(
    "file service>generate file etag",
    () =>
      computeEtag({
        etagMemory,
        etagMemoryMaxSize,
        sourceUrl,
        sourceStat,
      }),
  );

  const requestHasIfNoneMatchHeader = "if-none-match" in headers;
  if (
    requestHasIfNoneMatchHeader &&
    headers["if-none-match"] === fileContentEtag
  ) {
    return {
      status: 304,
      timing: computeEtagTiming,
    };
  }

  return {
    status: 200,
    headers: {
      etag: fileContentEtag,
    },
    timing: computeEtagTiming,
  };
};

const ETAG_MEMORY_MAP = new Map();
const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat,
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(sourceUrl);
    if (
      etagMemoryEntry &&
      fileStatAreTheSame(etagMemoryEntry.sourceStat, sourceStat)
    ) {
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
    ETAG_MEMORY_MAP.set(sourceUrl, { sourceStat, eTag });
  }
  return eTag;
};

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every((keyToCompare) => {
    const leftValue = leftFileStat[keyToCompare];
    const rightValue = rightFileStat[keyToCompare];
    return leftValue === rightValue;
  });
};
const fileStatKeysToCompare = [
  // mtime the the most likely to change, check it first
  "mtimeMs",
  "size",
  "ctimeMs",
  "ino",
  "mode",
  "uid",
  "gid",
  "blksize",
];

const getMtimeResponse = async ({ headers, sourceStat }) => {
  if ("if-modified-since" in headers) {
    let cachedModificationDate;
    try {
      cachedModificationDate = new Date(headers["if-modified-since"]);
    } catch (e) {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date",
      };
    }

    const actualModificationDate = dateToSecondsPrecision(sourceStat.mtime);
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304,
      };
    }
  }

  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(sourceStat.mtime),
    },
  };
};

const getCompressedResponse = async ({ sourceUrl, headers }) => {
  const acceptedCompressionFormat = pickContentEncoding(
    { headers },
    Object.keys(availableCompressionFormats),
  );
  if (!acceptedCompressionFormat) {
    return null;
  }

  const fileReadableStream = fileUrlToReadableStream(sourceUrl);
  const body =
    await availableCompressionFormats[acceptedCompressionFormat](
      fileReadableStream,
    );

  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding",
    },
    body,
  };
};

const fileUrlToReadableStream = (fileUrl) => {
  return createReadStream(new URL(fileUrl), {
    emitClose: true,
    autoClose: true,
  });
};

const availableCompressionFormats = {
  br: async (fileReadableStream) => {
    const { createBrotliCompress } = await import("node:zlib");
    return fileReadableStream.pipe(createBrotliCompress());
  },
  deflate: async (fileReadableStream) => {
    const { createDeflate } = await import("node:zlib");
    return fileReadableStream.pipe(createDeflate());
  },
  gzip: async (fileReadableStream) => {
    const { createGzip } = await import("node:zlib");
    return fileReadableStream.pipe(createGzip());
  },
};

const getRawResponse = async ({ sourceUrl, sourceStat }) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-length": sourceStat.size,
    },
    body: fileUrlToReadableStream(sourceUrl),
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString();

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const asUrlString = (value) => {
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

const jsenvServiceErrorHandler = ({ sendErrorDetails = false } = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, { request }) => {
      const serverInternalErrorIsAPrimitive =
        serverInternalError === null ||
        (typeof serverInternalError !== "object" &&
          typeof serverInternalError !== "function");
      if (!serverInternalErrorIsAPrimitive && serverInternalError.asResponse) {
        return serverInternalError.asResponse();
      }
      const dataToSend = serverInternalErrorIsAPrimitive
        ? {
            code: "VALUE_THROWED",
            value: serverInternalError,
          }
        : {
            code: serverInternalError.code || "UNKNOWN_ERROR",
            ...(sendErrorDetails
              ? {
                  stack: serverInternalError.stack,
                  ...serverInternalError,
                }
              : {}),
          };

      const availableContentTypes = {
        "text/html": () => {
          const renderHtmlForErrorWithoutDetails = () => {
            return `<p>Details not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).</p>`;
          };

          const renderHtmlForErrorWithDetails = () => {
            if (serverInternalErrorIsAPrimitive) {
              return `<pre>${JSON.stringify(
                serverInternalError,
                null,
                "  ",
              )}</pre>`;
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
    <p>${
      serverInternalErrorIsAPrimitive
        ? `Code inside server has thrown a literal.`
        : `Code inside server has thrown an error.`
    }</p>
    <details>
      <summary>See internal error details</summary>
      ${
        sendErrorDetails
          ? renderHtmlForErrorWithDetails()
          : renderHtmlForErrorWithoutDetails()
      }
    </details>
  </body>
</html>`;

          return {
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
        "application/json": () => {
          const body = JSON.stringify(dataToSend);
          return {
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      };
      const bestContentType = pickContentType(
        request,
        Object.keys(availableContentTypes),
      );
      return availableContentTypes[bestContentType || "application/json"]();
    },
  };
};

const jsenvAccessControlAllowedHeaders = ["x-requested-with"];

const jsenvAccessControlAllowedMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
];

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
  timingAllowOrigin = false,
} = {}) => {
  // TODO: we should check access control params to throw or warn if we find strange values

  const corsEnabled =
    accessControlAllowRequestOrigin || accessControlAllowedOrigins.length;

  if (!corsEnabled) {
    return [];
  }

  return {
    name: "jsenv:cors",

    handleRequest: (request) => {
      // when request method is "OPTIONS" we must return a 200 without body
      // So we bypass "requestToResponse" in that scenario using shortcircuitResponse
      if (request.method === "OPTIONS") {
        return {
          status: 200,
          headers: {
            "content-length": 0,
          },
        };
      }
      return null;
    },

    injectResponseHeaders: (response, { request }) => {
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
        timingAllowOrigin,
      });
      return accessControlHeaders;
    },
  };
};

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: { headers },
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
  timingAllowOrigin,
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
  if (
    accessControlAllowRequestMethod &&
    "access-control-request-method" in headers
  ) {
    const requestMethodName = headers["access-control-request-method"];
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders];
  if (
    accessControlAllowRequestHeaders &&
    "access-control-request-headers" in headers
  ) {
    const requestHeaderNameArray =
      headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach((headerName) => {
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
    ...(accessControlAllowCredentials
      ? { "access-control-allow-credentials": true }
      : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin
      ? { "timing-allow-origin": allowedOriginArray.join(", ") }
      : {}),
    ...(vary.length ? { vary: vary.join(", ") } : {}),
  };
};

const lookupPackageDirectory = (currentUrl) => {
  if (currentUrl === "file:///") {
    return null;
  }
  const packageJsonFileUrl = `${currentUrl}package.json`;
  if (existsSync(new URL(packageJsonFileUrl))) {
    return currentUrl;
  }
  return lookupPackageDirectory(getParentUrl$1(currentUrl));
};

const getParentUrl$1 = (url) => {
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
      const slashBeforeLastIndex = resource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      );
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

  const addClient = (client) => {
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
        sendEvent: (event) => {
          websocket.send(JSON.stringify(event));
        },
        close: (reason) => {
          const closePromise = new Promise((resolve, reject) => {
            websocket.onclose = () => {
              websocket.onclose = null;
              websocket.onerror = null;
              resolve();
            };
            websocket.onerror = (e) => {
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
        },
      };
      client.sendEvent({ type: "welcome" });
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
    dispatch: (event) => {
      clients.forEach((client) => {
        if (client.getReadystate() === 1) {
          client.sendEvent(event);
        }
      });
    },
    dispatchToClientsMatching: (event, predicate) => {
      clients.forEach((client) => {
        if (client.getReadystate() === 1 && predicate(client)) {
          client.sendEvent(event);
        }
      });
    },
    close: async (reason) => {
      await Promise.all(
        clients.map(async (client) => {
          await client.close(reason);
        }),
      );
    },
    destroy: () => {
      clients.forEach((client) => {
        client.destroy();
      });
    },
  };
};

const fileUrlConverter = {
  asFilePath: (fileUrl) => {
    const filePath = urlToFileSystemPath(fileUrl);
    const urlObject = new URL(fileUrl);
    const { searchParams } = urlObject;
    return `${filePath}${stringifyQuery(searchParams)}`;
  },
  asFileUrl: (filePath) => {
    return decodeURIComponent(fileSystemPathToUrl$1(filePath)).replace(
      /[=](?=&|$)/g,
      "",
    );
  },
};

const stringifyQuery = (searchParams) => {
  const search = searchParams.toString();
  return search ? `?${search}` : "";
};

// Do not use until https://github.com/parcel-bundler/parcel-css/issues/181
const bundleCss = async (cssUrlInfos) => {
  const bundledCssUrlInfos = {};
  const { bundleAsync } = await import("lightningcss");
  const targets = runtimeCompatToTargets$2(cssUrlInfos[0].context.runtimeCompat);
  for (const cssUrlInfo of cssUrlInfos) {
    const filename = fileUrlConverter.asFilePath(cssUrlInfo.originalUrl);
    const { code, map } = await bundleAsync({
      filename,
      targets,
      minify: false,
      resolver: {
        read: (specifier) => {
          const fileUrlObject = fileUrlConverter.asFileUrl(specifier);
          const fileUrl = String(fileUrlObject);
          const urlInfo = cssUrlInfo.graph.getUrlInfo(fileUrl);
          return urlInfo.content;
        },
        resolve(specifier, from) {
          const fileUrlObject = new URL(specifier, pathToFileURL(from));
          const filePath = fileURLToPath(fileUrlObject);
          return filePath;
        },
      },
    });
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        bundlerName: "lightningcss",
      },
      contentType: "text/css",
      content: String(code),
      sourcemap: map,
    };
  }
  return bundledCssUrlInfos;
};

const runtimeCompatToTargets$2 = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits$2(version);
    }
  });
  return targets;
};

const versionToBits$2 = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

const bundleJsModules = async (
  jsModuleUrlInfos,
  {
    buildDirectoryUrl,
    include,
    chunks = {},
    strictExports = false,
    preserveDynamicImport = false,
    augmentDynamicImportUrlSearchParams = () => {},
    rollup,
    rollupInput = {},
    rollupOutput = {},
    rollupPlugins = [],
  },
) => {
  const {
    signal,
    logger,
    rootDirectoryUrl,
    runtimeCompat,
    sourcemaps,
    isSupportedOnCurrentClients,
    getPluginMeta,
  } = jsModuleUrlInfos[0].context;
  const graph = jsModuleUrlInfos[0].graph;
  if (buildDirectoryUrl === undefined) {
    buildDirectoryUrl = jsModuleUrlInfos[0].context.buildDirectoryUrl;
  }

  let manualChunks;
  if (Object.keys(chunks).length) {
    const associations = URL_META.resolveAssociations(chunks, rootDirectoryUrl);
    manualChunks = (id) => {
      if (rollupOutput.manualChunks) {
        const manualChunkName = rollupOutput.manualChunks(id);
        if (manualChunkName) {
          return manualChunkName;
        }
      }
      const url = fileUrlConverter.asFileUrl(id);
      const urlObject = new URL(url);
      urlObject.search = "";
      const urlWithoutSearch = urlObject.href;
      const meta = URL_META.applyAssociations({
        url: urlWithoutSearch,
        associations,
      });
      const chunkName = Object.keys(meta).find((key) => meta[key]);
      return chunkName || null;
    };
  }

  const resultRef = { current: null };
  const willMinifyJsModule = Boolean(getPluginMeta("willMinifyJsModule"));
  try {
    await applyRollupPlugins({
      rollup,
      rollupPlugins: [
        ...rollupPlugins,
        rollupPluginJsenv({
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          graph,
          jsModuleUrlInfos,

          runtimeCompat,
          sourcemaps,
          include,
          preserveDynamicImport,
          augmentDynamicImportUrlSearchParams,
          strictExports,
          resultRef,
        }),
      ],
      rollupInput: {
        input: [],
        onwarn: (warning) => {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            return;
          }
          if (warning.code === "EVAL") {
            // ideally we should disable only for jsenv files
            return;
          }
          logger.warn(String(warning));
        },
        ...rollupInput,
      },
      rollupOutput: {
        compact: willMinifyJsModule,
        minifyInternalExports: willMinifyJsModule,
        generatedCode: {
          arrowFunctions: isSupportedOnCurrentClients("arrow_function"),
          constBindings: isSupportedOnCurrentClients("const_bindings"),
          objectShorthand: isSupportedOnCurrentClients(
            "object_properties_shorthand",
          ),
          reservedNamesAsProps: isSupportedOnCurrentClients("reserved_words"),
          symbols: isSupportedOnCurrentClients("symbols"),
        },
        ...rollupOutput,
        manualChunks,
      },
    });
    return resultRef.current.jsModuleBundleUrlInfos;
  } catch (e) {
    if (e.code === "MISSING_EXPORT") {
      const detailedMessage = createDetailedMessage$1(e.message, {
        frame: e.frame,
      });
      throw new Error(detailedMessage, { cause: e });
    }
    throw e;
  }
};

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  graph,
  jsModuleUrlInfos,
  sourcemaps,

  include,
  preserveDynamicImport,
  augmentDynamicImportUrlSearchParams,
  strictExports,

  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented");
  };
  const format = jsModuleUrlInfos.some((jsModuleUrlInfo) =>
    jsModuleUrlInfo.filenameHint.endsWith(".cjs"),
  )
    ? "cjs"
    : "esm";
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    });
  };
  let importCanBeBundled = () => true;
  if (include) {
    const associations = URL_META.resolveAssociations(
      { bundle: include },
      rootDirectoryUrl,
    );
    importCanBeBundled = (url) => {
      return URL_META.applyAssociations({ url, associations }).bundle;
    };
  }

  const getOriginalUrl = (rollupFileInfo) => {
    const { facadeModuleId } = rollupFileInfo;
    if (facadeModuleId) {
      return fileUrlConverter.asFileUrl(facadeModuleId);
    }
    if (rollupFileInfo.isDynamicEntry) {
      const { moduleIds } = rollupFileInfo;
      const lastModuleId = moduleIds[moduleIds.length - 1];
      return fileUrlConverter.asFileUrl(lastModuleId);
    }
    return new URL(rollupFileInfo.fileName, rootDirectoryUrl).href;
  };

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args);
      let previousNonEntryPointModuleId;
      jsModuleUrlInfos.forEach((jsModuleUrlInfo) => {
        const id = jsModuleUrlInfo.url;
        if (jsModuleUrlInfo.isEntryPoint) {
          emitChunk({
            id,
          });
          return;
        }
        let preserveSignature;
        if (strictExports) {
          preserveSignature = "strict";
        } else {
          // When referenced only once we can enable allow-extension
          // otherwise stick to strict exports to ensure all importers
          // receive the correct exports
          let firstStrongRef = null;
          let hasMoreThanOneStrongRefFromOther = false;
          for (const referenceFromOther of jsModuleUrlInfo.referenceFromOthersSet) {
            if (referenceFromOther.isWeak) {
              continue;
            }
            if (firstStrongRef) {
              hasMoreThanOneStrongRefFromOther = true;
              break;
            }
            firstStrongRef = referenceFromOther;
          }
          preserveSignature = hasMoreThanOneStrongRefFromOther
            ? "strict"
            : "allow-extension";
        }
        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId
            ? [previousNonEntryPointModuleId]
            : null,
          preserveSignature,
        });
        previousNonEntryPointModuleId = id;
      });
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const createBundledFileInfo = (rollupFileInfo) => {
        const originalUrl = getOriginalUrl(rollupFileInfo);
        const sourceUrls = Object.keys(rollupFileInfo.modules).map((id) =>
          fileUrlConverter.asFileUrl(id),
        );

        const specifierToUrlMap = new Map();
        const { imports, dynamicImports } = rollupFileInfo;
        for (const importFileName of imports) {
          if (!importFileName.startsWith("file:")) {
            const importRollupFileInfo = rollupResult[importFileName];
            if (!importRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(importFileName, importFileName);
              continue;
            }
            const importUrl = getOriginalUrl(importRollupFileInfo);
            const rollupSpecifier = `./${importRollupFileInfo.fileName}`;
            specifierToUrlMap.set(rollupSpecifier, importUrl);
          }
        }
        for (const dynamicImportFileName of dynamicImports) {
          if (!dynamicImportFileName.startsWith("file:")) {
            const dynamicImportRollupFileInfo =
              rollupResult[dynamicImportFileName];
            if (!dynamicImportRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(
                dynamicImportFileName,
                dynamicImportFileName,
              );
              continue;
            }
            const dynamicImportUrl = getOriginalUrl(
              dynamicImportRollupFileInfo,
            );
            const rollupSpecifier = `./${dynamicImportRollupFileInfo.fileName}`;
            specifierToUrlMap.set(rollupSpecifier, dynamicImportUrl);
          }
        }

        const generatedToShareCode =
          !rollupFileInfo.isEntry &&
          !rollupFileInfo.isDynamicEntry &&
          !rollupFileInfo.isImplicitEntry;

        return {
          originalUrl,
          type: format === "esm" ? "js_module" : "common_js",
          data: {
            bundlerName: "rollup",
            bundleRelativeUrl: rollupFileInfo.fileName,
            usesImport:
              rollupFileInfo.imports.length > 0 ||
              rollupFileInfo.dynamicImports.length > 0,
            isDynamicEntry: rollupFileInfo.isDynamicEntry,
            generatedToShareCode,
          },
          sourceUrls,
          contentType: "text/javascript",
          content: rollupFileInfo.code,
          sourcemap: rollupFileInfo.map,
          // rollup is generating things like "./file.js"
          // that must be converted back to urls for jsenv
          remapReference:
            specifierToUrlMap.size > 0
              ? (reference) => {
                  // rollup generate specifiers only for static and dynamic imports
                  // other references (like new URL()) are ignored
                  // there is no need to remap them back
                  if (reference.type === "js_import") {
                    return specifierToUrlMap.get(reference.specifier);
                  }
                  return reference.specifier;
                }
              : undefined,
        };
      };

      const jsModuleBundleUrlInfos = {};
      const fileNames = Object.keys(rollupResult);
      for (const fileName of fileNames) {
        const rollupFileInfo = rollupResult[fileName];
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const jsModuleInfo = createBundledFileInfo(rollupFileInfo);
          jsModuleBundleUrlInfos[jsModuleInfo.originalUrl] = jsModuleInfo;
        }
      }

      resultRef.current = {
        jsModuleBundleUrlInfos,
      };
    },
    outputOptions: (outputOptions) => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format,
        dir: fileUrlConverter.asFilePath(rootDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, rootDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: (chunkInfo) => {
          return `${chunkInfo.name}.js`;
        },
      });
    },
    // https://rollupjs.org/guide/en/#resolvedynamicimport
    resolveDynamicImport: (specifier, importer) => {
      if (preserveDynamicImport) {
        let urlObject;
        if (specifier[0] === "/") {
          urlObject = new URL(specifier.slice(1), rootDirectoryUrl);
        } else {
          if (isFileSystemPath$1(importer)) {
            importer = fileUrlConverter.asFileUrl(importer);
          }
          urlObject = new URL(specifier, importer);
        }
        const searchParamsToAdd =
          augmentDynamicImportUrlSearchParams(urlObject);
        if (searchParamsToAdd) {
          Object.keys(searchParamsToAdd).forEach((key) => {
            const value = searchParamsToAdd[key];
            if (value === undefined) {
              urlObject.searchParams.delete(key);
            } else {
              urlObject.searchParams.set(key, value);
            }
          });
        }
        return { external: true, id: urlObject.href };
      }
      return null;
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath$1(importer)) {
        importer = fileUrlConverter.asFileUrl(importer);
      }
      let url;
      if (specifier[0] === "/") {
        url = new URL(specifier.slice(1), rootDirectoryUrl).href;
      } else {
        url = new URL(specifier, importer).href;
      }
      if (!url.startsWith("file:")) {
        return { id: url, external: true };
      }
      if (!importCanBeBundled(url)) {
        return { id: url, external: true };
      }
      const urlInfo = graph.getUrlInfo(url);
      if (!urlInfo) {
        // happen when excluded by referenceAnalysis.include
        return { id: url, external: true };
      }
      if (urlInfo.url.startsWith("ignore:")) {
        return { id: url, external: true };
      }
      const filePath = fileUrlConverter.asFilePath(url);
      return filePath;
    },
    async load(rollupId) {
      const fileUrl = fileUrlConverter.asFileUrl(rollupId);
      const urlInfo = graph.getUrlInfo(fileUrl);
      return {
        code: urlInfo.content,
        map:
          (sourcemaps === "file" || sourcemaps === "inline") &&
          urlInfo.sourcemap
            ? sourcemapConverter.toFilePaths(urlInfo.sourcemap)
            : null,
      };
    },
  };
};

const applyRollupPlugins = async ({
  rollup,
  rollupPlugins,
  rollupInput,
  rollupOutput,
}) => {
  if (!rollup) {
    const rollupModule = await import("rollup");
    rollup = rollupModule.rollup;
  }
  const { importAssertions } = await import("acorn-import-assertions");
  const rollupReturnValue = await rollup({
    ...rollupInput,
    plugins: rollupPlugins,
    acornInjectPlugins: [
      importAssertions,
      ...(rollupInput.acornInjectPlugins || []),
    ],
  });
  const rollupOutputArray = await rollupReturnValue.generate(rollupOutput);
  return rollupOutputArray;
};

const jsenvPluginBundling = ({
  css = {},
  js_classic = {},
  js_module = {},
} = {}) => {
  const bundle = {};

  if (css) {
    bundle.css = (cssUrlInfos) => {
      return bundleCss(cssUrlInfos);
    };
  }
  if (js_module) {
    if (js_module === true) {
      js_module = {};
    }
    bundle.js_module = (jsModuleUrlInfos) => {
      return bundleJsModules(jsModuleUrlInfos, js_module);
    };
  }

  return {
    name: "jsenv:bundling",
    appliesDuring: "build",
    bundle,
  };
};

// https://github.com/kangax/html-minifier#options-quick-reference
const minifyHtml = (htmlUrlInfo, options = {}) => {
  const require = createRequire(import.meta.url);
  const { minify } = require("html-minifier");

  const {
    // usually HTML will contain a few markup, it's better to keep white spaces
    // and line breaks to favor readability. A few white spaces means very few
    // octets that won't impact performances. Removing whitespaces however will certainly
    // decrease HTML readability
    collapseWhitespace = false,
    // saving a fewline breaks won't hurt performances
    // but will help a lot readability
    preserveLineBreaks = true,
    removeComments = true,
    conservativeCollapse = false,
  } = options;

  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    conservativeCollapse,
    removeComments,
    preserveLineBreaks,
  });
  return htmlMinified;
};

const minifyCss = async (cssUrlInfo) => {
  const { transform } = await import("lightningcss");

  const targets = runtimeCompatToTargets$1(cssUrlInfo.context.runtimeCompat);
  const { code, map } = transform({
    filename: fileURLToPath(cssUrlInfo.originalUrl),
    code: Buffer.from(cssUrlInfo.content),
    targets,
    minify: true,
  });
  return {
    content: String(code),
    sourcemap: map,
  };
};

const runtimeCompatToTargets$1 = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits$1(version);
    }
  });
  return targets;
};

const versionToBits$1 = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

// https://github.com/terser-js/terser#minify-options

const minifyJs = async (jsUrlInfo, options) => {
  const url = jsUrlInfo.url;
  const content = jsUrlInfo.content;
  const sourcemap = jsUrlInfo.sourcemap;
  const isJsModule = jsUrlInfo.type === "js_module";

  const { minify } = await import("terser");
  const terserResult = await minify(
    {
      [url]: content,
    },
    {
      sourceMap: {
        ...(sourcemap ? { content: JSON.stringify(sourcemap) } : {}),
        asObject: true,
        includeSources: true,
      },
      module: isJsModule,
      // We need to preserve "new __InlineContent__()" calls to be able to recognize them
      // after minification in order to version urls inside inline content text
      keep_fnames: /__InlineContent__/,
      ...options,
    },
  );
  return {
    content: terserResult.code,
    sourcemap: terserResult.map,
  };
};

const minifyJson = (jsonUrlInfo) => {
  const { content } = jsonUrlInfo;
  if (content.startsWith("{\n")) {
    const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content));
    return jsonWithoutWhitespaces;
  }
  return null;
};

const jsenvPluginMinification = ({
  html = {},
  css = {},
  js_classic = {},
  js_module = {},
  json = {},
  svg = {},
} = {}) => {
  const htmlMinifier = html
    ? (urlInfo) => minifyHtml(urlInfo, html === true ? {} : html)
    : null;
  const svgMinifier = svg
    ? (urlInfo) => minifyHtml(urlInfo, svg === true ? {} : svg)
    : null;
  const cssMinifier = css
    ? (urlInfo) => minifyCss(urlInfo)
    : null;
  const jsClassicMinifier = js_classic
    ? (urlInfo) => minifyJs(urlInfo, js_classic === true ? {} : js_classic)
    : null;
  const jsModuleMinifier = js_module
    ? (urlInfo) => minifyJs(urlInfo, js_module === true ? {} : js_module)
    : null;
  const jsonMinifier = json
    ? (urlInfo) => minifyJson(urlInfo)
    : null;

  return {
    name: "jsenv:minification",
    appliesDuring: "build",
    meta: {
      willMinifyHtml: Boolean(html),
      willMinifySvg: Boolean(svg),
      willMinifyCss: Boolean(css),
      willMinifyJsClassic: Boolean(js_classic),
      willMinifyJsModule: Boolean(js_module),
      willMinifyJson: Boolean(json),
    },
    optimizeUrlContent: {
      html: htmlMinifier,
      svg: svgMinifier,
      css: cssMinifier,
      js_classic: jsClassicMinifier,
      js_module: jsModuleMinifier,
      json: jsonMinifier,
      importmap: jsonMinifier,
      webmanifest: jsonMinifier,
    },
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
  pickBest: (string, { canUseTemplateString, defaultQuote = DOUBLE } = {}) => {
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
    if (
      canUseTemplateString &&
      defaultQuote !== BACKTICK &&
      !string.includes(BACKTICK)
    ) {
      return BACKTICK;
    }
    return defaultQuote;
  },

  escapeSpecialChars: (
    string,
    {
      quote = "pickBest",
      canUseTemplateString,
      defaultQuote,
      allowEscapeForVersioning = false,
    },
  ) => {
    quote =
      quote === "pickBest"
        ? JS_QUOTES.pickBest(string, { canUseTemplateString, defaultQuote })
        : quote;
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
        if (
          allowEscapeForVersioning &&
          char === quote &&
          string.slice(i, i + 6) === "+__v__"
        ) {
          let isVersioningConcatenation = false;
          let j = i + 6; // start after the +
          while (j < string.length) {
            const lookAheadChar = string[j];
            j++;
            if (
              lookAheadChar === "+" &&
              string[j] === quote &&
              !isEscaped(j - 1, string)
            ) {
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
  },
};

const DOUBLE = `"`;
const SINGLE = `'`;
const BACKTICK = "`";
const lineEndingEscapes = {
  "\n": "\\n",
  "\r": "\\r",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
const JS_QUOTE_REPLACEMENTS = {
  [DOUBLE]: {
    '"': '\\"',
    ...lineEndingEscapes,
  },
  [SINGLE]: {
    "'": "\\'",
    ...lineEndingEscapes,
  },
  [BACKTICK]: {
    "`": "\\`",
    "$": "\\$",
  },
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
  text = "auto",
}) => {
  const transpilations = { json, css, text };
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      reference.filenameHint = `${urlToFilename$1(reference.url)}.js`;
    }
  };
  const turnIntoJsModuleProxy = (reference, type) => {
    reference.mutation = (magicSource) => {
      if (reference.subtype === "import_dynamic") {
        const { importTypeAttributeNode } = reference.astInfo;
        magicSource.remove({
          start: importTypeAttributeNode.start,
          end: importTypeAttributeNode.end,
        });
      } else {
        const { importTypeAttributeNode } = reference.astInfo;
        const content = reference.ownerUrlInfo.content;
        const assertKeyboardStart = content.indexOf(
          "assert",
          importTypeAttributeNode.start - " assert { ".length,
        );
        const assertKeywordEnd = content.indexOf(
          "}",
          importTypeAttributeNode.end,
        );
        magicSource.remove({
          start: assertKeyboardStart,
          end: assertKeywordEnd + 1,
        });
      }
    };
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: "",
    });
    markAsJsModuleProxy(reference);
    return newUrl;
  };

  const createImportTypePlugin = ({ type, createUrlContent }) => {
    return {
      name: `jsenv:import_type_${type}`,
      appliesDuring: "*",
      init: (context) => {
        // transpilation is forced during build so that
        //   - avoid rollup to see import assertions
        //     We would have to tell rollup to ignore import with assertion
        //   - means rollup can bundle more js file together
        //   - means url versioning can work for css inlined in js
        if (context.build) {
          return true;
        }
        const transpilation = transpilations[type];
        if (transpilation === "auto") {
          return !context.isSupportedOnCurrentClients(`import_type_${type}`);
        }
        return transpilation;
      },
      redirectReference: (reference) => {
        if (!reference.importAttributes) {
          return null;
        }
        const { searchParams } = reference;
        if (searchParams.has(`as_${type}_module`)) {
          markAsJsModuleProxy(reference);
          return null;
        }
        // when search param is injected, it will be removed later
        // by "getWithoutSearchParam". We don't want to redirect again
        // (would create infinite recursion)
        if (
          reference.prev &&
          reference.prev.searchParams.has(`as_${type}_module`)
        ) {
          return null;
        }
        if (reference.importAttributes.type === type) {
          return turnIntoJsModuleProxy(reference, type);
        }
        return null;
      },
      fetchUrlContent: async (urlInfo) => {
        const originalUrlInfo = urlInfo.getWithoutSearchParam(
          `as_${type}_module`,
          {
            expectedType: "json",
          },
        );
        if (!originalUrlInfo) {
          return null;
        }
        await originalUrlInfo.cook();
        return createUrlContent(originalUrlInfo);
      },
    };
  };

  const asJsonModule = createImportTypePlugin({
    type: "json",
    createUrlContent: (jsonUrlInfo) => {
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      let inlineContentCall;
      // here we could `export default ${jsonText}`:
      // but js engine are optimized to recognize JSON.parse
      // and use a faster parsing strategy
      if (jsonUrlInfo.context.dev) {
        inlineContentCall = `JSON.parse(
  ${jsonText},
  //# inlinedFromUrl=${jsonUrlInfo.url}
)`;
      } else {
        inlineContentCall = `JSON.parse(${jsonText})`;
      }
      return {
        content: `export default ${inlineContentCall};`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data,
      };
    },
  });

  const asCssModule = createImportTypePlugin({
    type: "css",
    createUrlContent: (cssUrlInfo) => {
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (cssUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${cssText},
  { type: "text/css" },
  //# inlinedFromUrl=${cssUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${cssText}, { type: "text/css" })`;
      }
      return {
        content: `
import ${JSON.stringify(cssUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);

export default stylesheet;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data,
      };
    },
  });

  const asTextModule = createImportTypePlugin({
    type: "text",
    createUrlContent: (textUrlInfo) => {
      const textPlain = JS_QUOTES.escapeSpecialChars(textUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (textUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${textPlain},
  { type: "text/plain"},
  //# inlinedFromUrl=${textUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${textPlain}, { type: "text/plain"})`;
      }
      return {
        content: `
import ${JSON.stringify(textUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};

export default inlineContent.text;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      };
    },
  });

  return [asJsonModule, asCssModule, asTextModule];
};

/*
 * Generated helpers
 * - https://github.com/babel/babel/commits/main/packages/babel-helpers/src/helpers.ts
 * File helpers
 * - https://github.com/babel/babel/tree/main/packages/babel-helpers/src/helpers
 *
 */
const babelHelperClientDirectoryUrl = new URL(
  "./babel_helpers/",
  import.meta.url,
).href;

// we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"
const getBabelHelperFileUrl = (babelHelperName) => {
  const babelHelperFileUrl = new URL(
    `./${babelHelperName}/${babelHelperName}.js`,
    babelHelperClientDirectoryUrl,
  ).href;
  return babelHelperFileUrl;
};

const babelHelperNameFromUrl = (url) => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null;
  }
  const afterBabelHelperDirectory = url.slice(
    babelHelperClientDirectoryUrl.length,
  );
  const babelHelperName = afterBabelHelperDirectory.slice(
    0,
    afterBabelHelperDirectory.indexOf("/"),
  );
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
    electron: "6",
  },
  "proposal-class-properties": {
    chrome: "74",
    opera: "61",
    edge: "79",
    node: "12",
    electron: "6.1",
  },
  "proposal-private-methods": {
    chrome: "84",
    opera: "71",
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    node: "14",
    electron: "8.1",
  },
  "proposal-optional-chaining": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    node: "14",
    electron: "8.1",
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
    electron: "3",
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
    electron: "3",
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
    electron: "0.37",
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
    electron: "3",
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
    electron: "2",
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
    electron: "3",
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
    electron: "3",
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3",
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
    electron: "1.6",
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
    electron: "1.3",
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
    samsung: "3.4",
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
    electron: "0.30",
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
    electron: "1.2",
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
    electron: "0.36",
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
    electron: "0.22",
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
    electron: "0.36",
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
    electron: "0.36",
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
    electron: "0.28",
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
    electron: "0.25",
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
    electron: "0.30",
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
    electron: "1.2",
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
    electron: "0.37",
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
    electron: "0.30",
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
    electron: "1.1",
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
    electron: "0.36",
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
    electron: "1.2",
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
    electron: "0.37",
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
    electron: "0.20",
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
    electron: "0.36",
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
    electron: "1.1",
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
    electron: "0.20",
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
    electron: "0.20",
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
    electron: "0.20",
  },
};

// copy of transform-async-to-generator
// so that async is not transpiled when supported
babelPluginCompatMap["transform-async-to-promises"] =
  babelPluginCompatMap["transform-async-to-generator"];

babelPluginCompatMap["regenerator-transform"] =
  babelPluginCompatMap["transform-regenerator"];

const requireBabelPlugin = createRequire(import.meta.url);

const getBaseBabelPluginStructure = ({
  url,
  isSupported,
  // isJsModule,
  // getImportSpecifier,
}) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupported(babelPluginName, babelPluginCompatMap[babelPluginName]);
  };

  const babelPluginStructure = {};
  if (isBabelPluginNeeded("proposal-numeric-separator")) {
    babelPluginStructure["proposal-numeric-separator"] = requireBabelPlugin(
      "@babel/plugin-proposal-numeric-separator",
    );
  }
  if (isBabelPluginNeeded("proposal-json-strings")) {
    babelPluginStructure["proposal-json-strings"] = requireBabelPlugin(
      "@babel/plugin-proposal-json-strings",
    );
  }
  if (isBabelPluginNeeded("proposal-object-rest-spread")) {
    babelPluginStructure["proposal-object-rest-spread"] = requireBabelPlugin(
      "@babel/plugin-proposal-object-rest-spread",
    );
  }
  if (isBabelPluginNeeded("proposal-optional-catch-binding")) {
    babelPluginStructure["proposal-optional-catch-binding"] =
      requireBabelPlugin("@babel/plugin-proposal-optional-catch-binding");
  }
  if (isBabelPluginNeeded("proposal-unicode-property-regex")) {
    babelPluginStructure["proposal-unicode-property-regex"] =
      requireBabelPlugin("@babel/plugin-proposal-unicode-property-regex");
  }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      requireBabelPlugin("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "ignore", // will be handled by "jsenv:top_level_await" plugin
        externalHelpers: false,
        // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
        // externalHelpers: isJsModule,
        // externalHelpersPath: isJsModule ? getImportSpecifier(
        //     "babel-plugin-transform-async-to-promises/helpers.mjs",
        //   ) : null
      },
    ];
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin(
      "@babel/plugin-transform-arrow-functions",
    );
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] =
      requireBabelPlugin("@babel/plugin-transform-block-scoped-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin(
      "@babel/plugin-transform-block-scoping",
    );
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin(
      "@babel/plugin-transform-classes",
    );
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin(
      "@babel/plugin-transform-computed-properties",
    );
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin(
      "@babel/plugin-transform-destructuring",
    );
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin(
      "@babel/plugin-transform-dotall-regex",
    );
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin(
      "@babel/plugin-transform-duplicate-keys",
    );
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] =
      requireBabelPlugin("@babel/plugin-transform-exponentiation-operator");
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin(
      "@babel/plugin-transform-for-of",
    );
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin(
      "@babel/plugin-transform-function-name",
    );
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin(
      "@babel/plugin-transform-literals",
    );
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin(
      "@babel/plugin-transform-new-target",
    );
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin(
      "@babel/plugin-transform-object-super",
    );
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin(
      "@babel/plugin-transform-parameters",
    );
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      requireBabelPlugin("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ];
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      requireBabelPlugin("@babel/plugin-transform-shorthand-properties"),
    ];
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      requireBabelPlugin("@babel/plugin-transform-spread"),
    ];
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-sticky-regex"),
    ];
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      requireBabelPlugin("@babel/plugin-transform-template-literals"),
    ];
  }
  if (
    isBabelPluginNeeded("transform-typeof-symbol") &&
    // prevent "typeof" to be injected into itself:
    // - not needed
    // - would create infinite attempt to transform typeof
    url !== getBabelHelperFileUrl("typeof")
  ) {
    babelPluginStructure["transform-typeof-symbol"] = [
      requireBabelPlugin("@babel/plugin-transform-typeof-symbol"),
    ];
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-unicode-regex"),
    ];
  }
  return babelPluginStructure;
};

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

const babelPluginBabelHelpersAsJsenvImports = (
  babel,
  { getImportSpecifier },
) => {
  return {
    name: "babel-helper-as-jsenv-import",
    pre: (file) => {
      const cachedHelpers = {};
      file.set("helperGenerator", (name) => {
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
          importedType: "es6",
          // importedInterop: "uncompiled",
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    },
  };
};

const regeneratorRuntimeClientFileUrl = new URL(
  "./js/regenerator_runtime.js",
  import.meta.url,
).href;

const analyzeRegeneratorRuntimeUsage = (urlInfo) => {
  if (urlInfo.url === regeneratorRuntimeClientFileUrl) {
    return null;
  }
  const ast = urlInfo.contentAst;
  const node = visitJsAstUntil(ast, {
    Identifier: (node) => {
      if (node.name === "regeneratorRuntime") {
        return node;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const injectSideEffectFileIntoBabelAst = ({
  programPath,
  sideEffectFileUrl,
  getSideEffectFileSpecifier,
  babel,
  isJsModule,
  asImport = true,
}) => {
  if (isJsModule && asImport) {
    injectJsImport({
      programPath,
      from: getSideEffectFileSpecifier(sideEffectFileUrl),
      sideEffect: true,
    });
    return;
  }
  const sidEffectFileContent = readFileSync(new URL(sideEffectFileUrl), "utf8");
  const sideEffectFileContentAst = babel.parse(sidEffectFileContent);
  if (isJsModule) {
    injectAstAfterImport(programPath, sideEffectFileContentAst);
    return;
  }
  const bodyNodePaths = programPath.get("body");
  bodyNodePaths[0].insertBefore(sideEffectFileContentAst.program.body);
};

const injectAstAfterImport = (programPath, ast) => {
  const bodyNodePaths = programPath.get("body");
  const notAnImportIndex = bodyNodePaths.findIndex(
    (bodyNodePath) => bodyNodePath.node.type !== "ImportDeclaration",
  );
  const notAnImportNodePath = bodyNodePaths[notAnImportIndex];
  if (notAnImportNodePath) {
    notAnImportNodePath.insertBefore(ast.program.body);
  } else {
    bodyNodePaths[0].insertBefore(ast.program.body);
  }
};

const babelPluginRegeneratorRuntimeInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const newStylesheetClientFileUrl = new URL(
  "./js/new_stylesheet.js",
  import.meta.url,
).href;

const analyzeConstructableStyleSheetUsage = (urlInfo) => {
  if (urlInfo.url === newStylesheetClientFileUrl) {
    return null;
  }
  const node = visitJsAstUntil(urlInfo.contentAst, {
    NewExpression: (node) => {
      return isNewCssStyleSheetCall(node);
    },
    MemberExpression: (node) => {
      return isDocumentAdoptedStyleSheets(node);
    },
    ImportExpression: (node) => {
      const source = node.source;
      if (source.type !== "Literal" || typeof source.value === "string") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return false;
      }
      if (hasImportTypeCssAssertion(node)) {
        return node;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ImportDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      if (hasImportTypeCssAssertion(node)) {
        return node;
      }
      return false;
    },
    ExportAllDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ExportNamedDeclaration: (node) => {
      const { source } = node;
      if (!source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return false;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const isNewCssStyleSheetCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "CSSStyleSheet"
  );
};

const isDocumentAdoptedStyleSheets = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "document" &&
    node.property.type === "Identifier" &&
    node.property.name === "adoptedStyleSheets"
  );
};

const hasCssModuleQueryParam = (node) => {
  return (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    new URL(node.value, "https://jsenv.dev/").searchParams.has(`css_module`)
  );
};

const hasImportTypeCssAssertion = (node) => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(
    node.assertions,
  );
  return Boolean(importAssertionsDescriptor.type === "css");
};

const getImportAssertionsDescriptor = (importAssertions) => {
  const importAssertionsDescriptor = {};
  if (importAssertions) {
    importAssertions.forEach((importAssertion) => {
      importAssertionsDescriptor[importAssertion.key.name] =
        importAssertion.value.value;
    });
  }
  return importAssertionsDescriptor;
};

const babelPluginNewStylesheetInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "new-stylesheet-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: newStylesheetClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};

const jsenvPluginBabel = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo) => {
    const isJsModule = urlInfo.type === "js_module";
    const getImportSpecifier = (clientFileUrl) => {
      const jsImportReference = urlInfo.dependencies.inject({
        type: "js_import",
        expectedType: "js_module",
        specifier: clientFileUrl,
      });
      return JSON.parse(jsImportReference.generatedSpecifier);
    };
    const isSupported = urlInfo.context.isSupportedOnCurrentClients;
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.originalUrl,
      isSupported,
      isJsModule,
      getImportSpecifier,
    });

    if (!isSupported("async_generator_function")) {
      const regeneratorRuntimeUsage = analyzeRegeneratorRuntimeUsage(urlInfo);
      if (regeneratorRuntimeUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginRegeneratorRuntimeInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: regeneratorRuntimeUsage.line,
            specifierColumn: regeneratorRuntimeUsage.column,
          });
        }
      }
    }
    if (!isSupported("new_stylesheet")) {
      const constructableStyleSheetUsage =
        analyzeConstructableStyleSheetUsage(urlInfo);
      if (constructableStyleSheetUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginNewStylesheetInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: constructableStyleSheetUsage.line,
            specifierColumn: constructableStyleSheetUsage.column,
          });
        }
      }
    }
    if (
      isJsModule &&
      babelHelpersAsImport &&
      Object.keys(babelPluginStructure).length > 0
    ) {
      babelPluginStructure["babel-helper-as-jsenv-import"] = [
        babelPluginBabelHelpersAsJsenvImports,
        { getImportSpecifier },
      ];
    }

    const babelPlugins = Object.keys(babelPluginStructure).map(
      (babelPluginName) => babelPluginStructure[babelPluginName],
    );
    const { code, map } = await applyBabelPlugins({
      babelPlugins,
      options: {
        generatorOpts: {
          retainLines: urlInfo.context.dev,
        },
      },
      input: urlInfo.content,
      inputIsJsModule: isJsModule,
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    return {
      content: code,
      sourcemap: map,
    };
  };

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel,
    },
  };
};

/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */


const jsenvPluginJsModuleConversion = ({ remapImportSpecifier }) => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true;
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true;
    }
    return false;
  };

  const shouldPropagateJsModuleConversion = (reference) => {
    if (isReferencingJsModule(reference)) {
      const insideJsClassic =
        reference.ownerUrlInfo.searchParams.has("js_module_fallback");
      return insideJsClassic;
    }
    return false;
  };

  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    if (!reference.filenameHint) {
      reference.filenameHint = generateJsClassicFilename(reference.url);
    }
  };

  const turnIntoJsClassicProxy = (reference) => {
    markAsJsClassicProxy(reference);
    return injectQueryParams(reference.url, {
      js_module_fallback: "",
    });
  };

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("js_module_fallback")) {
        markAsJsClassicProxy(reference);
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (
        reference.prev &&
        reference.prev.searchParams.has(`js_module_fallback`)
      ) {
        return null;
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference)) {
        return turnIntoJsClassicProxy(reference);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo) => {
      const jsModuleUrlInfo = urlInfo.getWithoutSearchParam(
        "js_module_fallback",
        {
          // override the expectedType to "js_module"
          // because when there is ?js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        },
      );
      if (!jsModuleUrlInfo) {
        return null;
      }
      await jsModuleUrlInfo.cook();
      let outputFormat;
      if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
        // if it's an entry point without dependency (it does not use import)
        // then we can use UMD
        outputFormat = "umd";
      } else {
        // otherwise we have to use system in case it's imported
        // by an other file (for entry points)
        // or to be able to import when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.dependencies.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrlDefault,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
        input: jsModuleUrlInfo.content,
        inputIsEntryPoint: urlInfo.isEntryPoint,
        inputSourcemap: jsModuleUrlInfo.sourcemap,
        inputUrl: jsModuleUrlInfo.url,
        outputUrl: urlInfo.url,
        outputFormat,
        remapImportSpecifier,
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data,
      };
    },
  };
};

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename$1(url);
  let [basename, extension] = splitFileExtension$2(filename);
  const { searchParams } = new URL(url);
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    basename += extension;
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};

const splitFileExtension$2 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */


const jsenvPluginJsModuleFallbackInsideHtml = ({
  needJsModuleFallback,
}) => {
  const turnIntoJsClassicProxy = (reference) => {
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    init: needJsModuleFallback,
    redirectReference: {
      link_href: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.subtype === "modulepreload") {
          return turnIntoJsClassicProxy(reference);
        }
        if (
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference) => {
        if (
          reference.prev &&
          reference.prev.searchParams.has(`js_module_fallback`)
        ) {
          return null;
        }
        if (reference.expectedType === "js_module") {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const rel = getHtmlNodeAttribute(node, "rel");
            if (rel !== "modulepreload" && rel !== "preload") {
              return;
            }
            const href = getHtmlNodeAttribute(node, "href");
            if (!href) {
              return;
            }
            let linkHintReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (
                referenceToOther.generatedSpecifier === href &&
                referenceToOther.type === "link_href" &&
                referenceToOther.subtype === rel
              ) {
                linkHintReference = referenceToOther;
                break;
              }
            }
            if (rel === "modulepreload") {
              if (linkHintReference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, {
                    rel: "preload",
                    as: "script",
                    crossorigin: undefined,
                  });
                });
              }
            }
            if (
              rel === "preload" &&
              wasConvertedFromJsModule(linkHintReference)
            ) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { crossorigin: undefined });
              });
            }
          },
          script: (node) => {
            const { type } = analyzeScriptNode(node);
            if (type !== "js_module") {
              return;
            }
            const src = getHtmlNodeAttribute(node, "src");
            const text = getHtmlNodeText(node);
            let scriptReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (referenceToOther.type !== "script") {
                continue;
              }
              if (src && referenceToOther.generatedSpecifier === src) {
                scriptReference = referenceToOther;
                break;
              }
              if (text) {
                if (referenceToOther.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
                if (referenceToOther.urlInfo.content === text) {
                  scriptReference = referenceToOther;
                  break;
                }
              }
            }
            if (!wasConvertedFromJsModule(scriptReference)) {
              return;
            }
            mutations.push(() => {
              setHtmlNodeAttributes(node, { type: undefined });
            });
          },
        });
        await Promise.all(mutations.map((mutation) => mutation()));
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: urlInfo.context.dev,
        });
      },
    },
  };
};

const wasConvertedFromJsModule = (reference) => {
  if (reference.expectedType === "js_classic") {
    // check if a prev version was using js module
    if (reference.original) {
      if (reference.original.expectedType === "js_module") {
        return true;
      }
    }
  }
  return false;
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
  const turnIntoJsClassicProxy = (reference) => {
    reference.mutation = (magicSource) => {
      const { typePropertyNode } = reference.astInfo;
      magicSource.replace({
        start: typePropertyNode.value.start,
        end: typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      });
    };
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  const createWorkerPlugin = (subtype) => {
    return {
      name: `jsenv:js_module_fallback_on_${subtype}`,
      appliesDuring: "*",
      init: (context) => {
        if (Object.keys(context.runtimeCompat).toString() === "node") {
          return false;
        }
        if (context.isSupportedOnCurrentClients(`${subtype}_type_module`)) {
          return false;
        }

        return true;
      },
      redirectReference: {
        js_url: (reference) => {
          if (reference.expectedType !== "js_module") {
            return null;
          }
          if (reference.expectedSubtype !== subtype) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        },
      },
    };
  };

  return [
    createWorkerPlugin("worker"),
    createWorkerPlugin("service_worker"),
    createWorkerPlugin("shared_worker"),
  ];
};

const jsenvPluginImportMetaResolve = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const magicSource = createMagicSource(urlInfo.content);
        for (const referenceToOther of urlInfo.referenceToOthersSet) {
          if (referenceToOther.subtype === "import_meta_resolve") {
            const originalSpecifierLength = Buffer.byteLength(
              referenceToOther.specifier,
            );
            const specifierLength = Buffer.byteLength(
              referenceToOther.generatedSpecifier.slice(1, -1), // remove `"` around
            );
            const specifierLengthDiff =
              specifierLength - originalSpecifierLength;
            const { node } = referenceToOther.astInfo;
            const end = node.end + specifierLengthDiff;
            magicSource.replace({
              start: node.start,
              end,
              replacement: `new URL(${referenceToOther.generatedSpecifier}, import.meta.url).href`,
            });
            const currentLengthBeforeSpecifier = "import.meta.resolve(".length;
            const newLengthBeforeSpecifier = "new URL(".length;
            const lengthDiff =
              currentLengthBeforeSpecifier - newLengthBeforeSpecifier;
            referenceToOther.specifierColumn -= lengthDiff;
            referenceToOther.specifierStart -= lengthDiff;
            referenceToOther.specifierEnd =
              referenceToOther.specifierStart +
              Buffer.byteLength(referenceToOther.generatedSpecifier);
          }
        }
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};

const require = createRequire(import.meta.url);

const jsenvPluginTopLevelAwait = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("top_level_await")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const usesTLA = await usesTopLevelAwait(urlInfo);
        if (!usesTLA) {
          return null;
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              require("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
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
              },
            ],
          ],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        return {
          content: code,
          sourcemap: map,
        };
      },
    },
  };
};

const usesTopLevelAwait = async (urlInfo) => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait],
    input: urlInfo.content,
    inputIsJsModule: true,
    inputUrl: urlInfo.originalUrl,
    outputUrl: urlInfo.generatedUrl,
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
          AwaitExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction || closestFunction.type === "Program") {
              usesTopLevelAwait = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      },
    },
  };
};

const jsenvPluginJsModuleFallback = ({ remapImportSpecifier } = {}) => {
  const needJsModuleFallback = (context) => {
    if (Object.keys(context.clientRuntimeCompat).includes("node")) {
      return false;
    }
    if (
      context.versioning &&
      context.versioningViaImportmap &&
      !context.isSupportedOnCurrentClients("importmap")
    ) {
      return true;
    }
    if (
      !context.isSupportedOnCurrentClients("script_type_module") ||
      !context.isSupportedOnCurrentClients("import_dynamic") ||
      !context.isSupportedOnCurrentClients("import_meta")
    ) {
      return true;
    }
    return false;
  };

  return [
    jsenvPluginJsModuleFallbackInsideHtml({ needJsModuleFallback }),
    jsenvPluginJsModuleFallbackOnWorkers(),
    jsenvPluginJsModuleConversion({ remapImportSpecifier }),
    // must come after jsModuleFallback because it's related to the module format
    // so we want to want to know the module format before transforming things
    // - top level await
    // - import.meta.resolve()
    jsenvPluginImportMetaResolve({ needJsModuleFallback }),
    jsenvPluginTopLevelAwait({ needJsModuleFallback }),
  ];
};

const convertJsClassicToJsModule = async ({
  isWebWorker,
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [[babelPluginReplaceTopLevelThis, { isWebWorker }]],
    input,
    inputIsJsModule: false,
    inputUrl,
    outputUrl,
  });
  const sourcemap = await composeTwoSourcemaps(inputSourcemap, map);
  return {
    content: code,
    sourcemap,
  };
};

const babelPluginReplaceTopLevelThis = () => {
  return {
    name: "replace-top-level-this",
    visitor: {
      Program: (programPath, state) => {
        const { isWebWorker } = state.opts;
        programPath.traverse({
          ThisExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction) {
              path.replaceWithSourceString(isWebWorker ? "self" : "window");
            }
          },
        });
      },
    },
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
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      const filename = urlToFilename$1(reference.url);
      const [basename] = splitFileExtension$1(filename);
      reference.filenameHint = `${basename}.mjs`;
    }
  };

  return {
    name: "jsenv:as_js_module",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_module")) {
        markAsJsModuleProxy(reference);
      }
    },
    fetchUrlContent: async (urlInfo) => {
      const jsClassicUrlInfo = urlInfo.getWithoutSearchParam("as_js_module", {
        // override the expectedType to "js_classic"
        // because when there is ?as_js_module it means the underlying resource
        // is js_classic
        expectedType: "js_classic",
      });
      if (!jsClassicUrlInfo) {
        return null;
      }
      await jsClassicUrlInfo.cook();
      const { content, sourcemap } = await convertJsClassicToJsModule({
        input: jsClassicUrlInfo.content,
        inputSourcemap: jsClassicUrlInfo.sourcemap,
        inputUrl: jsClassicUrlInfo.url,
        outputUrl: jsClassicUrlInfo.generatedUrl,
        isWebWorker: isWebWorkerUrlInfo$1(urlInfo),
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsClassicUrlInfo.originalUrl,
        originalContent: jsClassicUrlInfo.originalContent,
        sourcemap,
        data: jsClassicUrlInfo.data,
      };
    },
  };
};

const isWebWorkerUrlInfo$1 = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
};

const splitFileExtension$1 = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const applyCssTranspilation = async ({
  input,
  inputUrl,
  runtimeCompat,
}) => {
  // https://lightningcss.dev/docs.html
  const { transform } = await import("lightningcss");
  const targets = runtimeCompatToTargets(runtimeCompat);
  const { code, map } = transform({
    filename: fileURLToPath(inputUrl),
    code: Buffer.from(input),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true,
    },
  });
  return { content: String(code), sourcemap: map };
};

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {};
  ["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits(version);
    }
  });
  return targets;
};

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};

const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo) => {
        return applyCssTranspilation({
          input: urlInfo.content,
          inputUrl: urlInfo.originalUrl,
          runtimeCompat: urlInfo.context.runtimeCompat,
        });
      },
    },
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
  css = true, // TODO
  // build sets jsModuleFallback: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallback = true,
  babelHelpersAsImport = true,
}) => {
  if (importAssertions === true) {
    importAssertions = {};
  }
  if (jsModuleFallback === true) {
    jsModuleFallback = {};
  }
  return [
    // babel also so that rollup can bundle babel helpers for instance
    jsenvPluginBabel({
      babelHelpersAsImport,
    }),
    jsenvPluginAsJsModule(),
    ...(jsModuleFallback ? [jsenvPluginJsModuleFallback()] : []),
    ...(importAssertions
      ? [jsenvPluginImportAssertions(importAssertions)]
      : []),

    ...(css ? [jsenvPluginCssTranspilation()] : []),
  ];
};

const watchSourceFiles = (
  sourceDirectoryUrl,
  callback,
  { sourceFileConfig = {}, keepProcessAlive, cooldownBetweenFileEvents },
) => {
  // Project should use a dedicated directory (usually "src/")
  // passed to the dev server via "sourceDirectoryUrl" param
  // In that case all files inside the source directory should be watched
  // But some project might want to use their root directory as source directory
  // In that case source directory might contain files matching "node_modules/*" or ".git/*"
  // And jsenv should not consider these as source files and watch them (to not hurt performances)
  const watchPatterns = {
    "**/*": true, // by default watch everything inside the source directory
    // line below is commented until @jsenv/url-meta fixes the fact that is matches
    // any file with an extension
    "**/.*": false, // file starting with a dot -> do not watch
    "**/.*/": false, // directory starting with a dot -> do not watch
    "**/node_modules/": false, // node_modules directory -> do not watch
    ...sourceFileConfig,
  };
  const stopWatchingSourceFiles = registerDirectoryLifecycle(
    sourceDirectoryUrl,
    {
      watchPatterns,
      cooldownBetweenFileEvents,
      keepProcessAlive,
      recursive: true,
      added: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "added",
        });
      },
      updated: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "modified",
        });
      },
      removed: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "removed",
        });
      },
    },
  );
  stopWatchingSourceFiles.watchPatterns = watchPatterns;
  return stopWatchingSourceFiles;
};

const GRAPH_VISITOR = {};

GRAPH_VISITOR.map = (graph, callback) => {
  const array = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    array.push(callback(urlInfo));
  });
  return array;
};
GRAPH_VISITOR.forEach = (graph, callback) => {
  graph.urlInfoMap.forEach(callback);
};
GRAPH_VISITOR.filter = (graph, callback) => {
  const urlInfos = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    if (callback(urlInfo)) {
      urlInfos.push(urlInfo);
    }
  });
  return urlInfos;
};
GRAPH_VISITOR.find = (graph, callback) => {
  let found = null;
  for (const urlInfo of graph.urlInfoMap.values()) {
    if (callback(urlInfo)) {
      found = urlInfo;
      break;
    }
  }
  return found;
};
GRAPH_VISITOR.findDependent = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependentUrlInfo) => {
    if (seen.has(dependentUrlInfo.url)) {
      return false;
    }
    seen.add(dependentUrlInfo.url);
    if (visitor(dependentUrlInfo)) {
      found = dependentUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    // When cookin html inline content, html dependencies are not yet updated
    // consequently htmlUrlInfo.dependencies is empty
    // and inlineContentUrlInfo.referenceFromOthersSet is empty as well
    // in that case we resort to isInline + inlineUrlSite to establish the dependency
    if (currentUrlInfo.isInline) {
      const parentUrl = currentUrlInfo.inlineUrlSite.url;
      const parentUrlInfo = graph.getUrlInfo(parentUrl);
      visit(parentUrlInfo);
      if (found) {
        return;
      }
    }
    for (const referenceFromOther of currentUrlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (visit(urlInfoReferencingThisOne)) {
        if (found) {
          break;
        }
        iterate(urlInfoReferencingThisOne);
      }
    }
  };
  iterate(urlInfo);
  return found;
};
GRAPH_VISITOR.findDependency = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependencyUrlInfo) => {
    if (seen.has(dependencyUrlInfo.url)) {
      return false;
    }
    seen.add(dependencyUrlInfo.url);
    if (visitor(dependencyUrlInfo)) {
      found = dependencyUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    for (const referenceToOther of currentUrlInfo.referenceToOthersSet) {
      const referencedUrlInfo = graph.getUrlInfo(referenceToOther);
      if (visit(referencedUrlInfo)) {
        if (found) {
          break;
        }
        iterate(referencedUrlInfo);
      }
    }
  };
  iterate(urlInfo);
  return found;
};

// This function will be used in "build.js"
// by passing rootUrlInfo as first arg
// -> this ensure we visit only urls with strong references
// because we start from root and ignore weak ref
// The alternative would be to iterate on urlInfoMap
// and call urlInfo.isUsed() but that would be more expensive
GRAPH_VISITOR.forEachUrlInfoStronglyReferenced = (initialUrlInfo, callback) => {
  const seen = new Set();
  seen.add(initialUrlInfo);
  const iterateOnReferences = (urlInfo) => {
    for (const referenceToOther of urlInfo.referenceToOthersSet) {
      if (referenceToOther.isWeak) {
        continue;
      }
      if (referenceToOther.gotInlined()) {
        continue;
      }
      const referencedUrlInfo = referenceToOther.urlInfo;
      if (seen.has(referencedUrlInfo)) {
        continue;
      }
      seen.add(referencedUrlInfo);
      callback(referencedUrlInfo);
      iterateOnReferences(referencedUrlInfo);
    }
  };
  iterateOnReferences(initialUrlInfo);
  seen.clear();
};

const createEventEmitter = () => {
  const callbackSet = new Set();
  const on = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };
  const off = (callback) => {
    callbackSet.delete(callback);
  };
  const emit = (...args) => {
    callbackSet.forEach((callback) => {
      callback(...args);
    });
  };
  return { on, off, emit };
};

const urlSpecifierEncoding = {
  encode: (reference) => {
    const { generatedSpecifier } = reference;
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
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
    const value = formatter
      ? formatter.encode(generatedSpecifier)
      : generatedSpecifier;
    if (reference.escape) {
      return reference.escape(value);
    }
    return value;
  },
  decode: (reference) => {
    const formatter = formatters[reference.type];
    return formatter
      ? formatter.decode(reference.generatedSpecifier)
      : reference.generatedSpecifier;
  },
};
const formatters = {
  "js_import": { encode: JSON.stringify, decode: JSON.parse },
  "js_url": { encode: JSON.stringify, decode: JSON.parse },
  "css_@import": { encode: JSON.stringify, decode: JSON.stringify },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
    encode: (url) => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url);
      // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls
      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
      return url;
    },
    decode: (url) => {
      const firstChar = url[0];
      const lastChar = url[url.length - 1];
      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1);
      }
      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1);
      }
      return url;
    },
  },
};

// the following apis are creating js entry points:
// - new Worker()
// - new SharedWorker()
// - navigator.serviceWorker.register()
const isWebWorkerEntryPointReference = (reference) => {
  if (reference.subtype === "new_url_first_arg") {
    return ["worker", "service_worker", "shared_worker"].includes(
      reference.expectedSubtype,
    );
  }
  return [
    "new_worker_first_arg",
    "new_shared_worker_first_arg",
    "service_worker_register_first_arg",
  ].includes(reference.subtype);
};

const isWebWorkerUrlInfo = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
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

const prependContent = async (
  urlInfoReceivingCode,
  urlInfoToPrepend,
) => {
  // we could also implement:
  // - prepend svg in html
  // - prepend css in html
  // - prepend css in css
  // - maybe more?
  // but no need for now
  if (
    urlInfoReceivingCode.type === "html" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInHtml(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_classic" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInJsClassic(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_module" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    await prependJsClassicInJsModule(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  throw new Error(
    `cannot prepend content from "${urlInfoToPrepend.type}" into "${urlInfoReceivingCode.type}"`,
  );
};

const prependJsClassicInHtml = (htmlUrlInfo, urlInfoToPrepend) => {
  const htmlAst = parseHtmlString(htmlUrlInfo.content);
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: urlInfoToPrepend.content,
      ...(urlInfoToPrepend.url
        ? { "inlined-from-src": urlInfoToPrepend.url }
        : {}),
    }),
    "jsenv:core",
  );
  const content = stringifyHtmlAst(htmlAst);
  htmlUrlInfo.mutateContent({ content });
};

const prependJsClassicInJsClassic = (jsUrlInfo, urlInfoToPrepend) => {
  const magicSource = createMagicSource(jsUrlInfo.content);
  magicSource.prepend(`${urlInfoToPrepend.content}\n\n`);
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    jsUrlInfo.sourcemap,
    magicResult.sourcemap,
  );
  jsUrlInfo.mutateContent({
    content: magicResult.content,
    sourcemap,
  });
};

const prependJsClassicInJsModule = async (jsUrlInfo, urlInfoToPrepend) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      [
        babelPluginPrependCodeInJsModule,
        { codeToPrepend: urlInfoToPrepend.content },
      ],
    ],
    input: jsUrlInfo.content,
    inputIsJsModule: true,
    inputUrl: jsUrlInfo.originalUrl,
  });
  jsUrlInfo.mutateContent({
    content: code,
    sourcemap: map,
  });
};
const babelPluginPrependCodeInJsModule = (babel) => {
  return {
    name: "prepend-code-in-js-module",
    visitor: {
      Program: (programPath, state) => {
        const { codeToPrepend } = state.opts;
        const astToPrepend = babel.parse(codeToPrepend);
        const bodyNodePaths = programPath.get("body");
        for (const bodyNodePath of bodyNodePaths) {
          if (bodyNodePath.node.type === "ImportDeclaration") {
            continue;
          }
          bodyNodePath.insertBefore(astToPrepend.program.body);
          return;
        }
        bodyNodePaths.unshift(astToPrepend.program.body);
      },
    },
  };
};

let referenceId = 0;

const createDependencies = (ownerUrlInfo) => {
  const { referenceToOthersSet } = ownerUrlInfo;

  const startCollecting = async (callback) => {
    const prevReferenceToOthersSet = new Set(referenceToOthersSet);
    referenceToOthersSet.clear();

    const stopCollecting = () => {
      for (const prevReferenceToOther of prevReferenceToOthersSet) {
        applyDependencyRemovalEffects(prevReferenceToOther);
      }
      prevReferenceToOthersSet.clear();
    };

    try {
      await callback();
    } finally {
      // finally to ensure reference are updated even in case of error
      stopCollecting();
    }
  };

  const createResolveAndFinalize = (props) => {
    const originalReference = createReference({
      ownerUrlInfo,
      ...props,
    });
    const reference = originalReference.resolve();
    reference.finalize();
    return reference;
  };

  const found = ({ trace, ...rest }) => {
    if (trace === undefined) {
      trace = traceFromUrlSite(
        adjustUrlSite(ownerUrlInfo, {
          url: ownerUrlInfo.url,
          line: rest.specifierLine,
          column: rest.specifierColumn,
        }),
      );
    }
    const reference = createResolveAndFinalize({
      trace,
      ...rest,
    });
    return reference;
  };
  const foundInline = ({
    isOriginalPosition,
    specifierLine,
    specifierColumn,
    ...rest
  }) => {
    const parentUrl = isOriginalPosition
      ? ownerUrlInfo.url
      : ownerUrlInfo.generatedUrl;
    const parentContent = isOriginalPosition
      ? ownerUrlInfo.originalContent
      : ownerUrlInfo.content;
    const reference = createResolveAndFinalize({
      trace: traceFromUrlSite({
        url: parentUrl,
        content: parentContent,
        line: specifierLine,
        column: specifierColumn,
      }),
      isOriginalPosition,
      specifierLine,
      specifierColumn,
      isInline: true,
      ...rest,
    });
    return reference;
  };
  // side effect file
  const foundSideEffectFile = async ({ sideEffectFileUrl, trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }
    const sideEffectFileReference = ownerUrlInfo.dependencies.inject({
      trace,
      type: "side_effect_file",
      specifier: sideEffectFileUrl,
      ...rest,
    });

    const injectAsBannerCodeBeforeFinalize = (urlInfoReceiver) => {
      const basename = urlToBasename(sideEffectFileUrl);
      const inlineUrl = generateUrlForInlineContent({
        url: urlInfoReceiver.url,
        basename,
        extension: urlToExtension$1(sideEffectFileUrl),
      });
      const sideEffectFileReferenceInlined = sideEffectFileReference.inline({
        ownerUrlInfo: urlInfoReceiver,
        trace,
        type: "side_effect_file",
        specifier: inlineUrl,
      });
      urlInfoReceiver.addContentTransformationCallback(async () => {
        await sideEffectFileReferenceInlined.urlInfo.cook();
        await prependContent(
          urlInfoReceiver,
          sideEffectFileReferenceInlined.urlInfo,
        );
      });
    };

    // When possible we inject code inside the file in a common ancestor
    // -> less duplication

    // During dev:
    // during dev cooking files is incremental
    // so HTML/JS is already executed by the browser
    // we can't late inject into entry point
    // During build:
    // files are not executed so it's possible to inject reference
    // when discovering a side effect file
    const visitedMap = new Map();
    let foundOrInjectedOnce = false;
    const visit = (urlInfo) => {
      urlInfo = urlInfo.findParentIfInline() || urlInfo;
      const value = visitedMap.get(urlInfo);
      if (value !== undefined) {
        return value;
      }

      // search if already referenced
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther === sideEffectFileReference) {
          continue;
        }
        if (referenceToOther.url === sideEffectFileUrl) {
          // consider this reference becomes the last reference
          // this ensure this ref is properly detected as inlined by urlInfo.isUsed()
          sideEffectFileReference.next =
            referenceToOther.next || referenceToOther;
          foundOrInjectedOnce = true;
          visitedMap.set(urlInfo, true);
          return true;
        }
        if (
          referenceToOther.original &&
          referenceToOther.original.url === sideEffectFileUrl
        ) {
          // consider this reference becomes the last reference
          // this ensure this ref is properly detected as inlined by urlInfo.isUsed()
          sideEffectFileReference.next =
            referenceToOther.next || referenceToOther;
          foundOrInjectedOnce = true;
          visitedMap.set(urlInfo, true);
          return true;
        }
      }
      // not referenced and we reach an entry point, stop there
      if (urlInfo.isEntryPoint) {
        foundOrInjectedOnce = true;
        visitedMap.set(urlInfo, true);
        injectAsBannerCodeBeforeFinalize(urlInfo);
        return true;
      }
      visitedMap.set(urlInfo, false);
      for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
        const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
        visit(urlInfoReferencingThisOne);
        // during dev the first urlInfo where we inject the side effect file is enough
        // during build we want to inject into every possible entry point
        if (foundOrInjectedOnce && urlInfo.context.dev) {
          break;
        }
      }
      return false;
    };
    visit(ownerUrlInfo);
    if (ownerUrlInfo.context.dev && !foundOrInjectedOnce) {
      injectAsBannerCodeBeforeFinalize(
        ownerUrlInfo.findParentIfInline() || ownerUrlInfo,
      );
    }
  };

  const inject = ({ trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }
    const reference = createResolveAndFinalize({
      trace,
      injected: true,
      ...rest,
    });
    return reference;
  };

  return {
    startCollecting,
    createResolveAndFinalize,
    found,
    foundInline,
    foundSideEffectFile,
    inject,
  };
};

/*
 * - "http_request"
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
 * - "side_effect_file"
 * */
const createReference = ({
  ownerUrlInfo,
  data = {},
  trace,
  type,
  subtype,
  expectedContentType,
  expectedType,
  expectedSubtype,
  filenameHint,
  integrity,
  crossorigin,
  specifier,
  specifierStart,
  specifierEnd,
  specifierLine,
  specifierColumn,
  baseUrl,
  isOriginalPosition,
  isEntryPoint = false,
  isResourceHint = false,
  // implicit references are not real references
  // they represent an abstract relationship
  isImplicit = false,
  // weak references cannot keep the corresponding url info alive
  // there must be an other reference to keep the url info alive
  // an url referenced solely by weak references is:
  // - not written in build directory
  // - can be removed from graph during dev/build
  // - not cooked until referenced by a strong reference
  isWeak = false,
  hasVersioningEffect = false,
  version = null,
  injected = false,
  isInline = false,
  content,
  contentType,
  leadsToADirectory = false,
  debug = false,
  original = null,
  prev = null,
  next = null,
  url = null,
  searchParams = null,
  generatedUrl = null,
  generatedSpecifier = null,
  urlInfo = null,
  escape = null,
  importAttributes,
  astInfo = {},
  mutation,
}) => {
  if (typeof specifier !== "string") {
    if (specifier instanceof URL) {
      specifier = specifier.href;
    } else {
      throw new TypeError(`"specifier" must be a string, got ${specifier}`);
    }
  }
  const reference = {
    id: ++referenceId,
    ownerUrlInfo,
    original,
    prev,
    next,
    data,
    trace,
    url,
    urlInfo,
    searchParams,
    generatedUrl,
    generatedSpecifier,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filenameHint,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    isOriginalPosition,
    baseUrl,
    isEntryPoint,
    isResourceHint,
    isImplicit,
    implicitReferenceSet: new Set(),
    isWeak,
    hasVersioningEffect,
    version,
    injected,
    timing: {},
    leadsToADirectory,
    debug,
    // for inline resources the reference contains the content
    isInline,
    content,
    contentType,
    escape,
    // used mostly by worker and import assertions
    astInfo,
    importAttributes,
    mutation,
  };

  reference.resolve = () => {
    const resolvedReference =
      reference.ownerUrlInfo.context.resolveReference(reference);
    return resolvedReference;
  };

  reference.redirect = (url, props = {}) => {
    const redirectedProps = getRedirectedReferenceProps(reference, url);
    const referenceRedirected = createReference({
      ...redirectedProps,
      ...props,
    });
    reference.next = referenceRedirected;
    return referenceRedirected;
  };

  reference.finalize = () => {
    if (reference.urlInfo) {
      return;
    }
    const kitchen = ownerUrlInfo.kitchen;
    const urlInfo = kitchen.graph.reuseOrCreateUrlInfo(reference);
    reference.urlInfo = urlInfo;
    addDependency(reference);
    ownerUrlInfo.context.finalizeReference(reference);
  };

  // "formatReferencedUrl" can be async BUT this is an exception
  // for most cases it will be sync. We want to favor the sync signature to keep things simpler
  // The only case where it needs to be async is when
  // the specifier is a `data:*` url
  // in this case we'll wait for the promise returned by
  // "formatReferencedUrl"
  reference.readGeneratedSpecifier = () => {
    if (reference.generatedSpecifier.then) {
      return reference.generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value;
        return value;
      });
    }
    return reference.generatedSpecifier;
  };

  reference.inline = ({
    line,
    column,
    // when urlInfo is given it means reference is moved into an other file
    ownerUrlInfo = reference.ownerUrlInfo,
    ...props
  }) => {
    const trace = traceFromUrlSite({
      url:
        ownerUrlInfo === undefined
          ? isOriginalPosition
            ? reference.ownerUrlInfo.url
            : reference.ownerUrlInfo.generatedUrl
          : reference.ownerUrlInfo.url,
      content:
        ownerUrlInfo === undefined
          ? isOriginalPosition
            ? reference.ownerUrlInfo.originalContent
            : reference.ownerUrlInfo.content
          : ownerUrlInfo.content,
      line,
      column,
    });
    const inlineCopy = ownerUrlInfo.dependencies.createResolveAndFinalize({
      isInline: true,
      original: reference.original || reference,
      prev: reference,
      trace,
      injected: reference.injected,
      expectedType: reference.expectedType,
      ...props,
    });
    // the previous reference stays alive so that even after inlining
    // updating the file will invalidate the other file where it was inlined
    reference.next = inlineCopy;
    return inlineCopy;
  };

  reference.addImplicit = (props) => {
    const implicitReference = ownerUrlInfo.dependencies.inject({
      ...props,
      isImplicit: true,
    });
    reference.implicitReferenceSet.add(implicitReference);
    return implicitReference;
  };

  reference.gotInlined = () => {
    return !reference.isInline && reference.next && reference.next.isInline;
  };

  reference.remove = () => removeDependency(reference);

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

const addDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot add reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  ownerUrlInfo.referenceToOthersSet.add(reference);
  if (reference.isImplicit) {
    // an implicit reference is a reference that does not explicitely appear in the file
    // but has an impact on the file
    // -> package.json on import resolution for instance
    // in that case:
    // - file depends on the implicit file (it must autoreload if package.json is modified)
    // - cache validity for the file depends on the implicit file (it must be re-cooked if package.json is modified)
    ownerUrlInfo.implicitUrlSet.add(reference.url);
    if (ownerUrlInfo.isInline) {
      const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
        ownerUrlInfo.inlineUrlSite.url,
      );
      parentUrlInfo.implicitUrlSet.add(reference.url);
    }
  }
  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.add(reference);
  applyReferenceEffectsOnUrlInfo(reference);
  for (const implicitRef of reference.implicitReferenceSet) {
    addDependency(implicitRef);
  }
};

const removeDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (!ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return false;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot remove reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  for (const implicitRef of reference.implicitReferenceSet) {
    implicitRef.remove();
  }
  ownerUrlInfo.referenceToOthersSet.delete(reference);
  return applyDependencyRemovalEffects(reference);
};

const canAddOrRemoveReference = (reference) => {
  if (reference.isWeak || reference.isImplicit) {
    // weak and implicit references have no restrictions
    // because they are not actual references with an influence on content
    return true;
  }
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.context.build) {
    // during build url content is not executed
    // it's still possible to mutate references safely
    return true;
  }
  if (!ownerUrlInfo.contentFinalized) {
    return true;
  }
  if (ownerUrlInfo.isRoot) {
    // the root urlInfo is abstract, there is no real file behind it
    return true;
  }
  if (reference.type === "http_request") {
    // reference created to http requests are abstract concepts
    return true;
  }
  return false;
};

const applyDependencyRemovalEffects = (reference) => {
  const { ownerUrlInfo } = reference;
  const { referenceToOthersSet } = ownerUrlInfo;
  if (reference.isImplicit && !reference.isInline) {
    let hasAnOtherImplicitRef = false;
    for (const referenceToOther of referenceToOthersSet) {
      if (
        referenceToOther.isImplicit &&
        referenceToOther.url === reference.url
      ) {
        hasAnOtherImplicitRef = true;
        break;
      }
    }
    if (!hasAnOtherImplicitRef) {
      ownerUrlInfo.implicitUrlSet.delete(reference.url);
    }
  }

  const prevReference = reference.prev;
  const nextReference = reference.next;
  if (prevReference && nextReference) {
    nextReference.prev = prevReference;
    prevReference.next = nextReference;
  } else if (prevReference) {
    prevReference.next = null;
  } else if (nextReference) {
    nextReference.original = null;
    nextReference.prev = null;
  }

  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.delete(reference);

  let firstReferenceFromOther;
  for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
    if (referenceFromOther.urlInfo !== referencedUrlInfo) {
      continue;
    }
    // Here we want to know if the file is referenced by an other file.
    // So we want to ignore reference that are created by other means:
    // - "http_request"
    //   This type of reference is created when client request a file
    //   that we don't know yet
    //   1. reference(s) to this file are not yet discovered
    //   2. there is no reference to this file
    if (referenceFromOther.type === "http_request") {
      continue;
    }
    if (referenceFromOther.gotInlined()) {
      // the url info was inlined, an other reference is required
      // to consider the non-inlined urlInfo as used
      continue;
    }
    firstReferenceFromOther = referenceFromOther;
    break;
  }
  if (firstReferenceFromOther) {
    // either applying new ref should override old ref
    // or we should first remove effects before adding new ones
    // for now we just set firstReference to null
    if (reference === referencedUrlInfo.firstReference) {
      referencedUrlInfo.firstReference = null;
      applyReferenceEffectsOnUrlInfo(firstReferenceFromOther);
    }
    return false;
  }
  // referencedUrlInfo.firstReference = null;
  // referencedUrlInfo.lastReference = null;
  referencedUrlInfo.onDereferenced(reference);
  return true;
};

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const adjustUrlSite = (urlInfo, { url, line, column }) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlInfo.graph.getUrlInfo(inlineUrlSite.url);
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line:
          inlineUrlSite.line === undefined
            ? urlSite.line
            : inlineUrlSite.line + urlSite.line,
        column:
          inlineUrlSite.column === undefined
            ? urlSite.column
            : inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    );
  };
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  );
};

const getRedirectedReferenceProps = (reference, url) => {
  const redirectedProps = {
    ...reference,
    specifier: url,
    url,
    original: reference.original || reference,
    prev: reference,
  };
  return redirectedProps;
};

const applyReferenceEffectsOnUrlInfo = (reference) => {
  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.lastReference = reference;
  if (reference.isInline) {
    referencedUrlInfo.isInline = true;
    referencedUrlInfo.inlineUrlSite = {
      url: reference.ownerUrlInfo.url,
      content: reference.isOriginalPosition
        ? reference.ownerUrlInfo.originalContent
        : reference.ownerUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    };
  }

  if (
    referencedUrlInfo.firstReference &&
    !referencedUrlInfo.firstReference.isWeak
  ) {
    return;
  }
  referencedUrlInfo.firstReference = reference;
  referencedUrlInfo.originalUrl =
    referencedUrlInfo.originalUrl || reference.url;

  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    referencedUrlInfo.isEntryPoint = true;
  }
  Object.assign(referencedUrlInfo.data, reference.data);
  Object.assign(referencedUrlInfo.timing, reference.timing);
  if (reference.injected) {
    referencedUrlInfo.injected = true;
  }
  if (reference.filenameHint && !referencedUrlInfo.filenameHint) {
    referencedUrlInfo.filenameHint = reference.filenameHint;
  }
  if (reference.debug) {
    referencedUrlInfo.debug = true;
  }
  if (reference.expectedType) {
    referencedUrlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    referencedUrlInfo.subtypeHint = reference.expectedSubtype;
  }
};

const createUrlGraph = ({
  rootDirectoryUrl,
  kitchen,
  name = "anonymous",
}) => {
  const urlGraph = {};
  const urlInfoCreatedEventEmitter = createEventEmitter();
  const urlInfoDereferencedEventEmitter = createEventEmitter();

  const urlInfoMap = new Map();
  const hasUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.has(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.has(key.url);
    }
    return null;
  };
  const getUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.get(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.get(key.url);
    }
    return null;
  };

  const addUrlInfo = (urlInfo) => {
    urlInfo.graph = urlGraph;
    urlInfo.kitchen = kitchen;
    urlInfoMap.set(urlInfo.url, urlInfo);
  };
  const reuseOrCreateUrlInfo = (reference, useGeneratedUrl) => {
    const referencedUrl = useGeneratedUrl
      ? reference.generatedUrl
      : reference.url;
    let referencedUrlInfo = getUrlInfo(referencedUrl);
    if (!referencedUrlInfo) {
      const ownerUrlInfo = reference.ownerUrlInfo;
      const ownerContext = ownerUrlInfo.context;
      const context = Object.create(ownerContext);
      referencedUrlInfo = createUrlInfo(referencedUrl, context);
      addUrlInfo(referencedUrlInfo);
      urlInfoCreatedEventEmitter.emit(referencedUrlInfo);
    }
    if (
      referencedUrlInfo.searchParams.size > 0 &&
      kitchen.context.buildStep !== "shape"
    ) {
      // A resource is represented by a url.
      // Variations of a resource are represented by url search params
      // Each representation of the resource is given a dedicated url info
      // object (one url -> one url info)
      // It's because search params often influence the final content returned for that url
      // When a reference contains url search params it must create 2 url infos:
      // 1. The url info corresponding to the url with search params
      // 2. The url info corresponding to url without search params
      // Because the underlying content without search params is used to generate
      // the content modified according to search params
      // This way when a file like "style.css" is considered as modified
      // references like "style.css?as_css_module" are also affected
      const urlWithoutSearch = asUrlWithoutSearch(reference.url);
      // a reference with a search param creates an implicit reference
      // to the file without search param
      const referenceWithoutSearch = reference.addImplicit({
        specifier: urlWithoutSearch,
        url: urlWithoutSearch,
        searchParams: new URLSearchParams(),
        isWeak: true,
      });
      const urlInfoWithoutSearch = referenceWithoutSearch.urlInfo;
      urlInfoWithoutSearch.searchParamVariantSet.add(referencedUrlInfo);
    }
    return referencedUrlInfo;
  };

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl);
    if (!parentUrlInfo) {
      return null;
    }
    const seen = [];
    const search = (urlInfo) => {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (urlSpecifierEncoding.decode(referenceToOther) === specifier) {
          return referenceToOther;
        }
      }
      for (const referenceToOther of parentUrlInfo.referenceToOthersSet) {
        if (seen.includes(referenceToOther.url)) {
          continue;
        }
        seen.push(referenceToOther.url);
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (referencedUrlInfo.isInline) {
          const firstRef = search(referencedUrlInfo);
          if (firstRef) {
            return firstRef;
          }
        }
      }
      return null;
    };
    return search(parentUrlInfo);
  };

  const getEntryPoints = () => {
    const entryPoints = [];
    urlInfoMap.forEach((urlInfo) => {
      if (urlInfo.isEntryPoint && urlInfo.isUsed()) {
        entryPoints.push(urlInfo);
      }
    });
    return entryPoints;
  };

  const rootUrlInfo = createUrlInfo(rootDirectoryUrl, kitchen.context);
  rootUrlInfo.isRoot = true;
  addUrlInfo(rootUrlInfo);

  Object.assign(urlGraph, {
    name,
    rootUrlInfo,

    urlInfoMap,
    reuseOrCreateUrlInfo,
    hasUrlInfo,
    getUrlInfo,
    getEntryPoints,

    inferReference,
    urlInfoCreatedEventEmitter,
    urlInfoDereferencedEventEmitter,

    toObject: () => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        data[urlInfo.url] = urlInfo;
      });
      return data;
    },
    toJSON: (rootDirectoryUrl) => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        if (urlInfo.referenceToOthersSet.size) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl);
          const referencedUrlSet = new Set();
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            data[relativeUrl] = referencedUrlSet.add(referenceToOther.url);
          }
          data[relativeUrl] = Array.from(referencedUrlSet).map(
            (referencedUrl) =>
              urlToRelativeUrl(referencedUrl, rootDirectoryUrl),
          );
        }
      });
      return data;
    },
  });
  return urlGraph;
};

const createUrlInfo = (url, context) => {
  const urlInfo = {
    isRoot: false,
    graph: null,
    kitchen: null,
    context,
    error: null,
    modifiedTimestamp: 0,
    dereferencedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {}, // plugins can put whatever they want here
    referenceToOthersSet: new Set(),
    referenceFromOthersSet: new Set(),
    firstReference: null, // first reference from an other url to this one
    lastReference: null,
    remapReference: null, // used solely during build for rollup
    implicitUrlSet: new Set(),
    searchParamVariantSet: new Set(),

    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "sourcemap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    typeHint: undefined,
    subtypeHint: undefined,
    contentType: "", // "text/html", "text/css", "text/javascript", "application/json", ...
    url: null,
    originalUrl: undefined,
    isEntryPoint: false,
    originalContent: undefined,
    originalContentAst: undefined,
    content: undefined,
    contentAst: undefined,
    contentLength: undefined,
    contentFinalized: false,

    sourcemap: null,
    sourcemapIsWrong: false,
    sourcemapReference: null,

    generatedUrl: null,
    sourcemapGeneratedUrl: null,
    filenameHint: "",
    dirnameHint: "",
    injected: false,

    isInline: false,
    inlineUrlSite: null,
    jsQuote: null, // maybe move to inlineUrlSite?

    timing: {},
    headers: {},
    debug: false,
  };
  Object.defineProperty(urlInfo, "url", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: url,
  });
  urlInfo.searchParams = new URL(url).searchParams;

  urlInfo.dependencies = createDependencies(urlInfo);
  urlInfo.isUsed = () => {
    if (urlInfo.isRoot) {
      return true;
    }
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      if (referenceFromOther.urlInfo !== urlInfo) {
        continue;
      }
      if (referenceFromOther.ownerUrlInfo.isRoot) {
        return true;
      }
      const ref = referenceFromOther.original || referenceFromOther;
      if (ref.isWeak) {
        // weak reference don't count as using the url
        continue;
      }
      if (ref.gotInlined()) {
        // the url info was inlined, an other reference is required
        // to consider the non-inlined urlInfo as used
        continue;
      }
      return ref.ownerUrlInfo.isUsed();
    }
    // nothing uses this url anymore
    // - versioning update inline content
    // - file converted for import assertion or js_classic conversion
    // - urlInfo for a file that is now inlined
    return false;
  };
  urlInfo.findParentIfInline = () => {
    let currentUrlInfo = urlInfo;
    const graph = urlInfo.graph;
    while (currentUrlInfo.isInline) {
      const parentUrlInfo = graph.getUrlInfo(currentUrlInfo.inlineUrlSite.url);
      if (!parentUrlInfo.isInline) {
        return parentUrlInfo;
      }
      currentUrlInfo = parentUrlInfo;
    }
    return null;
  };
  urlInfo.findDependent = (callback) => {
    return GRAPH_VISITOR.findDependent(urlInfo, callback);
  };
  urlInfo.isSearchParamVariantOf = (otherUrlInfo) => {
    if (urlInfo.searchParams.size === 0) {
      return false;
    }
    if (otherUrlInfo.searchParams.size > 0) {
      return false;
    }
    const withoutSearch = asUrlWithoutSearch(urlInfo.url);
    if (withoutSearch === otherUrlInfo.url) {
      return true;
    }
    return false;
  };
  urlInfo.getWithoutSearchParam = (searchParam, { expectedType } = {}) => {
    // The search param can be
    // 1. injected by a plugin during "redirectReference"
    //    - import assertions
    //    - js module fallback to systemjs
    // 2. already inside source files
    //    - turn js module into js classic for convenience ?as_js_classic
    //    - turn js classic to js module for to make it importable
    if (!urlInfo.searchParams.has(searchParam)) {
      return null;
    }
    const reference = urlInfo.firstReference;
    const newSpecifier = injectQueryParamsIntoSpecifier(reference.specifier, {
      [searchParam]: undefined,
    });
    const referenceWithoutSearchParam = reference.addImplicit({
      type: reference.type,
      subtype: reference.subtype,
      expectedContentType: reference.expectedContentType,
      expectedType: expectedType || reference.expectedType,
      expectedSubtype: reference.expectedSubtype,
      integrity: reference.integrity,
      crossorigin: reference.crossorigin,
      specifierStart: reference.specifierStart,
      specifierEnd: reference.specifierEnd,
      specifierLine: reference.specifierLine,
      specifierColumn: reference.specifierColumn,
      baseUrl: reference.baseUrl,
      isOriginalPosition: reference.isOriginalPosition,
      // ok mais cet ref est implicite + weak
      // donc ne devrait pas etre retournée par getEntryPoints()
      isEntryPoint: reference.isEntryPoint,
      isResourceHint: reference.isResourceHint,
      hasVersioningEffect: reference.hasVersioningEffect,
      version: reference.version,
      content: reference.content,
      contentType: reference.contentType,
      leadsToADirectory: reference.leadsToADirectory,
      debug: reference.debug,
      importAttributes: reference.importAttributes,
      astInfo: reference.astInfo,
      mutation: reference.mutation,
      data: { ...reference.data },
      specifier: newSpecifier,
      isWeak: true,
      isInline: reference.isInline,
      original: reference.original || reference,
      prev: reference,
      // urlInfo: null,
      // url: null,
      // generatedUrl: null,
      // generatedSpecifier: null,
      // filename: null,
    });
    reference.next = referenceWithoutSearchParam;
    return referenceWithoutSearchParam.urlInfo;
  };
  urlInfo.onModified = ({ modifiedTimestamp = Date.now() } = {}) => {
    const visitedSet = new Set();
    const iterate = (urlInfo) => {
      if (visitedSet.has(urlInfo)) {
        return;
      }
      visitedSet.add(urlInfo);
      urlInfo.modifiedTimestamp = modifiedTimestamp;
      urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (referencedUrlInfo.isInline) {
          iterate(referencedUrlInfo);
        }
      }
      for (const searchParamVariant of urlInfo.searchParamVariantSet) {
        iterate(searchParamVariant);
      }
    };
    iterate(urlInfo);
  };
  urlInfo.onDereferenced = (lastReferenceFromOther) => {
    urlInfo.dereferencedTimestamp = Date.now();
    urlInfo.graph.urlInfoDereferencedEventEmitter.emit(
      urlInfo,
      lastReferenceFromOther,
    );
  };

  // not used for now
  // urlInfo.deleteFromGraph = () => {
  //   urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
  //   urlInfo.graph.urlInfoMap.delete(url);
  //   urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
  //     referenceToOther.remove();
  //   });
  //   if (urlInfo.searchParams.size > 0) {
  //     const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
  //     const urlInfoWithoutSearch = urlInfo.graph.getUrlInfo(urlWithoutSearch);
  //     if (urlInfoWithoutSearch) {
  //       urlInfoWithoutSearch.searchParamVariantSet.delete(urlInfo);
  //     }
  //   }
  // };
  urlInfo.cook = (customContext) => {
    return urlInfo.context.cook(urlInfo, customContext);
  };
  urlInfo.cookDependencies = (options) => {
    return urlInfo.context.cookDependencies(urlInfo, options);
  };
  urlInfo.fetchContent = () => {
    return urlInfo.context.fetchUrlContent(urlInfo);
  };
  urlInfo.transformContent = () => {
    return urlInfo.context.transformUrlContent(urlInfo);
  };
  urlInfo.finalizeContent = () => {
    return urlInfo.context.finalizeUrlContent(urlInfo);
  };
  urlInfo.mutateContent = (transformations) => {
    return urlInfo.kitchen.urlInfoTransformer.applyTransformations(
      urlInfo,
      transformations,
    );
  };

  const contentTransformationCallbackSet = new Set();
  urlInfo.addContentTransformationCallback = (callback) => {
    if (urlInfo.contentFinalized) {
      if (urlInfo.context.dev) {
        throw new Error(
          `cannot add a transform callback on content already sent to the browser.
--- content url ---
${urlInfo.url}`,
        );
      }
      urlInfo.context.addLastTransformationCallback(callback);
    } else {
      contentTransformationCallbackSet.add(callback);
    }
  };
  urlInfo.applyContentTransformationCallbacks = async () => {
    for (const contentTransformationCallback of contentTransformationCallbackSet) {
      await contentTransformationCallback();
    }
    contentTransformationCallbackSet.clear();
  };

  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};

const HOOK_NAMES = [
  "init",
  "serve", // is called only during dev/tests
  "resolveReference",
  "redirectReference",
  "transformReferenceSearchParams",
  "formatReference",
  "fetchUrlContent",
  "transformUrlContent",
  "finalizeUrlContent",
  "bundle", // is called only during build
  "optimizeUrlContent", // is called only during build
  "cooked",
  "augmentResponse", // is called only during dev/tests
  "destroy",
];

const createPluginController = (
  kitchenContext,
  initialPuginsMeta = {},
) => {
  const pluginsMeta = initialPuginsMeta;

  kitchenContext.getPluginMeta = (id) => {
    const value = pluginsMeta[id];
    return value;
  };

  const plugins = [];
  // precompute a list of hooks per hookName for one major reason:
  // - When debugging, there is less iteration
  // also it should increase perf as there is less work to do
  const hookGroups = {};
  const addPlugin = (plugin, { position = "end" }) => {
    if (Array.isArray(plugin)) {
      if (position === "start") {
        plugin = plugin.slice().reverse();
      }
      plugin.forEach((plugin) => {
        addPlugin(plugin, { position });
      });
      return;
    }
    if (plugin === null || typeof plugin !== "object") {
      throw new TypeError(`plugin must be objects, got ${plugin}`);
    }
    if (!plugin.name) {
      plugin.name = "anonymous";
    }
    if (!testAppliesDuring(plugin) || !initPlugin(plugin)) {
      if (plugin.destroy) {
        plugin.destroy();
      }
      return;
    }
    plugins.push(plugin);
    for (const key of Object.keys(plugin)) {
      if (key === "meta") {
        const value = plugin[key];
        if (typeof value !== "object" || value === null) {
          console.warn(`plugin.meta must be an object, got ${value}`);
          continue;
        }
        Object.assign(pluginsMeta, value);
        // any extension/modification on plugin.meta
        // won't be taken into account so we freeze object
        // to throw in case it happen
        Object.freeze(value);
        continue;
      }

      if (
        key === "name" ||
        key === "appliesDuring" ||
        key === "init" ||
        key === "serverEvents"
      ) {
        continue;
      }
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(`Unexpected "${key}" property on "${plugin.name}" plugin`);
        continue;
      }
      const hookName = key;
      const hookValue = plugin[hookName];
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = []);
        const hook = {
          plugin,
          name: hookName,
          value: hookValue,
        };
        if (position === "start") {
          group.unshift(hook);
        } else {
          group.push(hook);
        }
      }
    }
  };
  const testAppliesDuring = (plugin) => {
    const { appliesDuring } = plugin;
    if (appliesDuring === undefined) {
      // console.debug(`"appliesDuring" is undefined on ${pluginEntry.name}`)
      return true;
    }
    if (appliesDuring === "*") {
      return true;
    }
    if (typeof appliesDuring === "string") {
      if (appliesDuring !== "dev" && appliesDuring !== "build") {
        throw new TypeError(
          `"appliesDuring" must be "dev" or "build", got ${appliesDuring}`,
        );
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
    throw new TypeError(
      `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
    );
  };
  const initPlugin = (plugin) => {
    if (plugin.init) {
      const initReturnValue = plugin.init(kitchenContext, plugin);
      if (initReturnValue === false) {
        return false;
      }
      if (typeof initReturnValue === "function" && !plugin.destroy) {
        plugin.destroy = initReturnValue;
      }
    }
    return true;
  };
  const pushPlugin = (plugin) => {
    addPlugin(plugin, { position: "end" });
  };
  const unshiftPlugin = (plugin) => {
    addPlugin(plugin, { position: "start" });
  };

  let lastPluginUsed = null;
  let currentPlugin = null;
  let currentHookName = null;
  const callHook = (hook, info) => {
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
    let valueReturned = hookFn(info);
    currentPlugin = null;
    currentHookName = null;
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance$1.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    return valueReturned;
  };
  const callAsyncHook = async (hook, info) => {
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
    let valueReturned = await hookFn(info);
    currentPlugin = null;
    currentHookName = null;
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance$1.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    return valueReturned;
  };

  const callHooks = (hookName, info, callback) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      const setHookParams = (firstArg = info) => {
        info = firstArg;
      };
      for (const hook of hooks) {
        const returnValue = callHook(hook, info);
        if (returnValue && callback) {
          callback(returnValue, hook.plugin, setHookParams);
        }
      }
    }
  };
  const callAsyncHooks = async (hookName, info, callback) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = await callAsyncHook(hook, info);
        if (returnValue && callback) {
          await callback(returnValue, hook.plugin);
        }
      }
    }
  };

  const callHooksUntil = (hookName, info) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info);
        if (returnValue) {
          return returnValue;
        }
      }
    }
    return null;
  };
  const callAsyncHooksUntil = (hookName, info) => {
    const hooks = hookGroups[hookName];
    if (!hooks) {
      return null;
    }
    if (hooks.length === 0) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= hooks.length) {
          return resolve();
        }
        const hook = hooks[index];
        const returnValue = callAsyncHook(hook, info);
        return Promise.resolve(returnValue).then((output) => {
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
    pluginsMeta,
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
    getCurrentHookName: () => currentHookName,
  };
};

const getHookFunction = (
  hook,
  // can be undefined, reference, or urlInfo
  info = {},
) => {
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

const assertAndNormalizeReturnValue = (hook, returnValue, info) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue;
  }
  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hook.name)) {
      continue;
    }
    const assertionResult = returnValueAssertion.assertion(
      returnValue,
      info,
      hook,
    );
    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult;
      break;
    }
  }
  return returnValue;
};

const returnValueAssertions = [
  {
    name: "url_assertion",
    appliesTo: ["resolveReference", "redirectReference"],
    assertion: (valueReturned) => {
      if (valueReturned instanceof URL) {
        return valueReturned.href;
      }
      if (typeof valueReturned === "string") {
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string; got ${valueReturned}`,
      );
    },
  },
  {
    name: "content_assertion",
    appliesTo: [
      "fetchUrlContent",
      "transformUrlContent",
      "finalizeUrlContent",
      "optimizeUrlContent",
    ],
    assertion: (valueReturned, urlInfo, hook) => {
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        return { content: valueReturned };
      }
      if (typeof valueReturned === "object") {
        const { content, body } = valueReturned;
        if (urlInfo.url.startsWith("ignore:")) {
          return undefined;
        }
        if (urlInfo.type === "html") {
          const { scriptInjections } = valueReturned;
          if (scriptInjections) {
            return applyScriptInjections(urlInfo, scriptInjections, hook);
          }
        }
        if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
          throw new Error(
            `Unexpected "content" returned by plugin: it must be a string or a buffer; got ${content}`,
          );
        }
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string, a buffer or an object; got ${valueReturned}`,
      );
    },
  },
];

const applyScriptInjections = (htmlUrlInfo, scriptInjections, hook) => {
  const htmlAst = parseHtmlString(htmlUrlInfo.content);

  scriptInjections.reverse().forEach((scriptInjection) => {
    const { setup } = scriptInjection;
    if (setup) {
      const setupGlobalName = setup.name;
      const setupParamSource = stringifyParams$1(setup.param, "  ");
      const inlineJs = `${setupGlobalName}({${setupParamSource}})`;
      injectHtmlNodeAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          tagName: "script",
          textContent: inlineJs,
        }),
        hook.plugin.name,
      );
    }
    const scriptReference = htmlUrlInfo.dependencies.inject({
      type: "script",
      subtype: scriptInjection.type === "module" ? "js_module" : "js_classic",
      expectedType:
        scriptInjection.type === "module" ? "js_module" : "js_classic",
      specifier: scriptInjection.src,
    });
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        ...(scriptInjection.type === "module" ? { type: "module" } : {}),
        src: scriptReference.generatedSpecifier,
      }),
      hook.plugin.name,
    );
  });
  const htmlModified = stringifyHtmlAst(htmlAst);
  return {
    content: htmlModified,
  };
};

const stringifyParams$1 = (params, prefix = "") => {
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

const defineGettersOnPropertiesDerivedFromOriginalContent = (
  urlInfo,
) => {
  const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentAst",
  );
  if (originalContentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentAst", () => {
      return getContentAst(urlInfo.originalContent, urlInfo.type, urlInfo.url);
    });
  }
  const originalContentEtagDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentEtag",
  );
  if (originalContentEtagDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentEtag", () => {
      return bufferToEtag$1(Buffer.from(urlInfo.originalContent));
    });
  }
};

const defineGettersOnPropertiesDerivedFromContent = (urlInfo) => {
  const contentLengthDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentLength",
  );
  if (contentLengthDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentLength", () => {
      return Buffer.byteLength(urlInfo.content);
    });
  }
  const contentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentAst",
  );
  if (contentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentAst", () => {
      if (urlInfo.content === urlInfo.originalContent) {
        return urlInfo.originalContentAst;
      }
      const ast = getContentAst(urlInfo.content, urlInfo.type, urlInfo.url);
      return ast;
    });
  }
  const contentEtagDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentEtag",
  );
  if (contentEtagDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentEtag", () => {
      if (urlInfo.content === urlInfo.originalContent) {
        return urlInfo.originalContentEtag;
      }
      return getContentEtag(urlInfo.content);
    });
  }
};

const defineVolatileGetter = (object, property, getter) => {
  const restore = (value) => {
    Object.defineProperty(object, property, {
      enumerable: true,
      configurable: true,
      writable: true,
      value,
    });
  };

  Object.defineProperty(object, property, {
    enumerable: true,
    configurable: true,
    get: () => {
      const value = getter();
      restore(value);
      return value;
    },
    set: restore,
  });
};

const getContentAst = (content, type, url) => {
  if (type === "js_module") {
    return parseJsWithAcorn({
      js: content,
      url,
      isJsModule: true,
    });
  }
  if (type === "js_classic") {
    return parseJsWithAcorn({
      js: content,
      url,
    });
  }
  return null;
};

const getContentEtag = (content) => {
  return bufferToEtag$1(Buffer.from(content));
};

const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent = true,
  outDirectoryUrl,
  supervisor,
}) => {
  const formatSourcemapSource =
    typeof sourcemapsSources === "function"
      ? (source, urlInfo) => {
          return sourcemapsSources(source, urlInfo);
        }
      : sourcemapsSources === "relative"
      ? (source, urlInfo) => {
          const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
          return sourceRelative || ".";
        }
      : null;

  const normalizeSourcemap = (urlInfo, sourcemap) => {
    let { sources } = sourcemap;
    if (sources) {
      sources = sources.map((source) => {
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
      sourcemapsSourcesContent ||
      urlInfo.isInline ||
      (sources &&
        sources.some((source) => !source || !source.startsWith("file:")));
    if (sources && sources.length > 1) {
      sourcemap.sources = sources.map(
        (source) => new URL(source, urlInfo.originalUrl).href,
      );
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

  const resetContent = (urlInfo) => {
    urlInfo.contentFinalized = false;
    urlInfo.originalContent = undefined;
    urlInfo.originalContentAst = undefined;
    urlInfo.originalContentEtag = undefined;
    urlInfo.contentAst = undefined;
    urlInfo.contentEtag = undefined;
    urlInfo.contentLength = undefined;
    urlInfo.content = undefined;
    urlInfo.sourcemap = null;
    urlInfo.sourcemapIsWrong = null;
    urlInfo.sourcemapReference = null;
  };

  const setContentProperties = (
    urlInfo,
    { content, contentAst, contentEtag, contentLength },
  ) => {
    if (content === urlInfo.content) {
      return false;
    }
    urlInfo.contentAst = contentAst;
    urlInfo.contentEtag = contentEtag;
    urlInfo.contentLength = contentLength;
    urlInfo.content = content;
    defineGettersOnPropertiesDerivedFromContent(urlInfo);
    return true;
  };

  const setContent = async (
    urlInfo,
    content,
    {
      contentAst, // most of the time will be undefined
      contentEtag, // in practice it's always undefined
      contentLength,
      originalContent = content,
      originalContentAst, // most of the time will be undefined
      originalContentEtag, // in practice always undefined
      sourcemap,
    } = {},
  ) => {
    urlInfo.originalContentAst = originalContentAst;
    urlInfo.originalContentEtag = originalContentEtag;
    if (originalContent !== urlInfo.originalContent) {
      urlInfo.originalContent = originalContent;
    }
    defineGettersOnPropertiesDerivedFromOriginalContent(urlInfo);

    let may = mayHaveSourcemap(urlInfo);
    let shouldHandle = shouldHandleSourcemap(urlInfo);
    if (may && !shouldHandle) {
      content = SOURCEMAP.removeComment({
        contentType: urlInfo.contentType,
        content,
      });
    }
    setContentProperties(urlInfo, {
      content,
      contentAst,
      contentEtag,
      contentLength,
    });
    urlInfo.sourcemap = sourcemap;
    if (!may || !shouldHandle) {
      return;
    }
    // sourcemap is a special kind of reference:
    // It's a reference to a content generated dynamically the content itself.
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    const generatedUrlObject = new URL(urlInfo.generatedUrl);
    generatedUrlObject.searchParams.delete("js_module_fallback");
    generatedUrlObject.searchParams.delete("as_js_module");
    generatedUrlObject.searchParams.delete("as_js_classic");
    generatedUrlObject.searchParams.delete("as_css_module");
    generatedUrlObject.searchParams.delete("as_json_module");
    generatedUrlObject.searchParams.delete("as_text_module");
    generatedUrlObject.searchParams.delete("dynamic_import");
    generatedUrlObject.searchParams.delete("cjs_as_js_module");
    const urlForSourcemap = generatedUrlObject.href;
    urlInfo.sourcemapGeneratedUrl = generateSourcemapFileUrl(urlForSourcemap);

    // case #1: already loaded during "load" hook
    // - happens during build
    // - happens for url converted during fetch (js_module_fallback for instance)
    if (urlInfo.sourcemap) {
      urlInfo.sourcemap = normalizeSourcemap(urlInfo, urlInfo.sourcemap);
      return;
    }

    // case #2: check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    });
    if (sourcemapFound) {
      const { type, subtype, line, column, specifier } = sourcemapFound;
      const sourcemapReference = urlInfo.dependencies.found({
        type,
        subtype,
        expectedType: "sourcemap",
        specifier,
        specifierLine: line,
        specifierColumn: column,
      });
      urlInfo.sourcemapReference = sourcemapReference;
      try {
        await sourcemapReference.urlInfo.cook();
        const sourcemapRaw = JSON.parse(sourcemapReference.urlInfo.content);
        const sourcemap = normalizeSourcemap(urlInfo, sourcemapRaw);
        urlInfo.sourcemap = sourcemap;
        return;
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    }

    // case #3: will be injected once cooked
  };

  const applyTransformations = (urlInfo, transformations) => {
    if (!transformations) {
      return;
    }
    const {
      type,
      contentType,
      content,
      contentAst, // undefined most of the time
      contentEtag, // in practice always undefined
      contentLength,
      sourcemap,
      sourcemapIsWrong,
    } = transformations;
    if (type) {
      urlInfo.type = type;
    }
    if (contentType) {
      urlInfo.contentType = contentType;
    }
    const contentModified = setContentProperties(urlInfo, {
      content,
      contentAst,
      contentEtag,
      contentLength,
    });

    if (
      sourcemap &&
      mayHaveSourcemap(urlInfo) &&
      shouldHandleSourcemap(urlInfo)
    ) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      let currentSourcemap = urlInfo.sourcemap;
      const finalSourcemap = composeTwoSourcemaps(
        currentSourcemap,
        sourcemapNormalized,
      );
      const finalSourcemapNormalized = normalizeSourcemap(
        urlInfo,
        finalSourcemap,
      );
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
    if (contentModified && urlInfo.contentFinalized) {
      applyContentEffects(urlInfo);
    }
  };

  const applyContentEffects = (urlInfo) => {
    applySourcemapOnContent(urlInfo);
    writeInsideOutDirectory(urlInfo);
  };

  const writeInsideOutDirectory = (urlInfo) => {
    // writing result inside ".jsenv" directory (debug purposes)
    if (!outDirectoryUrl) {
      return;
    }
    const { generatedUrl } = urlInfo;
    if (!generatedUrl) {
      return;
    }
    if (!generatedUrl.startsWith("file:")) {
      return;
    }
    if (urlInfo.type === "directory") {
      // no need to write the directory
      return;
    }
    // if (urlInfo.content === undefined) {
    //   // Some error might lead to urlInfo.content to be null
    //   // (error hapenning before urlInfo.content can be set, or 404 for instance)
    //   // in that case we can't write anything
    //   return;
    // }

    let contentIsInlined = urlInfo.isInline;
    if (
      contentIsInlined &&
      supervisor &&
      urlInfo.graph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html"
    ) {
      contentIsInlined = false;
    }
    if (!contentIsInlined) {
      writeFileSync(new URL(generatedUrl), urlInfo.content);
    }
    const { sourcemapGeneratedUrl, sourcemapReference } = urlInfo;
    if (sourcemapGeneratedUrl && sourcemapReference) {
      writeFileSync(
        new URL(sourcemapGeneratedUrl),
        sourcemapReference.urlInfo.content,
      );
    }
  };

  const applySourcemapOnContent = (
    urlInfo,
    formatSource = formatSourcemapSource,
  ) => {
    if (!urlInfo.sourcemap || !shouldHandleSourcemap(urlInfo)) {
      return;
    }

    // during build this function can be called after the file is cooked
    // - to update content and sourcemap after "optimize" hook
    // - to inject versioning into the entry point content
    // in this scenarion we don't want to inject sourcemap reference
    // just update the content

    let sourcemapReference = urlInfo.sourcemapReference;
    if (!sourcemapReference) {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          sourcemapReference = referenceToOther;
          break;
        }
      }
      if (!sourcemapReference) {
        sourcemapReference = urlInfo.dependencies.inject({
          trace: {
            message: `sourcemap comment placeholder`,
            url: urlInfo.url,
          },
          type: "sourcemap_comment",
          subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
          expectedType: "sourcemap",
          specifier: urlInfo.sourcemapGeneratedUrl,
          isInline: sourcemaps === "inline",
        });
      }
      urlInfo.sourcemapReference = sourcemapReference;
    }
    const sourcemapUrlInfo = sourcemapReference.urlInfo;
    // It's possible urlInfo content to be modified after being finalized
    // In that case we'll recompose sourcemaps (and re-append it to file content)
    // Recomposition is done on urlInfo.sourcemap and must be done with absolute urls inside .sources
    // (so we can detect if sources are identical)
    // For this reason we must not mutate urlInfo.sourcemap.sources
    const sourcemapGenerated = {
      ...urlInfo.sourcemap,
      sources: urlInfo.sourcemap.sources.map((source) => {
        const sourceFormatted = formatSource
          ? formatSource(source, urlInfo)
          : source;
        if (sourcemapsSourcesProtocol) {
          if (sourceFormatted.startsWith("file:///")) {
            return `${sourcemapsSourcesProtocol}${sourceFormatted.slice(
              "file:///".length,
            )}`;
          }
        }
        return sourceFormatted;
      }),
    };
    sourcemapUrlInfo.type = "sourcemap";
    sourcemapUrlInfo.contentType = "application/json";
    setContentProperties(sourcemapUrlInfo, {
      content: JSON.stringify(sourcemapGenerated, null, "  "),
    });

    if (!urlInfo.sourcemapIsWrong) {
      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier =
          generateSourcemapDataUrl(sourcemapGenerated);
      }
      if (shouldUpdateSourcemapComment(urlInfo, sourcemaps)) {
        let specifier;
        if (sourcemaps === "file" && sourcemapsComment === "relative") {
          specifier = urlToRelativeUrl(
            sourcemapReference.generatedUrl,
            urlInfo.generatedUrl,
          );
        } else {
          specifier = sourcemapReference.generatedSpecifier;
        }
        setContentProperties(urlInfo, {
          content: SOURCEMAP.writeComment({
            contentType: urlInfo.contentType,
            content: urlInfo.content,
            specifier,
          }),
        });
      }
    }
  };

  const endTransformations = (urlInfo, transformations) => {
    if (transformations) {
      applyTransformations(urlInfo, transformations);
    }
    applyContentEffects(urlInfo);
    urlInfo.contentFinalized = true;
  };

  return {
    resetContent,
    setContent,
    applyTransformations,
    applySourcemapOnContent,
    endTransformations,
  };
};

const shouldUpdateSourcemapComment = (urlInfo, sourcemaps) => {
  if (urlInfo.context.buildStep === "shape") {
    return false;
  }
  if (sourcemaps === "file" || sourcemaps === "inline") {
    return true;
  }
  return false;
};

const mayHaveSourcemap = (urlInfo) => {
  if (urlInfo.url.startsWith("data:")) {
    return false;
  }
  if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
    return false;
  }
  return true;
};

const shouldHandleSourcemap = (urlInfo) => {
  const { sourcemaps } = urlInfo.context;
  if (
    sourcemaps !== "inline" &&
    sourcemaps !== "file" &&
    sourcemaps !== "programmatic"
  ) {
    return false;
  }
  return true;
};

const createResolveUrlError = ({
  pluginController,
  reference,
  error,
}) => {
  const createFailedToResolveUrlError = ({
    code = error.code || "RESOLVE_URL_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(
      createDetailedMessage$1(`Failed to resolve url reference`, {
        reason,
        ...details,
        "specifier": `"${reference.specifier}"`,
        "specifier trace": reference.trace.message,
        ...detailsFromPluginController(pluginController),
      }),
    );
    resolveError.name = "RESOLVE_URL_ERROR";
    resolveError.code = code;
    resolveError.reason = reason;
    resolveError.asResponse = error.asResponse;
    return resolveError;
  };
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`,
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    error.message = createDetailedMessage$1(error.message, {
      "reference trace": reference.trace.message,
    });
    return error;
  }
  return createFailedToResolveUrlError({
    reason: `An error occured during specifier resolution`,
    ...detailsFromValueThrown(error),
  });
};

const createFetchUrlContentError = ({
  pluginController,
  urlInfo,
  error,
}) => {
  const createFailedToFetchUrlContentError = ({
    code = error.code || "FETCH_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const fetchError = new Error(
      createDetailedMessage$1(`Failed to fetch url content`, {
        reason,
        ...details,
        "url": urlInfo.url,
        "url reference trace": urlInfo.firstReference.trace.message,
        ...detailsFromPluginController(pluginController),
      }),
    );
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
      fetchError.traceUrl = urlInfo.firstReference.trace.url;
      fetchError.traceLine = urlInfo.firstReference.trace.line;
      fetchError.traceColumn = urlInfo.firstReference.trace.column;
      fetchError.traceMessage = urlInfo.firstReference.trace.message;
    }
    fetchError.asResponse = error.asResponse;
    return fetchError;
  };

  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`,
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return createFailedToFetchUrlContentError({
      code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
      reason: `found a directory on filesystem`,
    });
  }
  if (error.code === "ENOENT") {
    const urlTried = pathToFileURL(error.path).href;
    // ensure ENOENT is caused by trying to read the urlInfo.url
    // any ENOENT trying to read an other file should display the error.stack
    // because it means some side logic has failed
    if (urlInfo.url.startsWith(urlTried)) {
      return createFailedToFetchUrlContentError({
        code: "NOT_FOUND",
        reason: "no entry on filesystem",
      });
    }
  }
  if (error.code === "PARSE_ERROR") {
    return createFailedToFetchUrlContentError({
      "code": "PARSE_ERROR",
      "reason": error.reasonCode,
      ...(error.cause ? { "parse error message": error.cause.message } : {}),
      "parse error trace": error.traceMessage,
    });
  }
  return createFailedToFetchUrlContentError({
    reason: `An error occured during "fetchUrlContent"`,
    ...detailsFromValueThrown(error),
  });
};

const createTransformUrlContentError = ({
  pluginController,
  urlInfo,
  error,
}) => {
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return error;
  }
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const transformError = new Error(
      createDetailedMessage$1(
        `"transformUrlContent" error on "${urlInfo.type}"`,
        {
          reason,
          ...details,
          "url": urlInfo.url,
          "url reference trace": urlInfo.firstReference.trace.message,
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR";
    transformError.code = code;
    transformError.reason = reason;
    transformError.stack = error.stack;
    transformError.url = urlInfo.url;
    transformError.traceUrl = urlInfo.firstReference.trace.url;
    transformError.traceLine = urlInfo.firstReference.trace.line;
    transformError.traceColumn = urlInfo.firstReference.trace.column;
    transformError.traceMessage = urlInfo.firstReference.trace.message;
    if (code === "PARSE_ERROR") {
      transformError.reason = `parse error on ${urlInfo.type}`;
      transformError.cause = error;
      if (urlInfo.isInline) {
        transformError.traceLine =
          urlInfo.firstReference.trace.line + error.line - 1;
        transformError.traceColumn =
          urlInfo.firstReference.trace.column + error.column;
        transformError.traceMessage = stringifyUrlSite({
          url: urlInfo.inlineUrlSite.url,
          line: transformError.traceLine,
          column: transformError.traceColumn,
          content: urlInfo.inlineUrlSite.content,
        });
      } else {
        transformError.traceLine = error.line;
        transformError.traceColumn = error.column;
        transformError.traceMessage = stringifyUrlSite({
          url: urlInfo.url,
          line: error.line - 1,
          column: error.column,
          content: urlInfo.content,
        });
      }
    }
    transformError.asResponse = error.asResponse;
    return transformError;
  };
  return createFailedToTransformError({
    reason: `"transformUrlContent" error on "${urlInfo.type}"`,
    ...detailsFromValueThrown(error),
  });
};

const createFinalizeUrlContentError = ({
  pluginController,

  urlInfo,
  error,
}) => {
  const finalizeError = new Error(
    createDetailedMessage$1(`"finalizeUrlContent" error on "${urlInfo.type}"`, {
      ...detailsFromValueThrown(error),
      "url": urlInfo.url,
      "url reference trace": urlInfo.firstReference.trace.message,
      ...detailsFromPluginController(pluginController),
    }),
  );
  if (error && error instanceof Error) {
    finalizeError.cause = error;
  }
  finalizeError.name = "FINALIZE_URL_CONTENT_ERROR";
  finalizeError.reason = `"finalizeUrlContent" error on "${urlInfo.type}"`;
  finalizeError.asResponse = error.asResponse;
  return finalizeError;
};

const detailsFromPluginController = (pluginController) => {
  const currentPlugin = pluginController.getCurrentPlugin();
  if (!currentPlugin) {
    return null;
  }
  return { "plugin name": `"${currentPlugin.name}"` };
};

const detailsFromValueThrown = (valueThrownByPlugin) => {
  if (valueThrownByPlugin && valueThrownByPlugin instanceof Error) {
    return {
      "error stack": valueThrownByPlugin.stack,
    };
  }
  if (valueThrownByPlugin === undefined) {
    return {
      error: "undefined",
    };
  }
  return {
    error: JSON.stringify(valueThrownByPlugin),
  };
};

const isSupportedAlgorithm = (algo) => {
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
const parseIntegrity = (string) => {
  const integrityMetadata = {};
  string
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const { isValid, algo, base64Value, optionExpression } =
        parseAsHashWithOptions(token);
      if (!isValid) {
        return;
      }
      if (!isSupportedAlgorithm(algo)) {
        return;
      }
      const metadataList = integrityMetadata[algo];
      const metadata = { base64Value, optionExpression };
      integrityMetadata[algo] = metadataList
        ? [...metadataList, metadata]
        : [metadata];
    });
  return integrityMetadata;
};

// see https://w3c.github.io/webappsec-subresource-integrity/#the-integrity-attribute
const parseAsHashWithOptions = (token) => {
  const dashIndex = token.indexOf("-");
  if (dashIndex === -1) {
    return { isValid: false };
  }
  const beforeDash = token.slice(0, dashIndex);
  const afterDash = token.slice(dashIndex + 1);
  const questionIndex = afterDash.indexOf("?");
  const algo = beforeDash;
  if (questionIndex === -1) {
    const base64Value = afterDash;
    const isValid = BASE64_REGEX.test(afterDash);
    return { isValid, algo, base64Value };
  }
  const base64Value = afterDash.slice(0, questionIndex);
  const optionExpression = afterDash.slice(questionIndex + 1);
  const isValid =
    BASE64_REGEX.test(afterDash) && VCHAR_REGEX.test(optionExpression);
  return { isValid, algo, base64Value, optionExpression };
};

const BASE64_REGEX = /^[A-Za-z0-9+\/=+]+$/;
const VCHAR_REGEX = /^[\x21-\x7E]+$/;

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
const validateResponseIntegrity = (
  { url, type, dataRepresentation },
  integrity,
) => {
  if (!isResponseEligibleForIntegrityValidation({ type })) {
    return false;
  }
  const integrityMetadata = parseIntegrity(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return true;
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const metadataList = integrityMetadata[strongestAlgo];
  const actualBase64Value = applyAlgoToRepresentationData(
    strongestAlgo,
    dataRepresentation,
  );
  const acceptedBase64Values = metadataList.map(
    (metadata) => metadata.base64Value,
  );
  const someIsMatching = acceptedBase64Values.includes(actualBase64Value);
  if (someIsMatching) {
    return true;
  }
  const error = new Error(
    `Integrity validation failed for resource "${url}". The integrity found for this resource is "${strongestAlgo}-${actualBase64Value}"`,
  );
  error.code = "EINTEGRITY";
  error.algorithm = strongestAlgo;
  error.found = actualBase64Value;
  throw error;
};

// https://www.w3.org/TR/SRI/#is-response-eligible-for-integrity-validation
const isResponseEligibleForIntegrityValidation = (response) => {
  return ["basic", "cors", "default"].includes(response.type);
};

const assertFetchedContentCompliance = ({ urlInfo, content }) => {
  const { expectedContentType } = urlInfo.firstReference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(
      `Unexpected content-type on url: "${expectedContentType}" was expected but got "${urlInfo.contentType}`,
    );
  }
  const { expectedType } = urlInfo.firstReference;
  if (expectedType && urlInfo.type !== expectedType) {
    throw new Error(
      `Unexpected type on url: "${expectedType}" was expected but got "${urlInfo.type}"`,
    );
  }
  const { integrity } = urlInfo.firstReference;
  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: content,
    });
  }
};

const inlineContentClientFileUrl = new URL(
  "./js/inline_content.js",
  import.meta.url,
).href;

const createKitchen = ({
  name,
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],
  dev = false,
  build = false,
  runtimeCompat,
  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  plugins,
  supervisor,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  outDirectoryUrl,
  initialContext = {},
  initialPluginsMeta = {},
}) => {
  const logger = createLogger({ logLevel });
  const kitchen = {
    context: {
      ...initialContext,
      kitchen: null,
      signal,
      logger,
      rootDirectoryUrl,
      mainFilePath,
      dev,
      build,
      runtimeCompat,
      clientRuntimeCompat,
      inlineContentClientFileUrl,
      isSupportedOnCurrentClients: memoizeIsSupported(clientRuntimeCompat),
      isSupportedOnFutureClients: memoizeIsSupported(runtimeCompat),
      getPluginMeta: null,
      sourcemaps,
      outDirectoryUrl,
    },
    graph: null,
    pluginController: null,
    urlInfoTransformer: null,
  };
  const kitchenContext = kitchen.context;
  kitchenContext.kitchen = kitchen;

  const graph = createUrlGraph({
    name,
    rootDirectoryUrl,
    kitchen,
  });
  kitchen.graph = graph;

  const pluginController = createPluginController(
    kitchenContext,
    initialPluginsMeta,
  );
  kitchen.pluginController = pluginController;
  plugins.forEach((pluginEntry) => {
    pluginController.pushPlugin(pluginEntry);
  });

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    sourcemaps,
    sourcemapsComment,
    sourcemapsSources,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    outDirectoryUrl,
    supervisor,
  });
  kitchen.urlInfoTransformer = urlInfoTransformer;

  const isIgnoredByProtocol = (url) => {
    const { protocol } = new URL(url);
    const protocolIsSupported = supportedProtocols.some(
      (supportedProtocol) => protocol === supportedProtocol,
    );
    return !protocolIsSupported;
  };
  let isIgnoredByParam = () => false;
  if (ignore) {
    const associations = URL_META.resolveAssociations(
      { ignore },
      rootDirectoryUrl,
    );
    const cache = new Map();
    isIgnoredByParam = (url) => {
      const fromCache = cache.get(url);
      if (fromCache) return fromCache;
      const { ignore } = URL_META.applyAssociations({
        url,
        associations,
      });
      cache.set(url, ignore);
      return ignore;
    };
  }
  const isIgnored = (url) => {
    return isIgnoredByProtocol(url) || isIgnoredByParam(url);
  };
  const resolveReference = (reference) => {
    const setReferenceUrl = (referenceUrl) => {
      // ignored urls are prefixed with "ignore:" so that reference are associated
      // to a dedicated urlInfo that is ignored.
      // this way it's only once a resource is referenced by reference that is not ignored
      // that the resource is cooked
      if (
        reference.specifier[0] === "#" &&
        // For Html, css and "#" refer to a resource in the page, reference must be preserved
        // However for js import specifiers they have a different meaning and we want
        // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
        reference.type !== "js_import"
      ) {
        referenceUrl = `ignore:${referenceUrl}`;
      } else if (isIgnored(referenceUrl)) {
        referenceUrl = `ignore:${referenceUrl}`;
      }

      if (
        referenceUrl.startsWith("ignore:") &&
        !reference.specifier.startsWith("ignore:")
      ) {
        reference.specifier = `ignore:${reference.specifier}`;
      }
      Object.defineProperty(reference, "url", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: referenceUrl,
      });
      reference.searchParams = new URL(referenceUrl).searchParams;
    };

    try {
      resolve: {
        if (reference.url) {
          setReferenceUrl(reference.url);
          break resolve;
        }
        const resolvedUrl = pluginController.callHooksUntil(
          "resolveReference",
          reference,
        );
        if (!resolvedUrl) {
          throw new Error(`NO_RESOLVE`);
        }
        if (resolvedUrl.includes("?debug")) {
          reference.debug = true;
        }
        const normalizedUrl = normalizeUrl(resolvedUrl);
        setReferenceUrl(normalizedUrl);
        if (reference.debug) {
          logger.debug(`url resolved by "${
            pluginController.getLastPluginUsed().name
          }"
${ANSI.color(reference.specifier, ANSI.GREY)} ->
${ANSI.color(reference.url, ANSI.YELLOW)}
`);
        }
      }
      redirect: {
        if (reference.isImplicit && reference.isWeak) {
          // not needed for implicit references that are not rendered anywhere
          // this condition excludes:
          // - side_effect_file references injected in entry points or at the top of files
          break redirect;
        }
        pluginController.callHooks(
          "redirectReference",
          reference,
          (returnValue, plugin, setReference) => {
            const normalizedReturnValue = normalizeUrl(returnValue);
            if (normalizedReturnValue === reference.url) {
              return;
            }
            if (reference.debug) {
              logger.debug(
                `url redirected by "${plugin.name}"
${ANSI.color(reference.url, ANSI.GREY)} ->
${ANSI.color(normalizedReturnValue, ANSI.YELLOW)}
`,
              );
            }
            const referenceRedirected = reference.redirect(
              normalizedReturnValue,
            );
            reference = referenceRedirected;
            setReferenceUrl(normalizedReturnValue);
            setReference(referenceRedirected);
          },
        );
      }
      reference.generatedUrl = reference.url;
      reference.generatedSearchParams = reference.searchParams;
      return reference;
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      });
    }
  };
  kitchenContext.resolveReference = resolveReference;

  const finalizeReference = (reference) => {
    if (reference.isImplicit && reference.isWeak) {
      // not needed for implicit references that are not rendered anywhere
      // this condition excludes:
      // - side_effect_file references injected in entry points or at the top of files
      return;
    }

    {
      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hot)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      const searchParamTransformationMap = new Map();
      pluginController.callHooks(
        "transformReferenceSearchParams",
        reference,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            searchParamTransformationMap.set(key, returnValue[key]);
          });
        },
      );
      if (searchParamTransformationMap.size) {
        const generatedSearchParams = new URLSearchParams(
          reference.searchParams,
        );
        searchParamTransformationMap.forEach((value, key) => {
          if (value === undefined) {
            generatedSearchParams.delete(key);
          } else {
            generatedSearchParams.set(key, value);
          }
        });
        const generatedUrlObject = new URL(reference.url);
        const generatedSearch = generatedSearchParams.toString();
        generatedUrlObject.search = generatedSearch;
        reference.generatedUrl = normalizeUrl(generatedUrlObject.href);
        reference.generatedSearchParams = generatedSearchParams;
      }
    }
    {
      const returnValue = pluginController.callHooksUntil(
        "formatReference",
        reference,
      );
      if (reference.url.startsWith("ignore:")) {
        if (ignoreProtocol === "remove") {
          reference.specifier = reference.specifier.slice("ignore:".length);
        }
        reference.generatedSpecifier = reference.specifier;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      } else {
        reference.generatedSpecifier = returnValue || reference.generatedUrl;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      }
    }
  };
  kitchenContext.finalizeReference = finalizeReference;

  const fetchUrlContent = async (urlInfo) => {
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil("fetchUrlContent", urlInfo);
      if (!fetchUrlContentReturnValue) {
        logger.warn(
          createDetailedMessage$1(
            `no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`,
            {
              "url": urlInfo.url,
              "url reference trace": urlInfo.firstReference.trace.message,
            },
          ),
        );
        return;
      }
      let {
        content,
        contentType,
        originalContent = content,
        data,
        type,
        subtype,
        originalUrl,
        sourcemap,

        status = 200,
        headers = {},
        body,
        isEntryPoint,
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
      urlInfo.type =
        type ||
        urlInfo.firstReference.expectedType ||
        inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype ||
        urlInfo.firstReference.expectedSubtype ||
        urlInfo.subtypeHint ||
        "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl || urlInfo.originalUrl;
      if (data) {
        Object.assign(urlInfo.data, data);
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint;
      }
      assertFetchedContentCompliance({
        urlInfo,
        content,
      });
      urlInfo.generatedUrl = determineFileUrlForOutDirectory(urlInfo);

      // we wait here to read .contentAst and .originalContentAst
      // so that we don't trigger lazy getters
      // that would try to parse url too soon (before having urlInfo.type being set)
      // also we do not want to trigger the getters that would parse url content
      // too soon
      const contentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "contentAst",
      );
      const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "originalContentAst",
      );
      await urlInfoTransformer.setContent(urlInfo, content, {
        sourcemap,
        originalContent,
        contentAst: contentAstDescriptor
          ? contentAstDescriptor.get
            ? undefined
            : contentAstDescriptor.value
          : undefined,
        originalContentAst: originalContentAstDescriptor
          ? originalContentAstDescriptor.get
            ? undefined
            : originalContentAstDescriptor.value
          : undefined,
      });
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;

  const transformUrlContent = async (urlInfo) => {
    try {
      await pluginController.callAsyncHooks(
        "transformUrlContent",
        urlInfo,
        (transformReturnValue) => {
          urlInfoTransformer.applyTransformations(
            urlInfo,
            transformReturnValue,
          );
        },
      );
    } catch (error) {
      const transformError = createTransformUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
      urlInfo.error = transformError;
      throw transformError;
    }
  };
  kitchenContext.transformUrlContent = transformUrlContent;

  const finalizeUrlContent = async (urlInfo) => {
    try {
      await urlInfo.applyContentTransformationCallbacks();
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalizeUrlContent",
        urlInfo,
      );
      urlInfoTransformer.endTransformations(urlInfo, finalizeReturnValue);
    } catch (error) {
      throw createFinalizeUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.finalizeUrlContent = finalizeUrlContent;

  const cookGuard = dev ? debounceCook : memoizeCook;
  const cook = cookGuard(async (urlInfo, contextDuringCook) => {
    if (contextDuringCook) {
      Object.assign(urlInfo.context, contextDuringCook);
    }

    // urlInfo objects are reused, they must be "reset" before cooking them again
    if (urlInfo.error || urlInfo.content !== undefined) {
      if (urlInfo.isInline) {
        return;
      }
      urlInfo.error = null;
      urlInfo.type = null;
      urlInfo.subtype = null;
      urlInfo.timing = {};
      urlInfoTransformer.resetContent(urlInfo);
    }

    if (!urlInfo.url.startsWith("ignore:")) {
      try {
        await urlInfo.dependencies.startCollecting(async () => {
          // "fetchUrlContent" hook
          await urlInfo.fetchContent();

          // "transform" hook
          await urlInfo.transformContent();

          // "finalize" hook
          await urlInfo.finalizeContent();
        });
      } catch (e) {
        urlInfo.error = e;
        if (e.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
          throw e;
        }
        if (urlInfo.isInline && errorOnInlineContentCanSkipThrow(urlInfo)) {
          // When something like <style> or <script> contains syntax error
          // the HTML in itself it still valid
          // keep the syntax error and continue with the HTML
          const errorInfo =
            e.code === "PARSE_ERROR"
              ? `${e.cause.reasonCode}\n${e.traceMessage}`
              : e.stack;
          logger.error(
            `Error while handling ${urlInfo.type} declared in ${urlInfo.firstReference.trace.message}:
${errorInfo}`,
          );
        } else {
          throw e;
        }
      }
    }

    // "cooked" hook
    pluginController.callHooks("cooked", urlInfo, (cookedReturnValue) => {
      if (typeof cookedReturnValue === "function") {
        const removeCallback = urlInfo.graph.urlInfoDereferencedEventEmitter.on(
          (urlInfoDereferenced, lastReferenceFromOther) => {
            if (urlInfoDereferenced === urlInfo) {
              removeCallback();
              cookedReturnValue(lastReferenceFromOther.urlInfo);
            }
          },
        );
      }
    });
  });
  kitchenContext.cook = cook;

  const lastTransformationCallbacks = [];
  const addLastTransformationCallback = (callback) => {
    lastTransformationCallbacks.push(callback);
  };
  kitchenContext.addLastTransformationCallback = addLastTransformationCallback;

  const cookDependencies = async (
    urlInfo,
    { operation, ignoreDynamicImport } = {},
  ) => {
    const seen = new Set();

    const cookSelfThenDependencies = async (urlInfo) => {
      if (operation) {
        operation.throwIfAborted();
      }
      if (seen.has(urlInfo)) {
        return;
      }
      seen.add(urlInfo);
      await urlInfo.cook();
      await startCookingDependencies(urlInfo);
    };

    const startCookingDependencies = async (urlInfo) => {
      const dependencyPromises = [];
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          // we don't cook sourcemap reference by sourcemap comments
          // because this is already done in "initTransformations"
          continue;
        }
        if (referenceToOther.isWeak) {
          // we don't cook weak references (resource hints mostly)
          // because they might refer to resource that will be modified during build
          // It also means something else have to reference that url in order to cook it
          // so that the preload is deleted by "resync_resource_hints.js" otherwise
          continue;
        }
        if (referenceToOther.isImplicit) {
          // implicit reference are not auto cooked
          // when needed code is explicitely cooking/fetching the underlying url
          continue;
        }
        if (
          ignoreDynamicImport &&
          referenceToOther.subtype === "import_dynamic"
        ) {
          continue;
        }
        const referencedUrlInfo = referenceToOther.urlInfo;
        const dependencyPromise = cookSelfThenDependencies(referencedUrlInfo);
        dependencyPromises.push(dependencyPromise);
      }
      await Promise.all(dependencyPromises);
    };

    await startCookingDependencies(urlInfo);
    await Promise.all(
      lastTransformationCallbacks.map(async (callback) => {
        await callback();
      }),
    );
    lastTransformationCallbacks.length = 0;
  };
  kitchenContext.cookDependencies = cookDependencies;

  return kitchen;
};

// if we are cooking the inline content internally it's better not to throw
// because the main url info (html) is still valid
// but if we are explicitely requesting inline content during dev
// then we should throw
const errorOnInlineContentCanSkipThrow = (urlInfo) => {
  if (urlInfo.context.build) {
    return true;
  }
  if (
    urlInfo.context.reference &&
    urlInfo.context.reference.url === urlInfo.url
  ) {
    return false;
  }
  return true;
};

const debounceCook = (cook) => {
  const pendingDishes = new Map();
  return async (urlInfo, context) => {
    const { url, modifiedTimestamp } = urlInfo;
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
      promise,
    });
    try {
      await promise;
    } finally {
      pendingDishes.delete(url);
    }
  };
};

const memoizeCook = (cook) => {
  const urlInfoCache = new Map();
  return async (urlInfo, context) => {
    const fromCache = urlInfoCache.get(urlInfo);
    if (fromCache) {
      await fromCache;
      return;
    }
    let resolveCookPromise;
    const promise = new Promise((resolve) => {
      resolveCookPromise = resolve;
    });
    urlInfoCache.set(urlInfo, promise);
    await cook(urlInfo, context);
    resolveCookPromise();
  };
};

const memoizeIsSupported = (runtimeCompat) => {
  const cache = new Map();
  return (feature, featureCompat) => {
    const fromCache = cache.get(feature);
    if (typeof fromCache === "boolean") {
      return fromCache;
    }
    const supported = RUNTIME_COMPAT.isSupported(
      runtimeCompat,
      feature,
      featureCompat,
    );
    cache.set(feature, supported);
    return supported;
  };
};

const inferUrlInfoType = (urlInfo) => {
  const { type, typeHint } = urlInfo;
  if (type === "sourcemap" || typeHint === "sourcemap") {
    return "sourcemap";
  }
  const { contentType } = urlInfo;
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

const determineFileUrlForOutDirectory = (urlInfo) => {
  if (!urlInfo.context.outDirectoryUrl) {
    return urlInfo.url;
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url;
  }
  let url = urlInfo.url;
  if (!urlIsInsideOf(urlInfo.url, urlInfo.context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url);
    url = `${urlInfo.context.rootDirectoryUrl}@fs/${url.slice(
      fsRootUrl.length,
    )}`;
  }
  if (urlInfo.filenameHint) {
    url = setUrlFilename(url, urlInfo.filenameHint);
  }
  return moveUrl({
    url,
    from: urlInfo.context.rootDirectoryUrl,
    to: urlInfo.context.outDirectoryUrl,
  });
};

const createUrlGraphSummary = (
  urlGraph,
  { title = "graph summary" } = {},
) => {
  const graphReport = createUrlGraphReport(urlGraph);
  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
--------------------`;
};

const createUrlGraphReport = (urlGraph) => {
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };

  GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
    urlGraph.rootUrlInfo,
    (urlInfo) => {
      // ignore:
      // - ignored files: we don't know their content
      // - inline files and data files: they are already taken into account in the file where they appear
      if (urlInfo.url.startsWith("ignore:")) {
        return;
      }
      if (urlInfo.isInline) {
        return;
      }
      if (urlInfo.url.startsWith("data:")) {
        return;
      }

      // file loaded via import assertion are already inside the graph
      // their js module equivalent are ignored to avoid counting it twice
      // in the build graph the file targeted by import assertion will likely be gone
      // and only the js module remain (likely bundled)
      if (
        urlInfo.searchParams.has("as_json_module") ||
        urlInfo.searchParams.has("as_css_module") ||
        urlInfo.searchParams.has("as_text_module")
      ) {
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
    },
  );

  const sizesToDistribute = {};
  Object.keys(sizeGroups).forEach((groupName) => {
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
      percentage: undefined,
    },

    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html,
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css,
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js,
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json,
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other,
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100,
    },
  };
};

const determineCategory = (urlInfo) => {
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

const createRepartitionMessage = ({ html, css, js, json, other, total }) => {
  const addPart = (name, { count, size, percentage }) => {
    parts.push(
      `${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${byteAsFileSize(
        size,
      )} / ${percentage} %)`,
    );
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
  const redirectJsReference = (reference) => {
    const urlObject = new URL(reference.url);
    const { searchParams } = urlObject;

    if (searchParams.has("entry_point")) {
      reference.isEntryPoint = true;
    }
    if (searchParams.has("js_classic")) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("js_module")) {
      reference.expectedType = "js_module";
    }
    // we need to keep these checks here because during versioning:
    // - only reference anlysis plugin is executed
    //   -> plugin about js transpilation don't apply and can't set expectedType: 'js_classic'
    // - query params like ?js_module_fallback are still there
    // - without this check build would throw as reference could expect js module and find js classic
    else if (
      searchParams.has("js_module_fallback") ||
      searchParams.has("as_js_classic")
    ) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("as_js_module")) {
      reference.expectedType = "js_module";
    }
    // by default, js referenced by new URL is considered as "js_module"
    // in case this is not desired code must use "?js_classic" like
    // new URL('./file.js?js_classic', import.meta.url)
    else if (
      reference.type === "js_url" &&
      reference.expectedType === undefined &&
      CONTENT_TYPE.fromUrlExtension(reference.url) === "text/javascript"
    ) {
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
    redirectReference: {
      script: redirectJsReference,
      js_url: redirectJsReference,
      js_import: redirectJsReference,
    },
  };
};

const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
    transformUrlContent: {
      directory: async (urlInfo) => {
        const originalDirectoryReference =
          findOriginalDirectoryReference(urlInfo);
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          urlInfo.context.rootDirectoryUrl,
        );
        const entryNames = JSON.parse(urlInfo.content);
        const newEntryNames = [];
        for (const entryName of entryNames) {
          const entryReference = urlInfo.dependencies.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: entryName,
            trace: {
              message: `"${directoryRelativeUrl}${entryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`,
            },
          });
          await entryReference.readGeneratedSpecifier();
          const replacement = entryReference.generatedSpecifier;
          newEntryNames.push(replacement);
        }
        return JSON.stringify(newEntryNames);
      },
    },
  };
};

const findOriginalDirectoryReference = (urlInfo) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (urlInfoReferencingThisOne.type !== "directory") {
        return referenceFromOther;
      }
      const found = findNonFileSystemAncestor(urlInfoReferencingThisOne);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return findNonFileSystemAncestor(urlInfo);
};

const jsenvPluginDataUrlsAnalysis = () => {
  const cookDataUrl = async (reference) => {
    const urlInfo = reference.urlInfo;
    await urlInfo.cook();
    if (urlInfo.originalContent === urlInfo.content) {
      return reference.generatedUrl;
    }
    const specifier = DATA_URL.stringify({
      contentType: urlInfo.contentType,
      base64Flag: urlInfo.data.base64Flag,
      data: urlInfo.data.base64Flag
        ? dataToBase64(urlInfo.content)
        : String(urlInfo.content),
    });
    return specifier;
  };

  return {
    name: "jsenv:data_urls_analysis",
    appliesDuring: "*",
    resolveReference: (reference) => {
      if (!reference.specifier.startsWith("data:")) {
        return null;
      }
      return reference.specifier;
    },
    formatReference: (reference) => {
      if (!reference.generatedUrl.startsWith("data:")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      return cookDataUrl(reference);
    },
    fetchUrlContent: (urlInfo) => {
      if (!urlInfo.url.startsWith("data:")) {
        return null;
      }
      const {
        contentType,
        base64Flag,
        data: urlData,
      } = DATA_URL.parse(urlInfo.url);
      urlInfo.data.base64Flag = base64Flag;
      return {
        content: contentFromUrlData({ contentType, base64Flag, urlData }),
        contentType,
      };
    },
  };
};

const contentFromUrlData = ({ contentType, base64Flag, urlData }) => {
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

const base64ToBuffer = (base64String) => Buffer.from(base64String, "base64");
const base64ToString = (base64String) =>
  Buffer.from(base64String, "base64").toString("utf8");
const dataToBase64 = (data) => Buffer.from(data).toString("base64");

const jsenvPluginHtmlReferenceAnalysis = ({
  inlineContent,
  inlineConvertedScript,
}) => {
  return {
    name: "jsenv:html_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      html: (urlInfo) =>
        parseAndTransformHtmlReferences(urlInfo, {
          inlineContent,
          inlineConvertedScript,
        }),
    },
  };
};

const parseAndTransformHtmlReferences = async (
  urlInfo,
  { inlineContent, inlineConvertedScript },
) => {
  const content = urlInfo.content;
  const htmlAst = parseHtmlString(content);

  const mutations = [];
  const actions = [];
  const finalizeCallbacks = [];

  const createExternalReference = (
    node,
    attributeName,
    attributeValue,
    { type, subtype, expectedType, ...rest },
  ) => {
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
      column,
      // originalLine, originalColumn
    } = position;
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;

    const { crossorigin, integrity } = readFetchMetas(node);
    const isResourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(subtype);
    let attributeLocation = node.sourceCodeLocation.attrs[attributeName];
    if (
      !attributeLocation &&
      attributeName === "href" &&
      (node.tagName === "use" || node.tagName === "image")
    ) {
      attributeLocation = node.sourceCodeLocation.attrs["xlink:href"];
    }
    const attributeStart = attributeLocation.startOffset;
    const attributeValueStart = urlInfo.content.indexOf(
      attributeValue,
      attributeStart + `${attributeName}=`.length,
    );
    const attributeValueEnd = attributeValueStart + attributeValue.length;
    const reference = urlInfo.dependencies.found({
      type,
      subtype,
      expectedType,
      specifier: attributeValue,
      specifierLine: line,
      specifierColumn: column,
      specifierStart: attributeValueStart,
      specifierEnd: attributeValueEnd,
      isResourceHint,
      isWeak: isResourceHint,
      crossorigin,
      integrity,
      debug,
      astInfo: { node, attributeName },
      ...rest,
    });
    actions.push(async () => {
      await reference.readGeneratedSpecifier();
      mutations.push(() => {
        setHtmlNodeAttributes(node, {
          [attributeName]: reference.generatedSpecifier,
        });
      });
    });
    return reference;
  };
  const visitHref = (node, referenceProps) => {
    const href = getHtmlNodeAttribute(node, "href");
    if (href) {
      return createExternalReference(node, "href", href, referenceProps);
    }
    return null;
  };
  const visitSrc = (node, referenceProps) => {
    const src = getHtmlNodeAttribute(node, "src");
    if (src) {
      return createExternalReference(node, "src", src, referenceProps);
    }
    return null;
  };
  const visitSrcset = (node, referenceProps) => {
    const srcset = getHtmlNodeAttribute(node, "srcset");
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset);
      return srcCandidates.map((srcCandidate) => {
        return createExternalReference(
          node,
          "srcset",
          srcCandidate.specifier,
          referenceProps,
        );
      });
    }
    return null;
  };

  const createInlineReference = (
    node,
    inlineContent,
    { type, expectedType, contentType },
  ) => {
    const hotAccept = getHtmlNodeAttribute(node, "hot-accept") !== undefined;
    const { line, column, isOriginal } = getHtmlNodePosition(node, {
      preferOriginal: true,
    });
    const inlineContentUrl = getUrlForContentInsideHtml(node, {
      htmlUrl: urlInfo.url,
    });
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
    const inlineReference = urlInfo.dependencies.foundInline({
      type,
      expectedType,
      isOriginalPosition: isOriginal,
      // we remove 1 to the line because imagine the following html:
      // <style>body { color: red; }</style>
      // -> content starts same line as <style> (same for <script>)
      specifierLine: line - 1,
      specifierColumn: column,
      specifier: inlineContentUrl,
      contentType,
      content: inlineContent,
      debug,
      astInfo: { node },
    });

    actions.push(async () => {
      await inlineReference.urlInfo.cook();
      mutations.push(() => {
        if (hotAccept) {
          removeHtmlNodeText(node);
          setHtmlNodeAttributes(node, {
            "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
          });
        } else {
          setHtmlNodeText(node, inlineReference.urlInfo.content, {
            indentation: false, // indentation would decrease stack trace precision
          });
          setHtmlNodeAttributes(node, {
            "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
          });
        }
      });
    });
    return inlineReference;
  };
  const visitTextContent = (
    node,
    { type, subtype, expectedType, contentType },
  ) => {
    const inlineContent = getHtmlNodeText(node);
    if (!inlineContent) {
      return null;
    }
    return createInlineReference(node, inlineContent, {
      type,
      subtype,
      expectedType,
      contentType,
    });
  };

  visitHtmlNodes(htmlAst, {
    link: (linkNode) => {
      const rel = getHtmlNodeAttribute(linkNode, "rel");
      const type = getHtmlNodeAttribute(linkNode, "type");
      const ref = visitHref(linkNode, {
        type: "link_href",
        subtype: rel,
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
        expectedContentType: type,
      });
      if (ref) {
        finalizeCallbacks.push(() => {
          if (ref.expectedType) ; else {
            ref.expectedType = decideLinkExpectedType(ref, urlInfo);
          }
        });
      }
    },
    style: inlineContent
      ? (styleNode) => {
          visitTextContent(styleNode, {
            type: "style",
            expectedType: "css",
            contentType: "text/css",
          });
        }
      : null,
    script: (scriptNode) => {
      // during build the importmap is inlined
      // and shoud not be considered as a dependency anymore
      if (
        getHtmlNodeAttribute(scriptNode, "jsenv-inlined-by") ===
        "jsenv:importmap"
      ) {
        return;
      }

      const { type, subtype, contentType, extension } =
        analyzeScriptNode(scriptNode);
      // ignore <script type="whatever">foobar</script>
      // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
      if (type !== "text") {
        const externalRef = visitSrc(scriptNode, {
          type: "script",
          subtype: type,
          expectedType: type,
        });
        if (externalRef) {
          return;
        }
      }

      // now visit the content, if any
      if (!inlineContent) {
        return;
      }
      // If the inline script was already handled by an other plugin, ignore it
      // - we want to preserve inline scripts generated by html supervisor during dev
      // - we want to avoid cooking twice a script during build
      if (
        !inlineConvertedScript &&
        getHtmlNodeAttribute(scriptNode, "jsenv-injected-by") ===
          "jsenv:js_module_fallback"
      ) {
        return;
      }

      const inlineRef = visitTextContent(scriptNode, {
        type: "script",
        subtype,
        expectedType: type,
        contentType,
      });
      if (inlineRef) {
        // 1. <script type="jsx"> becomes <script>
        if (type === "js_classic" && extension !== ".js") {
          mutations.push(() => {
            setHtmlNodeAttributes(scriptNode, {
              type: undefined,
            });
          });
        }
        // 2. <script type="module/jsx"> becomes <script type="module">
        if (type === "js_module" && extension !== ".js") {
          mutations.push(() => {
            setHtmlNodeAttributes(scriptNode, {
              type: "module",
            });
          });
        }
      }
    },
    a: (aNode) => {
      visitHref(aNode, {
        type: "a_href",
      });
    },
    iframe: (iframeNode) => {
      visitSrc(iframeNode, {
        type: "iframe_src",
      });
    },
    img: (imgNode) => {
      visitSrc(imgNode, {
        type: "img_src",
      });
      visitSrcset(imgNode, {
        type: "img_srcset",
      });
    },
    source: (sourceNode) => {
      visitSrc(sourceNode, {
        type: "source_src",
      });
      visitSrcset(sourceNode, {
        type: "source_srcset",
      });
    },
    // svg <image> tag
    image: (imageNode) => {
      visitHref(imageNode, {
        type: "image_href",
      });
    },
    use: (useNode) => {
      visitHref(useNode, {
        type: "use_href",
      });
    },
  });
  finalizeCallbacks.forEach((finalizeCallback) => {
    finalizeCallback();
  });

  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  if (mutations.length === 0) {
    return null;
  }
  mutations.forEach((mutation) => mutation());
  return stringifyHtmlAst(htmlAst);
};

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"];
const integrityCompatibleTagNames = ["script", "link", "img", "source"];
const readFetchMetas = (node) => {
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

const decideLinkExpectedType = (linkReference, htmlUrlInfo) => {
  const rel = getHtmlNodeAttribute(linkReference.astInfo.node, "rel");
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
    const as = getHtmlNodeAttribute(linkReference.astInfo.node, "as");
    if (as === "document") {
      return "html";
    }
    if (as === "style") {
      return "css";
    }
    if (as === "script") {
      for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
        if (referenceToOther.url !== linkReference.url) {
          continue;
        }
        if (referenceToOther.type !== "script") {
          continue;
        }
        return referenceToOther.expectedType;
      }
      return undefined;
    }
  }
  return undefined;
};

// const applyWebUrlResolution = (url, baseUrl) => {
//   if (url[0] === "/") {
//     return new URL(url.slice(1), baseUrl).href;
//   }
//   return new URL(url, baseUrl).href;
// };

// css: parseAndTransformCssUrls,

const jsenvPluginWebmanifestReferenceAnalysis = () => {
  return {
    name: "jsenv:webmanifest_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      webmanifest: parseAndTransformWebmanifestUrls,
    },
  };
};

const parseAndTransformWebmanifestUrls = async (urlInfo) => {
  const content = urlInfo.content;
  const manifest = JSON.parse(content);
  const actions = [];
  const { icons = [] } = manifest;
  icons.forEach((icon) => {
    const iconReference = urlInfo.dependencies.found({
      type: "webmanifest_icon_src",
      specifier: icon.src,
    });
    actions.push(async () => {
      await iconReference.readGeneratedSpecifier();
      icon.src = iconReference.generatedSpecifier;
    });
  });

  if (actions.length === 0) {
    return null;
  }
  await Promise.all(actions.map((action) => action()));
  return JSON.stringify(manifest, null, "  ");
};

/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */


const jsenvPluginCssReferenceAnalysis = () => {
  return {
    name: "jsenv:css_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      css: parseAndTransformCssUrls,
    },
  };
};

const parseAndTransformCssUrls = async (urlInfo) => {
  const cssUrls = await parseCssUrls({
    css: urlInfo.content,
    url: urlInfo.originalUrl,
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const cssUrl of cssUrls) {
    const reference = urlInfo.dependencies.found({
      type: cssUrl.type,
      specifier: cssUrl.specifier,
      specifierStart: cssUrl.start,
      specifierEnd: cssUrl.end,
      specifierLine: cssUrl.line,
      specifierColumn: cssUrl.column,
    });
    actions.push(async () => {
      await reference.readGeneratedSpecifier();
      const replacement = reference.generatedSpecifier;
      magicSource.replace({
        start: cssUrl.start,
        end: cssUrl.end,
        replacement,
      });
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  return magicSource.toContentAndSourcemap();
};

const jsenvPluginJsReferenceAnalysis = ({ inlineContent }) => {
  return [
    {
      name: "jsenv:js_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        js_classic: (urlInfo) =>
          parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          }),
        js_module: (urlInfo) =>
          parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          }),
      },
    },
  ];
};

const parseAndTransformJsReferences = async (
  urlInfo,
  { inlineContent, canUseTemplateLiterals },
) => {
  const magicSource = createMagicSource(urlInfo.content);
  const parallelActions = [];
  const sequentialActions = [];
  const isNodeJs =
    Object.keys(urlInfo.context.runtimeCompat).toString() === "node";

  const onInlineReference = (inlineReferenceInfo) => {
    const inlineUrl = getUrlForContentInsideJs(inlineReferenceInfo, {
      url: urlInfo.url,
    });
    let { quote } = inlineReferenceInfo;
    if (quote === "`" && !canUseTemplateLiterals) {
      // if quote is "`" and template literals are not supported
      // we'll use a regular string (single or double quote)
      // when rendering the string
      quote = JS_QUOTES.pickBest(inlineReferenceInfo.content);
    }
    const inlineReference = urlInfo.dependencies.foundInline({
      type: "js_inline_content",
      subtype: inlineReferenceInfo.type, // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
      isOriginalPosition: urlInfo.content === urlInfo.originalContent,
      specifierLine: inlineReferenceInfo.line,
      specifierColumn: inlineReferenceInfo.column,
      specifier: inlineUrl,
      contentType: inlineReferenceInfo.contentType,
      content: inlineReferenceInfo.content,
    });
    const inlineUrlInfo = inlineReference.urlInfo;
    inlineUrlInfo.jsQuote = quote;
    inlineReference.escape = (value) => {
      return JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote });
    };

    sequentialActions.push(async () => {
      await inlineUrlInfo.cook();
      const replacement = JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
        quote,
      });
      magicSource.replace({
        start: inlineReferenceInfo.start,
        end: inlineReferenceInfo.end,
        replacement,
      });
    });
  };
  const onExternalReference = (externalReferenceInfo) => {
    if (
      externalReferenceInfo.subtype === "import_static" ||
      externalReferenceInfo.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true;
    }
    if (
      isNodeJs &&
      externalReferenceInfo.type === "js_url" &&
      externalReferenceInfo.expectedSubtype === "worker" &&
      externalReferenceInfo.expectedType === "js_classic" &&
      // TODO: it's true also if closest package.json
      // is type: module
      urlToExtension$1(
        new URL(externalReferenceInfo.specifier, urlInfo.url).href,
      ) === ".mjs"
    ) {
      externalReferenceInfo.expectedType = "js_module";
    }
    const reference = urlInfo.dependencies.found({
      type: externalReferenceInfo.type,
      subtype: externalReferenceInfo.subtype,
      expectedType: externalReferenceInfo.expectedType,
      expectedSubtype: externalReferenceInfo.expectedSubtype || urlInfo.subtype,
      specifier: externalReferenceInfo.specifier,
      specifierStart: externalReferenceInfo.start,
      specifierEnd: externalReferenceInfo.end,
      specifierLine: externalReferenceInfo.line,
      specifierColumn: externalReferenceInfo.column,
      data: externalReferenceInfo.data,
      baseUrl: {
        "StringLiteral": externalReferenceInfo.baseUrl,
        "window.location": urlInfo.url,
        "window.origin": urlInfo.context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[externalReferenceInfo.baseUrlType],
      importAttributes: externalReferenceInfo.importAttributes,
      astInfo: externalReferenceInfo.astInfo,
    });
    parallelActions.push(async () => {
      await reference.readGeneratedSpecifier();
      const replacement = reference.generatedSpecifier;
      magicSource.replace({
        start: externalReferenceInfo.start,
        end: externalReferenceInfo.end,
        replacement,
      });
      if (reference.mutation) {
        reference.mutation(magicSource, urlInfo);
      }
    });
  };
  const jsReferenceInfos = parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    ast: urlInfo.contentAst,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
    inlineContent,
    isNodeJs,
  });
  for (const jsReferenceInfo of jsReferenceInfos) {
    if (jsReferenceInfo.isInline) {
      onInlineReference(jsReferenceInfo);
    } else {
      onExternalReference(jsReferenceInfo);
    }
  }
  if (parallelActions.length > 0) {
    await Promise.all(parallelActions.map((action) => action()));
  }
  if (sequentialActions.length > 0) {
    await sequentialActions.reduce(async (previous, action) => {
      await previous;
      await action();
    }, Promise.resolve());
  }

  const { content, sourcemap } = magicSource.toContentAndSourcemap();
  return { content, sourcemap };
};

const jsenvPluginReferenceAnalysis = ({
  inlineContent = true,
  inlineConvertedScript = false,
  fetchInlineUrls = true,
}) => {
  return [
    jsenvPluginDirectoryReferenceAnalysis(),
    jsenvPluginHtmlReferenceAnalysis({
      inlineContent,
      inlineConvertedScript,
    }),
    jsenvPluginWebmanifestReferenceAnalysis(),
    jsenvPluginCssReferenceAnalysis(),
    jsenvPluginJsReferenceAnalysis({
      inlineContent,
    }),
    ...(inlineContent ? [jsenvPluginDataUrlsAnalysis()] : []),
    ...(inlineContent && fetchInlineUrls
      ? [jsenvPluginInlineContentFetcher()]
      : []),
    jsenvPluginReferenceExpectedTypes(),
  ];
};

const jsenvPluginInlineContentFetcher = () => {
  return {
    name: "jsenv:inline_content_fetcher",
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo) => {
      if (!urlInfo.isInline) {
        return null;
      }
      // - we must use last reference because
      //   when updating the file, first reference is the previous version
      // - we cannot use urlInfo.lastReference because it can be the reference created by "http_request"
      let lastInlineReference;
      for (const reference of urlInfo.referenceFromOthersSet) {
        if (reference.isInline) {
          lastInlineReference = reference;
        }
      }
      const { prev } = lastInlineReference;
      if (prev && !prev.isInline) {
        // got inlined, cook original url
        if (lastInlineReference.content === undefined) {
          const originalUrlInfo = prev.urlInfo;
          await originalUrlInfo.cook();
          lastInlineReference.content = originalUrlInfo.content;
          lastInlineReference.contentType = originalUrlInfo.contentType;
        }
      }
      return {
        originalContent: urlInfo.originalContent,
        content: lastInlineReference.content,
        contentType: lastInlineReference.contentType,
      };
    },
  };
};

// duplicated from @jsenv/log to avoid the dependency
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

  return string
};

const assertImportMap = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`)
  }

  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`)
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    )
  }
};

const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
};

const urlToScheme = (urlString) => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return ""
  return urlString.slice(0, colonIndex)
};

const urlToPathname = (urlString) => {
  return ressourceToPathname(urlToRessource(urlString))
};

const urlToRessource = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length)
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex)
  }

  return urlString.slice(scheme.length + 1)
};

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1
    ? ressource
    : ressource.slice(0, searchSeparatorIndex)
};

const urlToOrigin = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);

    if (pathnameSlashIndex === -1) return urlString
    return urlString.slice(0, pathnameSlashIndex)
  }

  return urlString.slice(0, scheme.length + 1)
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/"
  }

  return pathname.slice(0, slashLastIndex + 1)
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous


const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({ baseUrl, specifier }))
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({ baseUrl, specifier }))
    }
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({ baseUrl, specifier }))
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`
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

    const resolvedPathname = `${importerFolders.join(
      "/",
    )}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`
};

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier,
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier,
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired = ({
  baseUrl,
  specifier,
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null
};

const resolveSpecifier = (specifier, importer) => {
  if (
    specifier === "." ||
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return resolveUrl(specifier, importer)
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  return null
};

const applyImportMap = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({ specifier, importer }) => {
    return new Error(
      createDetailedMessage(`Unmapped bare specifier.`, {
        specifier,
        importer,
      }),
    )
  },
  onImportMapping = () => {},
}) => {
  assertImportMap(importMap);
  if (typeof specifier !== "string") {
    throw new TypeError(
      createDetailedMessage("specifier must be a string.", {
        specifier,
        importer,
      }),
    )
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(
        createDetailedMessage("importer must be a string.", {
          importer,
          specifier,
        }),
      )
    }
    if (!hasScheme(importer)) {
      throw new Error(
        createDetailedMessage(`importer must be an absolute url.`, {
          importer,
          specifier,
        }),
      )
    }
  }

  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;

  const { scopes } = importMap;
  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(
      (scopeSpecifier) => {
        return (
          scopeSpecifier === importer ||
          specifierIsPrefixOf(scopeSpecifier, importer)
        )
      },
    );
    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings(
        scopeMappings,
        specifierNormalized,
        scopeSpecifierMatching,
        onImportMapping,
      );
      if (mappingFromScopes !== null) {
        return mappingFromScopes
      }
    }
  }

  const { imports } = importMap;
  if (imports) {
    const mappingFromImports = applyMappings(
      imports,
      specifierNormalized,
      undefined,
      onImportMapping,
    );
    if (mappingFromImports !== null) {
      return mappingFromImports
    }
  }

  if (specifierUrl) {
    return specifierUrl
  }

  throw createBareSpecifierError({ specifier, importer })
};

const applyMappings = (
  mappings,
  specifierNormalized,
  scope,
  onImportMapping,
) => {
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
        after: address,
      });
      return address
    }
    if (specifierIsPrefixOf(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(
        specifierCandidate.length,
      );
      const addressFinal = tryUrlResolution(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal,
      });
      return addressFinal
    }
  }

  return null
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return (
    specifierHref[specifierHref.length - 1] === "/" &&
    href.startsWith(specifierHref)
  )
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
    importMap.imports = { ...leftImports };
  } else if (rightHasImports) {
    importMap.imports = { ...rightImports };
  }

  const leftScopes = leftImportMap.scopes;
  const rightScopes = rightImportMap.scopes;
  const leftHasScopes = Boolean(leftScopes);
  const rightHasScopes = Boolean(rightScopes);
  if (leftHasScopes && rightHasScopes) {
    importMap.scopes = composeTwoScopes(
      leftScopes,
      rightScopes,
      importMap.imports || {},
    );
  } else if (leftHasScopes) {
    importMap.scopes = { ...leftScopes };
  } else if (rightHasScopes) {
    importMap.scopes = { ...rightScopes };
  }

  return importMap
};

const composeTwoMappings = (leftMappings, rightMappings) => {
  const mappings = {};

  Object.keys(leftMappings).forEach((leftSpecifier) => {
    if (objectHasKey(rightMappings, leftSpecifier)) {
      // will be overidden
      return
    }
    const leftAddress = leftMappings[leftSpecifier];
    const rightSpecifier = Object.keys(rightMappings).find((rightSpecifier) => {
      return compareAddressAndSpecifier(leftAddress, rightSpecifier)
    });
    mappings[leftSpecifier] = rightSpecifier
      ? rightMappings[rightSpecifier]
      : leftAddress;
  });

  Object.keys(rightMappings).forEach((rightSpecifier) => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier];
  });

  return mappings
};

const objectHasKey = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const compareAddressAndSpecifier = (address, specifier) => {
  const addressUrl = resolveUrl(address, "file:///");
  const specifierUrl = resolveUrl(specifier, "file:///");
  return addressUrl === specifierUrl
};

const composeTwoScopes = (leftScopes, rightScopes, imports) => {
  const scopes = {};

  Object.keys(leftScopes).forEach((leftScopeKey) => {
    if (objectHasKey(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
      return
    }
    const topLevelSpecifier = Object.keys(imports).find(
      (topLevelSpecifierCandidate) => {
        return compareAddressAndSpecifier(
          leftScopeKey,
          topLevelSpecifierCandidate,
        )
      },
    );
    if (topLevelSpecifier) {
      scopes[imports[topLevelSpecifier]] = leftScopes[leftScopeKey];
    } else {
      scopes[leftScopeKey] = leftScopes[leftScopeKey];
    }
  });

  Object.keys(rightScopes).forEach((rightScopeKey) => {
    if (objectHasKey(scopes, rightScopeKey)) {
      scopes[rightScopeKey] = composeTwoMappings(
        scopes[rightScopeKey],
        rightScopes[rightScopeKey],
      );
    } else {
      scopes[rightScopeKey] = {
        ...rightScopes[rightScopeKey],
      };
    }
  });

  return scopes
};

const sortImports = (imports) => {
  const mappingsSorted = {};

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      mappingsSorted[name] = imports[name];
    });

  return mappingsSorted
};

const sortScopes = (scopes) => {
  const scopesSorted = {};

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
    });

  return scopesSorted
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({ baseUrl }))
  }

  const { imports, scopes } = importMap;

  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined,
  }
};

const isStringOrUrl = (value) => {
  if (typeof value === "string") {
    return true
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true
  }

  return false
};

const normalizeMappings = (mappings, baseUrl) => {
  const mappingsNormalized = {};

  Object.keys(mappings).forEach((specifier) => {
    const address = mappings[specifier];

    if (typeof address !== "string") {
      console.warn(
        formulateAddressMustBeAString({
          address,
          specifier,
        }),
      );
      return
    }

    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;

    const addressUrl = tryUrlResolution(address, baseUrl);
    if (addressUrl === null) {
      console.warn(
        formulateAdressResolutionFailed({
          address,
          baseUrl,
          specifier,
        }),
      );
      return
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(
        formulateAddressUrlRequiresTrailingSlash({
          addressUrl,
          address,
          specifier,
        }),
      );
      return
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });

  return sortImports(mappingsNormalized)
};

const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};

  Object.keys(scopes).forEach((scopeSpecifier) => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution(scopeSpecifier, baseUrl);
    if (scopeUrl === null) {
      console.warn(
        formulateScopeResolutionFailed({
          scope: scopeSpecifier,
          baseUrl,
        }),
      );
      return
    }
    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });

  return sortScopes(scopesNormalized)
};

const formulateBaseUrlMustBeStringOrUrl = ({
  baseUrl,
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString = ({
  specifier,
  address,
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier,
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
  specifier,
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateScopeResolutionFailed = ({
  scope,
  baseUrl,
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex)
};

const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {},
}) => {
  let url;
  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping,
    });
  } else {
    url = resolveUrl(specifier, importer);
  }

  if (defaultExtension) {
    url = applyDefaultExtension({ url, importer, defaultExtension });
  }

  return url
};

const applyDefaultExtension = ({ url, importer, defaultExtension }) => {
  if (urlToPathname(url).endsWith("/")) {
    return url
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url);
    if (extension === "") {
      return `${url}${defaultExtension}`
    }
    return url
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`
    }
  }

  return url
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
    importmaps[htmlUrl] = importmap
      ? normalizeImportMap(importmap, htmlUrl)
      : null;
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
    resolveReference: {
      js_import: (reference) => {
        if (!finalImportmap) {
          return null;
        }
        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.ownerUrlInfo.url,
            importMap: finalImportmap,
            onImportMapping: () => {
              fromMapping = true;
            },
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
      },
    },
    transformUrlContent: {
      html: async (htmlUrlInfo) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const importmap = findHtmlNode(htmlAst, (node) => {
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
          const { line, column, isOriginal } = getHtmlNodePosition(importmap, {
            preferOriginal: true,
          });
          const inlineImportmapUrl = getUrlForContentInsideHtml(importmap, {
            htmlUrl: htmlUrlInfo.url,
          });
          const inlineImportmapReference = htmlUrlInfo.dependencies.foundInline(
            {
              type: "script",
              isOriginalPosition: isOriginal,
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineImportmapUrl,
              contentType: "application/importmap+json",
              content: htmlNodeText,
            },
          );
          const inlineImportmapUrlInfo = inlineImportmapReference.urlInfo;
          await inlineImportmapUrlInfo.cook();
          setHtmlNodeText(importmap, inlineImportmapUrlInfo.content, {
            indentation: "auto",
          });
          setHtmlNodeAttributes(importmap, {
            "jsenv-cooked-by": "jsenv:importmap",
          });
          onHtmlImportmapParsed(
            JSON.parse(inlineImportmapUrlInfo.content),
            htmlUrlInfo.url,
          );
        };
        const handleImportmapWithSrc = async (importmap, src) => {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this situation the ref to the importmap was already discovered
          // when parsing the HTML
          let importmapReference = null;
          for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
            if (referenceToOther.generatedSpecifier === src) {
              importmapReference = referenceToOther;
              break;
            }
          }
          const { line, column, isOriginal } = getHtmlNodePosition(importmap, {
            preferOriginal: true,
          });
          const importmapInlineUrl = getUrlForContentInsideHtml(importmap, {
            htmlUrl: htmlUrlInfo.url,
          });
          const importmapReferenceInlined = importmapReference.inline({
            line: line - 1,
            column,
            isOriginal,
            specifier: importmapInlineUrl,
            contentType: "application/importmap+json",
          });
          const importmapInlineUrlInfo = importmapReferenceInlined.urlInfo;
          await importmapInlineUrlInfo.cook();
          onHtmlImportmapParsed(
            JSON.parse(importmapInlineUrlInfo.content),
            htmlUrlInfo.url,
          );
          setHtmlNodeText(importmap, importmapInlineUrlInfo.content, {
            indentation: "auto",
          });
          setHtmlNodeAttributes(importmap, {
            "src": undefined,
            "jsenv-inlined-by": "jsenv:importmap",
            "inlined-from-src": src,
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
        if (htmlUrlInfo.context.build) {
          removeHtmlNode(importmap);
        }
        return {
          content: stringifyHtmlAst(htmlAst),
        };
      },
    },
  };
};

const isSpecifierForNodeBuiltin = (specifier) => {
  return (
    specifier.startsWith("node:") ||
    NODE_BUILTIN_MODULE_SPECIFIERS.includes(specifier)
  );
};

const NODE_BUILTIN_MODULE_SPECIFIERS = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer_ieee754",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "_debugger",
  "dgram",
  "dns",
  "domain",
  "events",
  "freelist",
  "fs",
  "fs/promises",
  "_http_agent",
  "_http_client",
  "_http_common",
  "_http_incoming",
  "_http_outgoing",
  "_http_server",
  "http",
  "http2",
  "https",
  "inspector",
  "_linklist",
  "module",
  "net",
  "node-inspect/lib/_inspect",
  "node-inspect/lib/internal/inspect_client",
  "node-inspect/lib/internal/inspect_repl",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "smalloc",
  "_stream_duplex",
  "_stream_transform",
  "_stream_wrap",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_writable",
  "stream",
  "stream/promises",
  "string_decoder",
  "sys",
  "timers",
  "_tls_common",
  "_tls_legacy",
  "_tls_wrap",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8/tools/arguments",
  "v8/tools/codemap",
  "v8/tools/consarray",
  "v8/tools/csvparser",
  "v8/tools/logreader",
  "v8/tools/profile_view",
  "v8/tools/splaytree",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
  // global is special
  "global",
];

const asDirectoryUrl = (url) => {
  const { pathname } = new URL(url);
  if (pathname.endsWith("/")) {
    return url;
  }
  return new URL("./", url).href;
};

const getParentUrl = (url) => {
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
      const slashBeforeLastIndex = resource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      );
      if (slashBeforeLastIndex === -1) {
        return url;
      }
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
    }

    return `file://${resource.slice(0, slashLastIndex + 1)}`;
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

const urlToFilename = (url) => {
  const { pathname } = new URL(url);
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

const urlToExtension = (url) => {
  const filename = urlToFilename(url);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension;
};

const defaultLookupPackageScope = (url) => {
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

const defaultReadPackageJson = (packageUrl) => {
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch (e) {
    throw new Error(`Invalid package configuration`);
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473

const createInvalidModuleSpecifierError = (
  reason,
  specifier,
  { parentUrl },
) => {
  const error = new Error(
    `Invalid module "${specifier}" ${reason} imported from ${fileURLToPath(
      parentUrl,
    )}`,
  );
  error.code = "INVALID_MODULE_SPECIFIER";
  return error;
};

const createInvalidPackageTargetError = (
  reason,
  target,
  { parentUrl, packageDirectoryUrl, key, isImport },
) => {
  let message;
  if (key === ".") {
    message = `Invalid "exports" main target defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
  } else {
    message = `Invalid "${
      isImport ? "imports" : "exports"
    }" target ${JSON.stringify(target)} defined for "${key}" in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}; ${reason}`;
  }
  const error = new Error(message);
  error.code = "INVALID_PACKAGE_TARGET";
  return error;
};

const createPackagePathNotExportedError = (
  subpath,
  { parentUrl, packageDirectoryUrl },
) => {
  let message;
  if (subpath === ".") {
    message = `No "exports" main defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`;
  } else {
    message = `Package subpath "${subpath}" is not defined by "exports" in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`;
  }
  const error = new Error(message);
  error.code = "PACKAGE_PATH_NOT_EXPORTED";
  return error;
};

const createModuleNotFoundError = (specifier, { parentUrl }) => {
  const error = new Error(
    `Cannot find "${specifier}" imported from ${fileURLToPath(parentUrl)}`,
  );
  error.code = "MODULE_NOT_FOUND";
  return error;
};

const createPackageImportNotDefinedError = (
  specifier,
  { parentUrl, packageDirectoryUrl },
) => {
  const error = new Error(
    `Package import specifier "${specifier}" is not defined in ${fileURLToPath(
      packageDirectoryUrl,
    )}package.json imported from ${fileURLToPath(parentUrl)}`,
  );
  error.code = "PACKAGE_IMPORT_NOT_DEFINED";
  return error;
};

// https://nodejs.org/api/packages.html#resolving-user-conditions
const readCustomConditionsFromProcessArgs = () => {
  const packageConditions = [];
  process.execArgv.forEach((arg) => {
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
  preservesSymlink = false,
}) => {
  const resolution = applyPackageSpecifierResolution(specifier, {
    parentUrl: String(parentUrl),
    conditions,
    lookupPackageScope,
    readPackageJson,
    preservesSymlink,
  });
  const { url } = resolution;
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError(
        `must not include encoded "/" or "\\" characters`,
        specifier,
        {
          parentUrl,
        },
      );
    }
    return resolution;
  }
  return resolution;
};

const applyPackageSpecifierResolution = (specifier, resolutionContext) => {
  const { parentUrl } = resolutionContext;
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution(
        specifier,
        resolutionContext,
      );
      if (browserFieldResolution) {
        return browserFieldResolution;
      }
    }
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
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
        url: specifier,
      };
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    };
  } catch (e) {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution(
      specifier,
      resolutionContext,
    );
    if (browserFieldResolution) {
      return browserFieldResolution;
    }
    const packageResolution = applyPackageResolve(specifier, resolutionContext);
    const search = new URL(specifier, "file:///").search;
    if (search) {
      packageResolution.url = `${packageResolution.url}${search}`;
    }
    return packageResolution;
  }
};

const applyBrowserFieldResolution = (specifier, resolutionContext) => {
  const { parentUrl, conditions, lookupPackageScope, readPackageJson } =
    resolutionContext;
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
  const { browser } = packageJson;
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
      url,
    };
  }
  return null;
};

const applyPackageImportsResolution = (
  internalSpecifier,
  resolutionContext,
) => {
  const { parentUrl, lookupPackageScope, readPackageJson } = resolutionContext;
  if (internalSpecifier === "#" || internalSpecifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError(
      "not a valid internal imports specifier name",
      internalSpecifier,
      resolutionContext,
    );
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl);
  if (packageDirectoryUrl !== null) {
    const packageJson = readPackageJson(packageDirectoryUrl);
    const { imports } = packageJson;
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution(internalSpecifier, {
        ...resolutionContext,
        packageDirectoryUrl,
        packageJson,
        isImport: true,
      });
      if (resolved) {
        return resolved;
      }
    }
  }
  throw createPackageImportNotDefinedError(internalSpecifier, {
    ...resolutionContext,
    packageDirectoryUrl,
  });
};

const applyPackageResolve = (packageSpecifier, resolutionContext) => {
  const { parentUrl, conditions, readPackageJson, preservesSymlink } =
    resolutionContext;
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier");
  }
  if (
    conditions.includes("node") &&
    isSpecifierForNodeBuiltin(packageSpecifier)
  ) {
    return {
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    };
  }
  let { packageName, packageSubpath } = parsePackageSpecifier(packageSpecifier);
  if (
    packageName[0] === "." ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    throw createInvalidModuleSpecifierError(
      `is not a valid package name`,
      packageName,
      resolutionContext,
    );
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
    packageName,
  });
  if (selfResolution) {
    return selfResolution;
  }
  let currentUrl = parentUrl;
  while (currentUrl !== "file:///") {
    const packageDirectoryFacadeUrl = new URL(
      `node_modules/${packageName}/`,
      currentUrl,
    ).href;
    if (!existsSync(new URL(packageDirectoryFacadeUrl))) {
      currentUrl = getParentUrl(currentUrl);
      continue;
    }
    const packageDirectoryUrl = preservesSymlink
      ? packageDirectoryFacadeUrl
      : resolvePackageSymlink(packageDirectoryFacadeUrl);
    const packageJson = readPackageJson(packageDirectoryUrl);
    if (packageJson !== null) {
      const { exports } = packageJson;
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports,
        });
      }
    }
    return applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
  }
  throw createModuleNotFoundError(packageName, resolutionContext);
};

const applyPackageSelfResolution = (packageSubpath, resolutionContext) => {
  const { parentUrl, packageName, lookupPackageScope, readPackageJson } =
    resolutionContext;
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
  const { exports } = packageJson;
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    });
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution;
    }
    return undefined;
  }
  return applyPackageExportsResolution(packageSubpath, {
    ...resolutionContext,
    packageDirectoryUrl,
    packageJson,
  });
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = (packageSubpath, resolutionContext) => {
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution(resolutionContext);
    if (!mainExport) {
      throw createPackagePathNotExportedError(
        packageSubpath,
        resolutionContext,
      );
    }
    const resolved = applyPackageTargetResolution(mainExport, {
      ...resolutionContext,
      key: ".",
    });
    if (resolved) {
      return resolved;
    }
    throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
  }
  const packageExportsInfo = readExports(resolutionContext);
  if (
    packageExportsInfo.type === "object" &&
    packageExportsInfo.allKeysAreRelative
  ) {
    const resolved = applyPackageImportsExportsResolution(packageSubpath, {
      ...resolutionContext,
      isImport: false,
    });
    if (resolved) {
      return resolved;
    }
  }
  throw createPackagePathNotExportedError(packageSubpath, resolutionContext);
};

const applyPackageImportsExportsResolution = (matchKey, resolutionContext) => {
  const { packageJson, isImport } = resolutionContext;
  const matchObject = isImport ? packageJson.imports : packageJson.exports;

  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey];
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      isImport,
    });
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 2)
    .sort(comparePatternKeys);
  for (const expansionKey of expansionKeys) {
    const [patternBase, patternTrailer] = expansionKey.split("*");
    if (matchKey === patternBase) continue;
    if (!matchKey.startsWith(patternBase)) continue;
    if (patternTrailer.length > 0) {
      if (!matchKey.endsWith(patternTrailer)) continue;
      if (matchKey.length < expansionKey.length) continue;
    }
    const target = matchObject[expansionKey];
    const subpath = matchKey.slice(
      patternBase.length,
      matchKey.length - patternTrailer.length,
    );
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      subpath,
      pattern: true,
      isImport,
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
    isImport = false,
  } = resolutionContext;

  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier");
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageDirectoryUrl).href;
      if (!targetUrl.startsWith(packageDirectoryUrl)) {
        throw createInvalidPackageTargetError(
          `target must be inside package`,
          target,
          resolutionContext,
        );
      }
      return {
        type: isImport ? "field:imports" : "field:exports",
        packageDirectoryUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      };
    }
    if (!isImport || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError(
        `target must starst with "./"`,
        target,
        resolutionContext,
      );
    }
    return applyPackageResolve(
      pattern ? target.replaceAll("*", subpath) : `${target}${subpath}`,
      {
        ...resolutionContext,
        parentUrl: packageDirectoryUrl,
      },
    );
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
          isImport,
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
          isImport,
        });
        if (resolved) {
          return resolved;
        }
      }
    }
    return null;
  }
  throw createInvalidPackageTargetError(
    `target must be a string, array, object or null`,
    target,
    resolutionContext,
  );
};

const readExports = ({ packageDirectoryUrl, packageJson }) => {
  const packageExports = packageJson.exports;
  if (Array.isArray(packageExports)) {
    return {
      type: "array",
    };
  }
  if (packageExports === null) {
    return {};
  }
  if (typeof packageExports === "object") {
    const keys = Object.keys(packageExports);
    const relativeKeys = [];
    const conditionalKeys = [];
    keys.forEach((availableKey) => {
      if (availableKey.startsWith(".")) {
        relativeKeys.push(availableKey);
      } else {
        conditionalKeys.push(availableKey);
      }
    });
    const hasRelativeKey = relativeKeys.length > 0;
    if (hasRelativeKey && conditionalKeys.length > 0) {
      throw new Error(
        `Invalid package configuration: cannot mix relative and conditional keys in package.exports
--- unexpected keys ---
${conditionalKeys.map((key) => `"${key}"`).join("\n")}
--- package directory url ---
${packageDirectoryUrl}`,
      );
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length,
    };
  }
  if (typeof packageExports === "string") {
    return { type: "string" };
  }
  return {};
};

const parsePackageSpecifier = (packageSpecifier) => {
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
        isScoped: true,
      };
    }
    const packageName = packageSpecifier.slice(0, secondSlashIndex);
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex + 1);
    const packageSubpath = `./${afterSecondSlash}`;
    return {
      packageName,
      packageSubpath,
      isScoped: true,
    };
  }
  const firstSlashIndex = packageSpecifier.indexOf("/");
  if (firstSlashIndex === -1) {
    return {
      packageName: packageSpecifier,
      packageSubpath: ".",
    };
  }
  const packageName = packageSpecifier.slice(0, firstSlashIndex);
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex + 1);
  const packageSubpath = `./${afterFirstSlash}`;
  return {
    packageName,
    packageSubpath,
  };
};

const applyMainExportResolution = (resolutionContext) => {
  const { packageJson } = resolutionContext;
  const packageExportsInfo = readExports(resolutionContext);
  if (
    packageExportsInfo.type === "array" ||
    packageExportsInfo.type === "string"
  ) {
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
  const { packageDirectoryUrl, packageJson } = resolutionContext;

  if (packageSubpath === ".") {
    return applyLegacyMainResolution(packageSubpath, resolutionContext);
  }
  const browserFieldResolution = applyBrowserFieldResolution(
    packageSubpath,
    resolutionContext,
  );
  if (browserFieldResolution) {
    return browserFieldResolution;
  }
  return {
    type: "subpath",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href,
  };
};

const applyLegacyMainResolution = (packageSubpath, resolutionContext) => {
  const { conditions, packageDirectoryUrl, packageJson } = resolutionContext;
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
        url: new URL(resolved.path, packageDirectoryUrl).href,
      };
    }
  }
  return {
    type: "field:main", // the absence of "main" field
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href,
  };
};
const mainLegacyResolvers = {
  import: ({ packageJson }) => {
    if (typeof packageJson.module === "string") {
      return { type: "field:module", path: packageJson.module };
    }
    if (typeof packageJson.jsnext === "string") {
      return { type: "field:jsnext", path: packageJson.jsnext };
    }
    if (typeof packageJson.main === "string") {
      return { type: "field:main", path: packageJson.main };
    }
    return null;
  },
  browser: ({ packageDirectoryUrl, packageJson }) => {
    const browserMain = (() => {
      if (typeof packageJson.browser === "string") {
        return packageJson.browser;
      }
      if (
        typeof packageJson.browser === "object" &&
        packageJson.browser !== null
      ) {
        return packageJson.browser["."];
      }
      return "";
    })();

    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "field:module",
          path: packageJson.module,
        };
      }
      return null;
    }
    if (
      typeof packageJson.module !== "string" ||
      packageJson.module === browserMain
    ) {
      return {
        type: "field:browser",
        path: browserMain,
      };
    }
    const browserMainUrlObject = new URL(browserMain, packageDirectoryUrl);
    const content = readFileSync(browserMainUrlObject, "utf-8");
    if (
      (/typeof exports\s*==/.test(content) &&
        /typeof module\s*==/.test(content)) ||
      /module\.exports\s*=/.test(content)
    ) {
      return {
        type: "field:module",
        path: packageJson.module,
      };
    }
    return {
      type: "field:browser",
      path: browserMain,
    };
  },
  node: ({ packageJson }) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        path: packageJson.main,
      };
    }
    return null;
  },
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

const resolvePackageSymlink = (packageDirectoryUrl) => {
  const packageDirectoryPath = realpathSync(new URL(packageDirectoryUrl));
  const packageDirectoryResolvedUrl = pathToFileURL(packageDirectoryPath).href;
  return `${packageDirectoryResolvedUrl}/`;
};

const applyFileSystemMagicResolution = (
  fileUrl,
  { fileStat, magicDirectoryIndex, magicExtensions },
) => {
  const result = {
    stat: null,
    url: fileUrl,
    magicExtension: "",
    magicDirectoryIndex: false,
    lastENOENTError: null,
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
        magicExtensions,
      });
      return {
        ...result,
        ...subResult,
        magicDirectoryIndex: true,
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
  magicExtensions.forEach((magicExtension) => {
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
  preservesSymlink,
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [
    ...readCustomConditionsFromProcessArgs(),
    nodeRuntimeEnabled ? "node" : "browser",
    "import",
  ];

  return (reference) => {
    if (reference.type === "package_json") {
      return reference.specifier;
    }
    const { ownerUrlInfo } = reference;
    if (reference.specifier === "/") {
      const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
      return String(new URL(mainFilePath, rootDirectoryUrl));
    }
    if (reference.specifier[0] === "/") {
      return new URL(
        reference.specifier.slice(1),
        ownerUrlInfo.context.rootDirectoryUrl,
      ).href;
    }
    const parentUrl = reference.baseUrl || ownerUrlInfo.url;
    if (!parentUrl.startsWith("file:")) {
      return new URL(reference.specifier, parentUrl).href;
    }
    const { url, type, packageDirectoryUrl } = applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier: reference.specifier,
      preservesSymlink,
    });
    if (ownerUrlInfo.context.dev) {
      const dependsOnPackageJson =
        type !== "relative_specifier" &&
        type !== "absolute_specifier" &&
        type !== "node_builtin_specifier";
      if (dependsOnPackageJson) {
        // this reference depends on package.json and node_modules
        // to be resolved. Each file using this specifier
        // must be invalidated when corresponding package.json changes
        addRelationshipWithPackageJson({
          reference,
          packageJsonUrl: `${packageDirectoryUrl}package.json`,
          field: type.startsWith("field:")
            ? `#${type.slice("field:".length)}`
            : "",
        });
      }
    }
    if (ownerUrlInfo.context.dev) {
      // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules
      if (url.includes("/node_modules/")) {
        const packageDirectoryUrl = defaultLookupPackageScope(url);
        if (
          packageDirectoryUrl &&
          packageDirectoryUrl !== ownerUrlInfo.context.rootDirectoryUrl
        ) {
          const packageVersion =
            defaultReadPackageJson(packageDirectoryUrl).version;
          // package version can be null, see https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
          if (packageVersion) {
            addRelationshipWithPackageJson({
              reference,
              packageJsonUrl: `${packageDirectoryUrl}package.json`,
              field: "version",
              hasVersioningEffect: true,
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
  reference,
  packageJsonUrl,
  field,
  hasVersioningEffect = false,
}) => {
  const { ownerUrlInfo } = reference;
  for (const referenceToOther of ownerUrlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "package_json" &&
      referenceToOther.subtype === field
    ) {
      return;
    }
  }
  const packageJsonReference = reference.addImplicit({
    type: "package_json",
    subtype: field,
    specifier: packageJsonUrl,
    hasVersioningEffect,
    isWeak: true,
  });
  // we don't cook package.json files, we just maintain their content
  // to be able to check if it has changed later on
  if (packageJsonReference.urlInfo.content === undefined) {
    const packageJsonContentAsBuffer = readFileSync(new URL(packageJsonUrl));
    packageJsonReference.urlInfo.type = "json";
    packageJsonReference.urlInfo.kitchen.urlInfoTransformer.setContent(
      packageJsonReference.urlInfo,
      String(packageJsonContentAsBuffer),
    );
  }
};

const jsenvPluginNodeEsmResolution = (resolutionConfig = {}) => {
  let nodeEsmResolverDefault;
  const resolvers = {};
  Object.keys(resolutionConfig).forEach((urlType) => {
    const config = resolutionConfig[urlType];
    if (config === true) {
      resolvers[urlType] = (...args) => nodeEsmResolverDefault(...args);
    } else if (config === false) {
      resolvers[urlType] = () => null;
    } else if (typeof config === "object") {
      const { runtimeCompat, packageConditions, preservesSymlink, ...rest } =
        config;
      const unexpectedKeys = Object.keys(rest);
      if (unexpectedKeys.length) {
        throw new TypeError(
          `${unexpectedKeys.join(
            ",",
          )}: there is no such configuration on "${urlType}"`,
        );
      }
      resolvers[urlType] = createNodeEsmResolver({
        runtimeCompat,
        packageConditions,
        preservesSymlink,
      });
    } else {
      throw new TypeError(
        `config must be true, false or an object, got ${config} on "${urlType}"`,
      );
    }
  });

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    init: ({ runtimeCompat }) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        runtimeCompat,
        preservesSymlink: true,
      });
      if (resolvers.js_module === undefined) {
        resolvers.js_module = nodeEsmResolverDefault;
      }
      if (resolvers.js_classic === undefined) {
        resolvers.js_classic = (reference) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference);
          }
          if (reference.type === "js_import") {
            // happens for ?as_js_module
            return nodeEsmResolverDefault(reference);
          }
          return null;
        };
      }
    },
    resolveReference: (reference) => {
      const urlType = urlTypeFromReference(reference);
      const resolver = resolvers[urlType];
      return resolver ? resolver(reference) : null;
    },
    // when specifier is prefixed by "file:///@ignore/"
    // we return an empty js module
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
          contentType: "text/javascript",
          type: "js_module",
        };
      }
      return null;
    },
  };
};

const urlTypeFromReference = (reference) => {
  if (reference.type === "sourcemap_comment") {
    return "sourcemap";
  }
  if (reference.injected) {
    return reference.expectedType;
  }

  return reference.ownerUrlInfo.type;
};

const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifier === "/") {
        const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
        return String(new URL(mainFilePath, rootDirectoryUrl));
      }
      if (reference.specifier[0] === "/") {
        return new URL(
          reference.specifier.slice(1),
          ownerUrlInfo.context.rootDirectoryUrl,
        ).href;
      }
      return new URL(
        reference.specifier,
        // baseUrl happens second argument to new URL() is different from
        // import.meta.url or document.currentScript.src
        reference.baseUrl || ownerUrlInfo.url,
      ).href;
    },
  };
};

const jsenvPluginVersionSearchParam = () => {
  return {
    name: "jsenv:version_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hot to bypass browser cache
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
    transformReferenceSearchParams: (reference) => {
      if (!reference.version) {
        return null;
      }
      if (reference.searchParams.has("v")) {
        return null;
      }
      return {
        v: reference.version,
      };
    },
  };
};

const jsenvPluginProtocolFile = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
  directoryReferenceAllowed = false,
}) => {
  return [
    {
      name: "jsenv:fs_redirection",
      appliesDuring: "*",
      redirectReference: (reference) => {
        // http, https, data, about, ...
        if (!reference.url.startsWith("file:")) {
          return null;
        }
        if (reference.isInline) {
          return null;
        }
        // ignore root file url
        if (reference.url === "file:///" || reference.url === "file://") {
          reference.leadsToADirectory = true;
          return `ignore:file:///`;
        }
        // ignore "./" on new URL("./")
        if (
          reference.subtype === "new_url_first_arg" &&
          reference.specifier === "./"
        ) {
          return `ignore:${reference.url}`;
        }
        // ignore all new URL second arg
        if (reference.subtype === "new_url_second_arg") {
          return `ignore:${reference.url}`;
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

        const { search, hash } = urlObject;
        let { pathname } = urlObject;
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
        const shouldApplyDilesystemMagicResolution =
          reference.type === "js_import";
        if (shouldApplyDilesystemMagicResolution) {
          const filesystemResolution = applyFileSystemMagicResolution(url, {
            fileStat: stat,
            magicDirectoryIndex,
            magicExtensions: getExtensionsToTry(
              magicExtensions,
              reference.ownerUrlInfo.url,
            ),
          });
          if (filesystemResolution.stat) {
            stat = filesystemResolution.stat;
            url = filesystemResolution.url;
          }
        }
        if (!stat) {
          return null;
        }
        reference.leadsToADirectory = stat && stat.isDirectory();
        if (reference.leadsToADirectory) {
          const directoryAllowed =
            reference.type === "filesystem" ||
            (typeof directoryReferenceAllowed === "function" &&
              directoryReferenceAllowed(reference)) ||
            directoryReferenceAllowed;
          if (!directoryAllowed) {
            const error = new Error("Reference leads to a directory");
            error.code = "DIRECTORY_REFERENCE_NOT_ALLOWED";
            throw error;
          }
        }
        const urlRaw = preserveSymlinks ? url : resolveSymlink(url);
        const resolvedUrl = `${urlRaw}${search}${hash}`;
        return resolvedUrl;
      },
    },
    {
      name: "jsenv:fs_resolution",
      appliesDuring: "*",
      resolveReference: {
        filesystem: (reference) => {
          const ownerUrlInfo = reference.ownerUrlInfo;
          const baseUrl =
            ownerUrlInfo.type === "directory"
              ? ensurePathnameTrailingSlash(ownerUrlInfo.url)
              : ownerUrlInfo.url;
          return new URL(reference.specifier, baseUrl).href;
        },
      },
    },
    {
      name: "jsenv:@fs",
      // during build it's fine to use "file://"" urls
      // but during dev it's a browser running the code
      // so absolute file urls needs to be relativized
      appliesDuring: "dev",
      resolveReference: (reference) => {
        if (reference.specifier.startsWith("/@fs/")) {
          const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length);
          return `file:///${fsRootRelativeUrl}`;
        }
        return null;
      },
      formatReference: (reference) => {
        if (!reference.generatedUrl.startsWith("file:")) {
          return null;
        }
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        if (urlIsInsideOf(reference.generatedUrl, rootDirectoryUrl)) {
          return `/${urlToRelativeUrl(
            reference.generatedUrl,
            rootDirectoryUrl,
          )}`;
        }
        return `/@fs/${reference.generatedUrl.slice("file:///".length)}`;
      },
    },
    {
      name: "jsenv:file_url_fetching",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null;
        }
        const urlObject = new URL(urlInfo.url);
        if (urlInfo.firstReference.leadsToADirectory) {
          const directoryEntries = readdirSync(urlObject);
          if (!urlInfo.filenameHint) {
            if (urlInfo.firstReference.type === "filesystem") {
              urlInfo.filenameHint = `${
                urlInfo.firstReference.ownerUrlInfo.filenameHint
              }${urlToFilename$1(urlInfo.url)}/`;
            } else {
              urlInfo.filenameHint = `${urlToFilename$1(urlInfo.url)}/`;
            }
          }
          return {
            type: "directory",
            contentType: "application/json",
            content: JSON.stringify(directoryEntries, null, "  "),
          };
        }
        if (
          !urlInfo.dirnameHint &&
          urlInfo.firstReference.ownerUrlInfo.type === "directory"
        ) {
          urlInfo.dirnameHint =
            urlInfo.firstReference.ownerUrlInfo.filenameHint;
        }
        const fileBuffer = readFileSync(urlObject);
        const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url);
        const content = CONTENT_TYPE.isTextual(contentType)
          ? String(fileBuffer)
          : fileBuffer;
        return {
          content,
          contentType,
        };
      },
    },
  ];
};

const resolveSymlink = (fileUrl) => {
  const urlObject = new URL(fileUrl);
  const realpath = realpathSync(urlObject);
  const realUrlObject = pathToFileURL(realpath);
  if (urlObject.pathname.endsWith("/")) {
    realUrlObject.pathname += `/`;
  }
  return realUrlObject.href;
};

const jsenvPluginProtocolHttp = () => {
  return {
    name: "jsenv:protocol_http",
    appliesDuring: "*",
    redirectReference: (reference) => {
      // TODO: according to some pattern matching jsenv could be allowed
      // to fetch and transform http urls
      if (
        reference.url.startsWith("http:") ||
        reference.url.startsWith("https:")
      ) {
        return `ignore:${reference.url}`;
      }
      return null;
    },
  };
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
Mark injection as optional using INJECTIONS.optional()

import { INJECTIONS } from "@jsenv/core";

return {
  "${key}": INJECTIONS.optional(${JSON.stringify(value)}),
}`,
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

const jsenvPluginInliningAsDataUrl = () => {
  return {
    name: "jsenv:inlining_as_data_url",
    appliesDuring: "*",
    // if the referenced url is a worker we could use
    // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
    // but maybe we should rather use ?object_url
    // or people could do this:
    // import workerText from './worker.js?text'
    // const blob = new Blob(workerText, { type: 'text/javascript' })
    // window.URL.createObjectURL(blob)
    // in any case the recommended way is to use an url
    // to benefit from shared worker and reuse worker between tabs
    formatReference: (reference) => {
      if (!reference.searchParams.has("inline")) {
        return null;
      }
      if (reference.isInline) {
        // happens when inlining file content into js
        // (for instance import "style.css" with { type: "css" } )
        // In that case the code generated look as follow
        // new InlineContent(/* content of style.css */, { type: "text/css", inlinedFromUrl: "style.css" }).
        // and during code analysis an inline reference is generated
        // with the url "style.css?inline"
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (reference.prev && reference.prev.searchParams.has("inline")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      // <link rel="stylesheet"> and <script> can be inlined in the html
      if (
        reference.type === "link_href" &&
        reference.subtype === "stylesheet"
      ) {
        return null;
      }
      if (
        reference.original &&
        reference.original.type === "link_href" &&
        reference.original.subtype === "stylesheet"
      ) {
        return null;
      }
      if (reference.type === "script") {
        return null;
      }
      const specifierWithBase64Param = injectQueryParamsIntoSpecifier(
        reference.specifier,
        { as_base_64: "" },
      );
      const referenceInlined = reference.inline({
        line: reference.line,
        column: reference.column,
        isOriginal: reference.isOriginal,
        specifier: specifierWithBase64Param,
      });
      const urlInfoInlined = referenceInlined.urlInfo;
      return (async () => {
        await urlInfoInlined.cook();
        const base64Url = DATA_URL.stringify({
          mediaType: urlInfoInlined.contentType,
          base64Flag: true,
          data: urlInfoInlined.content,
        });
        return base64Url;
      })();
    },
    fetchUrlContent: async (urlInfo) => {
      const withoutBase64ParamUrlInfo =
        urlInfo.getWithoutSearchParam("as_base_64");
      if (!withoutBase64ParamUrlInfo) {
        return null;
      }
      await withoutBase64ParamUrlInfo.cook();
      const contentAsBase64 = Buffer.from(
        withoutBase64ParamUrlInfo.content,
      ).toString("base64");
      return {
        originalContent: withoutBase64ParamUrlInfo.originalContent,
        content: contentAsBase64,
        contentType: withoutBase64ParamUrlInfo.contentType,
      };
    },
  };
};

const jsenvPluginInliningIntoHtml = () => {
  return {
    name: "jsenv:inlining_into_html",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        const actions = [];

        const onLinkRelStyleSheet = (linkNode, { href }) => {
          let linkReference = null;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier === href &&
              referenceToOther.type === "link_href" &&
              referenceToOther.subtype === "stylesheet"
            ) {
              linkReference = referenceToOther;
              break;
            }
          }
          if (!linkReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(linkNode, {
            preferOriginal: true,
          });
          const linkInlineUrl = getUrlForContentInsideHtml(linkNode, {
            htmlUrl: urlInfo.url,
            url: linkReference.url,
          });
          const linkReferenceInlined = linkReference.inline({
            line: line - 1,
            column,
            isOriginal,
            specifier: linkInlineUrl,
            type: "style",
            expectedType: linkReference.expectedType,
          });
          const linkUrlInfoInlined = linkReferenceInlined.urlInfo;

          actions.push(async () => {
            await linkUrlInfoInlined.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(linkNode, {
                "inlined-from-href": linkReference.url,
                "href": undefined,
                "rel": undefined,
                "type": undefined,
                "as": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              linkNode.nodeName = "style";
              linkNode.tagName = "style";
              setHtmlNodeText(linkNode, linkUrlInfoInlined.content, {
                indentation: "auto",
              });
            });
          });
        };
        const onScriptWithSrc = (scriptNode, { src }) => {
          let scriptReference;
          for (const dependencyReference of urlInfo.referenceToOthersSet) {
            if (
              dependencyReference.generatedSpecifier === src &&
              dependencyReference.type === "script"
            ) {
              scriptReference = dependencyReference;
              break;
            }
          }
          if (!scriptReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(scriptNode, {
            preferOriginal: true,
          });
          const scriptInlineUrl = getUrlForContentInsideHtml(scriptNode, {
            htmlUrl: urlInfo.url,
            url: scriptReference.url,
          });
          const scriptReferenceInlined = scriptReference.inline({
            line: line - 1,
            column,
            isOriginal,
            specifier: scriptInlineUrl,
            type: scriptReference.type,
            subtype: scriptReference.subtype,
            expectedType: scriptReference.expectedType,
          });
          const scriptUrlInfoInlined = scriptReferenceInlined.urlInfo;
          actions.push(async () => {
            await scriptUrlInfoInlined.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              setHtmlNodeText(scriptNode, scriptUrlInfoInlined.content, {
                indentation: "auto",
              });
            });
          });
        };

        visitHtmlNodes(htmlAst, {
          link: (linkNode) => {
            const rel = getHtmlNodeAttribute(linkNode, "rel");
            if (rel !== "stylesheet") {
              return;
            }
            const href = getHtmlNodeAttribute(linkNode, "href");
            if (!href) {
              return;
            }
            onLinkRelStyleSheet(linkNode, { href });
          },
          script: (scriptNode) => {
            const { type } = analyzeScriptNode(scriptNode);
            const scriptNodeText = getHtmlNodeText(scriptNode);
            if (scriptNodeText) {
              return;
            }
            const src = getHtmlNodeAttribute(scriptNode, "src");
            if (!src) {
              return;
            }
            onScriptWithSrc(scriptNode, { type, src });
          },
        });
        if (actions.length > 0) {
          await Promise.all(actions.map((action) => action()));
        }
        mutations.forEach((mutation) => mutation());
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      },
    },
  };
};

const jsenvPluginInlining = () => {
  return [jsenvPluginInliningAsDataUrl(), jsenvPluginInliningIntoHtml()];
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
  const transformCommonJsGlobals = async (urlInfo) => {
    if (
      !urlInfo.content.includes("process.env.NODE_ENV") &&
      !urlInfo.content.includes("__filename") &&
      !urlInfo.content.includes("__dirname")
    ) {
      return null;
    }
    const isJsModule = urlInfo.type === "js_module";
    const replaceMap = {
      "process.env.NODE_ENV": `("${
        urlInfo.context.dev ? "development" : "production"
      }")`,
      "global": "globalThis",
      "__filename": isJsModule
        ? `import.meta.url.slice('file:///'.length)`
        : `document.currentScript.src`,
      "__dirname": isJsModule
        ? `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
        : `new URL('./', document.currentScript.src).href`,
    };
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [
        [
          babelPluginMetadataExpressionPaths,
          {
            replaceMap,
            allowConflictingReplacements: true,
          },
        ],
      ],
      input: urlInfo.content,
      inputIsJsModule: urlInfo.type === "js_module",
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    const { expressionPaths } = metadata;
    const keys = Object.keys(expressionPaths);
    if (keys.length === 0) {
      return null;
    }
    const magicSource = createMagicSource(urlInfo.content);
    keys.forEach((key) => {
      expressionPaths[key].forEach((path) => {
        magicSource.replace({
          start: path.node.start,
          end: path.node.end,
          replacement: replaceMap[key],
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
      js_module: transformCommonJsGlobals,
    },
  };
};

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c
const babelPluginMetadataExpressionPaths = (
  babel,
  { replaceMap = {}, allowConflictingReplacements = false },
) => {
  const { traverse, parse, types } = babel;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();

  return {
    name: "metadata-replace",

    pre: (state) => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = (value) => {
        const expressionNode = parse(value, state.opts).program.body[0]
          .expression;
        traverse.removeProperties(expressionNode);
        return expressionNode;
      };
      Object.keys(replaceMap).forEach((key) => {
        const keyExpressionNode = parseExpression(key);
        const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
        const value = replaceMap[key];
        const valueExpressionNode = parseExpression(value);
        const equivalentKeyExpressionIndex = candidateArray.findIndex(
          (candidate) =>
            types.isNodesEquivalent(
              candidate.keyExpressionNode,
              keyExpressionNode,
            ),
        );
        if (
          !allowConflictingReplacements &&
          equivalentKeyExpressionIndex > -1
        ) {
          throw new Error(
            `Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`,
          );
        }
        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode,
        };
        if (equivalentKeyExpressionIndex > -1) {
          candidateArray[equivalentKeyExpressionIndex] = newCandidate;
        } else {
          candidateArray.push(newCandidate);
        }
        replacementMap.set(keyExpressionNode.type, candidateArray);
      });
      replacementMap.forEach((candidateArray) => {
        candidateArray.forEach((candidate) => {
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
            const candidateFound = candidateArray.find((candidate) => {
              return types.isNodesEquivalent(
                candidate.keyExpressionNode,
                path.node,
              );
            });
            if (candidateFound) {
              try {
                types.validate(
                  path.parent,
                  path.key,
                  candidateFound.valueExpressionNode,
                );
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
          },
        });
        state.file.metadata.expressionPaths = expressionPaths;
      },
    },
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
      js_module: async (urlInfo) => {
        if (
          !urlInfo.content.includes("import.meta.dev") &&
          !urlInfo.content.includes("import.meta.test") &&
          !urlInfo.content.includes("import.meta.build")
        ) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { dev = [], build = [] } = metadata.importMetaScenarios;
        const replacements = [];
        const replace = (path, value) => {
          replacements.push({ path, value });
        };
        if (urlInfo.context.build) {
          // during build ensure replacement for tree-shaking
          dev.forEach((path) => {
            replace(path, "undefined");
          });
          build.forEach((path) => {
            replace(path, "true");
          });
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          dev.forEach((path) => {
            replace(path, "true");
          });
        }
        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({ path, value }) => {
          magicSource.replace({
            start: path.node.start,
            end: path.node.end,
            replacement: value,
          });
        });
        return magicSource.toContentAndSourcemap();
      },
    },
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
            const { node } = path;
            const { object } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const { property: objectProperty } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const { property } = node;
            const { name } = property;
            const importMetaPaths = importMetas[name];
            if (importMetaPaths) {
              importMetaPaths.push(path);
            } else {
              importMetas[name] = [path];
            }
          },
        });
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          build: importMetas.build,
        };
      },
    },
  };
};

/*
 * Source code can contain the following
 * - __DEV__
 * - __BUILD__
 * That will be replaced with true/false
 */


const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    return replacePlaceholders(
      urlInfo.content,
      {
        __DEV__: INJECTIONS.optional(urlInfo.context.dev),
        __BUILD__: INJECTIONS.optional(urlInfo.context.build),
      },
      urlInfo,
    );
  };

  return {
    name: "jsenv:global_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformIfNeeded,
      js_module: transformIfNeeded,
      html: transformIfNeeded,
    },
  };
};

const jsenvPluginNodeRuntime = ({ runtimeCompat }) => {
  const nodeFound = Object.keys(runtimeCompat).includes("node");
  if (!nodeFound) {
    return [];
  }

  // what do we need to do?
  return {
    name: "jsenv:node_runtime",
    appliesDuring: "*",
  };
};

// Some "smart" default applied to decide what should hot reload / fullreload:
// By default:
//   - hot reload on <img src="./image.png" />
//   - fullreload on <script src="./file.js" />
// Can be controlled by [hot-decline] and [hot-accept]:
//   - fullreload on <img src="./image.png" hot-decline />
//   - hot reload on <script src="./file.js" hot-accept />
const collectHotDataFromHtmlAst = (htmlAst) => {
  const hotReferences = [];

  const onSpecifier = ({ specifier, node, attributeName, hotAccepted }) => {
    if (
      // explicitely enabled with [hot-accept] attribute
      hotAccepted === true ||
      htmlNodeCanHotReload(node)
    ) {
      hotReferences.push({
        type: `${node.nodeName}_${attributeName}`,
        specifier,
      });
    }
  };

  const visitUrlSpecifierAttribute = ({ node, attributeName, hotAccepted }) => {
    const value = getHtmlNodeAttribute(node, attributeName);
    if (value) {
      onSpecifier({
        specifier: value,
        node,
        attributeName,
        hotAccepted,
      });
    }
  };

  const onNode = (node, { hotAccepted }) => {
    // explicitely disabled with [hot-decline] attribute
    if (hotAccepted === false) {
      return;
    }
    if (nodeNamesWithHref.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "href",
        hotAccepted,
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-href",
        hotAccepted,
      });
    }
    if (nodeNamesWithSrc.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "src",
        hotAccepted,
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-src",
        hotAccepted,
      });
    }
    if (nodeNamesWithSrcset.includes(node.nodeName)) {
      const srcset = getHtmlNodeAttribute(node, "srcset");
      if (srcset) {
        const srcCandidates = parseSrcSet(srcset);
        srcCandidates.forEach((srcCandidate) => {
          onSpecifier({
            node,
            specifier: srcCandidate.specifier,
            attributeName: "srcset",
            hotAccepted,
          });
        });
      }
    }
  };

  const iterate = (node, context) => {
    context = {
      ...context,
      ...getNodeContext(node),
    };
    onNode(node, context);
    const { childNodes } = node;
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

const getNodeContext = (node) => {
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

const htmlNodeCanHotReload = (node) => {
  if (node.nodeName === "link") {
    const { isStylesheet, isResourceHint, rel } = analyzeLinkNode(node);
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
    "iframe",
    "img",
    "source",
    "image",
    "use",
  ].includes(node.nodeName);
};

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        Object.assign(
          state.file.metadata,
          collectImportMetaProperties(programPath),
        );
      },
    },
  };
};
const collectImportMetaProperties = (programPath) => {
  const importMetaHotPaths = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptDependencies = [];
  programPath.traverse({
    MemberExpression(path) {
      const { node } = path;
      const { object } = node;
      if (object.type !== "MetaProperty") {
        return;
      }
      const { property: objectProperty } = object;
      if (objectProperty.name !== "meta") {
        return;
      }
      const { property } = node;
      const { name } = property;
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
          hotAcceptDependencies = [
            {
              specifierPath: path.get("arguments")[0],
            },
          ];
          return;
        }
        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0];
          hotAcceptDependencies = firstArg.elements.map((arrayNode, index) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              );
            }
            return {
              specifierPath: firstArgPath.get(String(index)),
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
    },
  });
  return {
    importMetaHotPaths,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  };
};
const isImportMetaHotMethodCall = (path, methodName) => {
  const { property, object } = path.node.callee;
  return (
    property &&
    property.name === methodName &&
    object &&
    object.property &&
    object.property.name === "hot" &&
    object.object.type === "MetaProperty"
  );
};

const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = new URL(
    "./js/import_meta_hot.js",
    import.meta.url,
  ).href;

  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        // during build we don't really care to parse html hot dependencies
        if (htmlUrlInfo.context.build) {
          return;
        }
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const hotReferences = collectHotDataFromHtmlAst(htmlAst);
        htmlUrlInfo.data.hotDecline = false;
        htmlUrlInfo.data.hotAcceptSelf = false;
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(
          ({ type, specifier }) => {
            let existingReference = null;
            for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
              if (
                referenceToOther.type === type &&
                referenceToOther.specifier === specifier
              ) {
                existingReference = referenceToOther;
                break;
              }
            }
            if (existingReference) {
              return existingReference.url;
            }
            const reference = htmlUrlInfo.dependencies.found({
              type,
              specifier,
            });
            return reference.url;
          },
        );
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false;
        cssUrlInfo.data.hotAcceptSelf = false;
        cssUrlInfo.data.hotAcceptDependencies = [];
      },
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata;
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies;
        if (importMetaHotPaths.length === 0) {
          return null;
        }
        if (urlInfo.context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotPaths);
        }
        return injectImportMetaHot(urlInfo, importMetaHotClientFileUrl);
      },
    },
  };
};

const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotPaths.forEach((path) => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined",
    });
  });
  return magicSource.toContentAndSourcemap();
};

// For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel
const injectImportMetaHot = (urlInfo, importMetaHotClientFileUrl) => {
  const importMetaHotClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl,
  });
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(
    `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier};
import.meta.hot = createImportMetaHot(import.meta.url);
`,
  );
  return magicSource.toContentAndSourcemap();
};

/*
 * When client wants to hot reload, it wants to be sure it can reach the server
 * and bypass any cache. This is done thanks to "hot" search param
 * being injected by the client: file.js?hot=Date.now()
 * When it happens server must:
 * 1. Consider it's a regular request to "file.js" and not a variation
 * of it (not like file.js?as_js_classic that creates a separate urlInfo)
 * -> This is done by redirectReference deleting the search param.
 *
 * 2. Inject ?hot= into all urls referenced by this one
 * -> This is done by transformReferenceSearchParams
 */

const jsenvPluginHotSearchParam = () => {
  return {
    name: "jsenv:hot_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.searchParams.has("hot")) {
        return null;
      }
      const urlObject = new URL(reference.url);
      // "hot" search param goal is to invalide url in browser cache:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hot");
      return urlObject.href;
    },
    transformReferenceSearchParams: (reference) => {
      if (reference.isImplicit) {
        return null;
      }
      if (reference.original && reference.original.searchParams.has("hot")) {
        return {
          hot: reference.original.searchParams.get("hot"),
        };
      }
      const request = reference.ownerUrlInfo.context.request;
      const parentHotParam = request ? request.searchParams.get("hot") : null;
      if (!parentHotParam) {
        return null;
      }
      // At this stage the parent is using ?hot and we are going to decide if
      // we propagate the search param to child.
      const referencedUrlInfo = reference.urlInfo;
      const { modifiedTimestamp, dereferencedTimestamp } = referencedUrlInfo;
      if (!modifiedTimestamp && !dereferencedTimestamp) {
        return null;
      }
      // The goal is to send an url that will bypass client (the browser) cache
      // more precisely the runtime cache of js modules, but also any http cache
      // that could prevent re-execution of js code
      // In order to achieve this, this plugin inject ?hot=timestamp
      // - The browser will likely not have it in cache
      //   and refetch latest version from server + re-execute it
      // - If the browser have it in cache, he will not get it from server
      // We use the latest timestamp to ensure it's fresh
      // The dereferencedTimestamp is needed because when a js module is re-referenced
      // browser must re-execute it, even if the code is not modified
      const latestTimestamp =
        dereferencedTimestamp && modifiedTimestamp
          ? Math.max(dereferencedTimestamp, modifiedTimestamp)
          : dereferencedTimestamp || modifiedTimestamp;
      return {
        hot: latestTimestamp,
      };
    },
  };
};

const jsenvPluginAutoreloadClient = () => {
  const autoreloadClientFileUrl = new URL(
    "./js/autoreload.js",
    import.meta.url,
  ).href;

  return {
    name: "jsenv:autoreload_client",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const autoreloadClientReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        });
        injectHtmlNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: autoreloadClientReference.generatedSpecifier,
          }),
          "jsenv:autoreload_client",
        );
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};

const jsenvPluginAutoreloadServer = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: (serverEventInfo) => {
        const formatUrlForClient = (url) => {
          if (urlIsInsideOf(url, serverEventInfo.rootDirectoryUrl)) {
            return urlToRelativeUrl(url, serverEventInfo.rootDirectoryUrl);
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`;
          }
          return url;
        };
        const propagateUpdate = (firstUrlInfo) => {
          const iterate = (urlInfo, seen) => {
            if (urlInfo.data.hotAcceptSelf) {
              return {
                accepted: true,
                reason:
                  urlInfo === firstUrlInfo
                    ? `file accepts hot reload`
                    : `a dependent file accepts hot reload`,
                instructions: [
                  {
                    type: urlInfo.type,
                    boundary: formatUrlForClient(urlInfo.url),
                    acceptedBy: formatUrlForClient(urlInfo.url),
                  },
                ],
              };
            }
            const instructions = [];
            for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
              if (referenceFromOther.isImplicit && referenceFromOther.isWeak) {
                if (!referenceFromOther.original) {
                  continue;
                }
                if (referenceFromOther.original.isWeak) {
                  continue;
                }
              }
              const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
              if (urlInfoReferencingThisOne.data.hotDecline) {
                return {
                  declined: true,
                  reason: `a dependent file declines hot reload`,
                  declinedBy: urlInfoReferencingThisOne.url,
                };
              }
              const { hotAcceptDependencies = [] } =
                urlInfoReferencingThisOne.data;
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                instructions.push({
                  type: urlInfoReferencingThisOne.type,
                  boundary: formatUrlForClient(urlInfoReferencingThisOne.url),
                  acceptedBy: formatUrlForClient(urlInfo.url),
                });
                continue;
              }
              if (seen.includes(urlInfoReferencingThisOne.url)) {
                return {
                  declined: true,
                  reason: "circular dependency",
                  declinedBy: formatUrlForClient(urlInfoReferencingThisOne.url),
                };
              }
              const dependentPropagationResult = iterate(
                urlInfoReferencingThisOne,
                [...seen, urlInfoReferencingThisOne.url],
              );
              if (dependentPropagationResult.accepted) {
                instructions.push(...dependentPropagationResult.instructions);
                continue;
              }
              if (
                // declined explicitely by an other file, it must decline the whole update
                dependentPropagationResult.declinedBy
              ) {
                return dependentPropagationResult;
              }
              // declined by absence of boundary, we can keep searching
            }
            if (instructions.length === 0) {
              return {
                declined: true,
                reason: `there is no file accepting hot reload while propagating update`,
              };
            }
            return {
              accepted: true,
              reason: `${instructions.length} dependent file(s) accepts hot reload`,
              instructions,
            };
          };
          const seen = [];
          return iterate(firstUrlInfo, seen);
        };

        // We are delaying the moment we tell client how to reload because:
        //
        // 1. clientFileDereferencedEventEmitter can emit multiple times in a row
        // It happens when previous references are removed by stopCollecting (in "references.js")
        // In that case we could regroup the calls but we prefer to rely on debouncing to also cover
        // code that would remove many url in a row by other means (like reference.remove())
        //
        // 2. clientFileChangeEventEmitter can emit a lot of times in a short period (git checkout for instance)
        // In that case it's better to cooldown thanks to debouncing
        //
        // And we want to gather all the actions to take in response to these events because
        // we want to favor full-reload when needed and resort to partial reload afterwards
        // it's also important to ensure the client will fetch the server in the same order
        const delayedActionSet = new Set();
        let timeout;
        const delayAction = (action) => {
          delayedActionSet.add(action);
          clearTimeout(timeout);
          timeout = setTimeout(handleDelayedActions);
        };

        const handleDelayedActions = () => {
          const actionSet = new Set(delayedActionSet);
          delayedActionSet.clear();
          let reloadMessage = null;
          for (const action of actionSet) {
            if (action.type === "change") {
              const { changedUrlInfo, event } = action;
              if (!changedUrlInfo.isUsed()) {
                continue;
              }
              const hotUpdate = propagateUpdate(changedUrlInfo);
              const relativeUrl = formatUrlForClient(changedUrlInfo.url);
              if (hotUpdate.declined) {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "full",
                  typeReason: hotUpdate.reason,
                  declinedBy: hotUpdate.declinedBy,
                };
                break;
              }
              const instructions = hotUpdate.instructions;
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(...instructions);
              } else {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "hot",
                  typeReason: hotUpdate.reason,
                  hotInstructions: instructions,
                };
              }
              continue;
            }

            if (action.type === "prune") {
              const { prunedUrlInfo, lastReferenceFromOther } = action;
              if (lastReferenceFromOther.type === "sourcemap_comment") {
                // Can happen when starting dev server with sourcemaps: "file"
                // In that case, as sourcemaps are injected, the reference
                // are lost and sourcemap is considered as pruned
                continue;
              }
              const { ownerUrlInfo } = lastReferenceFromOther;
              if (!ownerUrlInfo.isUsed()) {
                continue;
              }
              const ownerHotUpdate = propagateUpdate(ownerUrlInfo);
              const cause = `${formatUrlForClient(
                prunedUrlInfo.url,
              )} is no longer referenced`;
              // now check if we can hot update the parent resource
              // then if we can hot update all dependencies
              if (ownerHotUpdate.declined) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: ownerHotUpdate.reason,
                  declinedBy: ownerHotUpdate.declinedBy,
                };
                break;
              }
              // parent can hot update
              // but pruned url info declines
              if (prunedUrlInfo.data.hotDecline) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: `a pruned file declines hot reload`,
                  declinedBy: formatUrlForClient(prunedUrlInfo.url),
                };
                break;
              }
              const pruneInstruction = {
                type: "prune",
                boundary: formatUrlForClient(prunedUrlInfo.url),
                acceptedBy: formatUrlForClient(
                  lastReferenceFromOther.ownerUrlInfo.url,
                ),
              };
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(pruneInstruction);
              } else {
                reloadMessage = {
                  cause,
                  type: "hot",
                  typeReason: ownerHotUpdate.reason,
                  hotInstructions: [pruneInstruction],
                };
              }
            }
          }
          if (reloadMessage) {
            serverEventInfo.sendServerEvent(reloadMessage);
          }
        };

        clientFileChangeEventEmitter.on(({ url, event }) => {
          const changedUrlInfo = serverEventInfo.kitchen.graph.getUrlInfo(url);
          if (!changedUrlInfo) {
            return;
          }
          delayAction({
            type: "change",
            changedUrlInfo,
            event,
          });
          // for (const searchParamVariant of changedUrlInfo.searchParamVariantSet) {
          //   delayAction({
          //     type: "change",
          //     changedUrlInfo: searchParamVariant,
          //     event,
          //   });
          // }
        });
        clientFileDereferencedEventEmitter.on(
          (prunedUrlInfo, lastReferenceFromOther) => {
            delayAction({
              type: "prune",
              prunedUrlInfo,
              lastReferenceFromOther,
            });
          },
        );
      },
    },
    serve: (serveInfo) => {
      if (serveInfo.request.pathname === "/__graph__") {
        const graphJson = JSON.stringify(
          serveInfo.kitchen.graph.toJSON(serveInfo.rootDirectoryUrl),
        );
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson),
          },
          body: graphJson,
        };
      }
      return null;
    },
  };
};

const jsenvPluginAutoreload = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return [
    jsenvPluginHotSearchParam(),
    jsenvPluginAutoreloadClient(),
    jsenvPluginAutoreloadServer({
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
    }),
  ];
};

const jsenvPluginCacheControl = ({
  versionedUrls = true,
  maxAge = SECONDS_IN_30_DAYS$1,
}) => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({ reference }) => {
      if (
        versionedUrls &&
        reference.generatedSearchParams.has("v") &&
        !reference.generatedSearchParams.has("hot")
      ) {
        return {
          headers: {
            "cache-control": `private,max-age=${maxAge},immutable`,
          },
        };
      }
      return null;
    },
  };
};

const SECONDS_IN_30_DAYS$1 = 60 * 60 * 24 * 30;

const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
}) => {
  const ribbonClientFileUrl = new URL("./js/ribbon.js", import.meta.url);
  const associations = URL_META.resolveAssociations(
    {
      ribbon: {
        [htmlInclude]: true,
      },
    },
    rootDirectoryUrl,
  );
  return {
    name: "jsenv:ribbon",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const jsenvToolbarHtmlClientFileUrl = urlInfo.context.getPluginMeta(
          "jsenvToolbarHtmlClientFileUrl",
        );
        if (
          jsenvToolbarHtmlClientFileUrl &&
          // startsWith to ignore search params
          urlInfo.url.startsWith(jsenvToolbarHtmlClientFileUrl)
        ) {
          return null;
        }
        const { ribbon } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(urlInfo.url),
          associations,
        });
        if (!ribbon) {
          return null;
        }
        const htmlAst = parseHtmlString(urlInfo.content);
        const ribbonClientFileReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: ribbonClientFileUrl.href,
        });
        const paramsJson = JSON.stringify(
          { text: urlInfo.context.dev ? "DEV" : "BUILD" },
          null,
          "  ",
        );
        injectHtmlNode(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            textContent: `import { injectRibbon } from "${ribbonClientFileReference.generatedSpecifier}"

injectRibbon(${paramsJson});`,
          }),
          "jsenv:ribbon",
        );
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

const jsenvPluginCleanHTML = () => {
  return {
    name: "jsenv:cleanup_html_during_dev",
    appliesDuring: "dev",
    finalizeUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: true,
        });
      },
    },
  };
};

const getCorePlugins = ({
  rootDirectoryUrl,
  runtimeCompat,

  referenceAnalysis = {},
  nodeEsmResolution = {},
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceAllowed,
  supervisor,
  injections,
  transpilation = true,
  inlining = true,

  clientAutoreload,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true,
} = {}) => {
  if (cacheControl === true) {
    cacheControl = {};
  }
  if (supervisor === true) {
    supervisor = {};
  }
  if (ribbon === true) {
    ribbon = {};
  }

  return [
    jsenvPluginReferenceAnalysis(referenceAnalysis),
    ...(injections ? [jsenvPluginInjections(injections)] : []),
    jsenvPluginTranspilation(transpilation),
    jsenvPluginImportmap(),
    ...(inlining ? [jsenvPluginInlining()] : []),
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []), // after inline as it needs inline script to be cooked

    /* When resolving references the following applies by default:
       - http urls are resolved by jsenvPluginHttpUrls
       - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
       - reference inside a js module -> resolved by node esm
       - All the rest uses web standard url resolution
     */
    jsenvPluginProtocolFile({
      directoryReferenceAllowed,
      magicExtensions,
      magicDirectoryIndex,
    }),
    jsenvPluginProtocolHttp(),
    ...(nodeEsmResolution
      ? [jsenvPluginNodeEsmResolution(nodeEsmResolution)]
      : []),
    jsenvPluginWebResolution(),

    jsenvPluginVersionSearchParam(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginImportMetaScenarios(),
    ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []),

    jsenvPluginNodeRuntime({ runtimeCompat }),

    jsenvPluginImportMetaHot(),
    ...(clientAutoreload && clientAutoreload.enabled
      ? [jsenvPluginAutoreload(clientAutoreload)]
      : []),
    ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []),
    ...(ribbon ? [jsenvPluginRibbon({ rootDirectoryUrl, ...ribbon })] : []),
    jsenvPluginCleanHTML(),
  ];
};

const ensureUnixLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n");
    return stringWithLinuxBreaks;
  }
  return ensureUnixLineBreaksOnBuffer(stringOrBuffer);
};

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const ensureUnixLineBreaksOnBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length);
  const int32ArrayWithLineBreaksNormalized = int32Array.filter(
    (element, index, typedArray) => {
      if (element === 0x0d) {
        if (typedArray[index + 1] === 0x0a) {
          // Windows -> Unix
          return false;
        }
        // Mac OS -> Unix
        typedArray[index] = 0x0a;
      }
      return true;
    },
  );
  return Buffer.from(int32ArrayWithLineBreaksNormalized);
};

const jsenvPluginLineBreakNormalization = () => {
  return {
    name: "jsenv:line_break_normalizer",
    appliesDuring: "build",
    transformUrlContent: (urlInfo) => {
      if (CONTENT_TYPE.isTextual(urlInfo.contentType)) {
        return ensureUnixLineBreaks(urlInfo.content);
      }
      return null;
    },
  };
};

const escapeChars = (string, replacements) => {
  const charsToEscape = Object.keys(replacements);
  let result = "";
  let last = 0;
  let i = 0;
  while (i < string.length) {
    const char = string[i];
    i++;
    if (charsToEscape.includes(char) && !isEscaped(i - 1, string)) {
      if (last === i - 1) {
        result += replacements[char];
      } else {
        result += `${string.slice(last, i - 1)}${replacements[char]}`;
      }
      last = i;
    }
  }
  if (last !== string.length) {
    result += string.slice(last);
  }
  return result;
};

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js

const escapeRegexpSpecialChars = (string) => {
  return escapeChars(String(string), {
    "/": "\\/",
    "^": "\\^",
    "\\": "\\\\",
    "[": "\\[",
    "]": "\\]",
    "(": "\\(",
    ")": "\\)",
    "{": "\\{",
    "}": "\\}",
    "?": "\\?",
    "+": "\\+",
    "*": "\\*",
    ".": "\\.",
    "|": "\\|",
    "$": "\\$",
  });
};

const createBuildUrlsGenerator = ({
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  assetsDirectory,
}) => {
  const cache = {};
  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename$1(url);
    }
    if (urlInfo.filenameHint) {
      return urlInfo.filenameHint;
    }
    return urlToFilename$1(url);
  };

  const buildUrlCache = new Map();

  const associateBuildUrl = (url, buildUrl) => {
    buildUrlCache.set(url, buildUrl);
    logger.debug(`associate a build url
${ANSI.color(url, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
      `);
  };

  const generate = (url, { urlInfo, ownerUrlInfo }) => {
    const buildUrlFromCache = buildUrlCache.get(url);
    if (buildUrlFromCache) {
      return buildUrlFromCache;
    }
    if (urlInfo.type === "directory") {
      let directoryPath;
      if (urlInfo.filenameHint) {
        directoryPath = urlInfo.filenameHint;
      } else {
        directoryPath = urlToRelativeUrl(url, sourceDirectoryUrl);
      }
      const { search } = new URL(url);
      const buildUrl = `${buildDirectoryUrl}${directoryPath}${search}`;
      associateBuildUrl(url, buildUrl);
      return buildUrl;
    }

    const directoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo,
      ownerUrlInfo,
    });
    let names = cache[directoryPath];
    if (!names) {
      names = [];
      cache[directoryPath] = names;
    }
    const urlObject = new URL(url);
    let { search, hash } = urlObject;
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
    hash = "";
    const buildUrl = `${buildDirectoryUrl}${directoryPath}${nameCandidate}${search}${hash}`;
    associateBuildUrl(url, buildUrl);
    return buildUrl;
  };

  return {
    generate,
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
  ".tsx": ".js",
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const determineDirectoryPath = ({
  sourceDirectoryUrl,
  assetsDirectory,
  urlInfo,
  ownerUrlInfo,
}) => {
  if (urlInfo.dirnameHint) {
    return urlInfo.dirnameHint;
  }
  if (urlInfo.type === "directory") {
    return "";
  }
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo: ownerUrlInfo || urlInfo.firstReference.ownerUrlInfo,
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


const injectVersionMappingsAsGlobal = async (
  urlInfo,
  versionMappings,
) => {
  if (urlInfo.type === "html") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForVersionMappings(versionMappings, {
      globalName: "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForVersionMappings(versionMappings, {
      globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
};

const generateClientCodeForVersionMappings = (
  versionMappings,
  { globalName, minification },
) => {
  if (minification) {
    return `;(function(){var m = ${JSON.stringify(
      versionMappings,
    )}; ${globalName}.__v__ = function (s) { return m[s] || s }; })();`;
  }
  return `;(function() {
  var __versionMappings__ = {
    ${stringifyParams(versionMappings, "    ")}
  };
  ${globalName}.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();`;
};

const injectVersionMappingsAsImportmap = (urlInfo, versionMappings) => {
  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false,
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  const importmapMinification = Boolean(
    urlInfo.context.getPluginMeta("willMinifyJson"),
  );
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "importmap",
      textContent: importmapMinification
        ? JSON.stringify({ imports: versionMappings })
        : JSON.stringify({ imports: versionMappings }, null, "  "),
    }),
    "jsenv:versioning",
  );
  urlInfo.mutateContent({
    content: stringifyHtmlAst(htmlAst),
  });
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

const createBuildSpecifierManager = ({
  rawKitchen,
  finalKitchen,
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  base,
  assetsDirectory,
  length = 8,

  versioning,
  versioningMethod,
  versionLength,
  canUseImportmap,
}) => {
  const buildUrlsGenerator = createBuildUrlsGenerator({
    logger,
    sourceDirectoryUrl,
    buildDirectoryUrl,
    assetsDirectory,
  });
  const placeholderAPI = createPlaceholderAPI({
    length,
  });
  const placeholderToReferenceMap = new Map();
  const urlInfoToBuildUrlMap = new Map();
  const buildUrlToUrlInfoMap = new Map();
  const buildUrlToBuildSpecifierMap = new Map();

  const generateReplacement = (reference) => {
    let buildUrl;
    if (reference.type === "sourcemap_comment") {
      const parentBuildUrl = urlInfoToBuildUrlMap.get(reference.ownerUrlInfo);
      buildUrl = generateSourcemapFileUrl(parentBuildUrl);
      reference.generatedSpecifier = buildUrl;
    } else {
      const url = reference.generatedUrl;
      let urlInfo;
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(reference.url);
      if (rawUrlInfo) {
        urlInfo = rawUrlInfo;
      } else {
        const buildUrlInfo = reference.urlInfo;
        buildUrlInfo.type = reference.expectedType || "asset";
        buildUrlInfo.subtype = reference.expectedSubtype;
        urlInfo = buildUrlInfo;
      }
      buildUrl = buildUrlsGenerator.generate(url, {
        urlInfo,
        ownerUrlInfo: reference.ownerUrlInfo,
      });
    }

    let buildSpecifier;
    if (base === "./") {
      const parentBuildUrl = reference.ownerUrlInfo.isRoot
        ? buildDirectoryUrl
        : urlInfoToBuildUrlMap.get(reference.ownerUrlInfo);
      const urlRelativeToParent = urlToRelativeUrl(buildUrl, parentBuildUrl);
      if (urlRelativeToParent[0] === ".") {
        buildSpecifier = urlRelativeToParent;
      } else {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        buildSpecifier = `./${urlRelativeToParent}`;
      }
    } else {
      const urlRelativeToBuildDirectory = urlToRelativeUrl(
        buildUrl,
        buildDirectoryUrl,
      );
      buildSpecifier = `${base}${urlRelativeToBuildDirectory}`;
    }

    urlInfoToBuildUrlMap.set(reference.urlInfo, buildUrl);
    buildUrlToUrlInfoMap.set(buildUrl, reference.urlInfo);
    buildUrlToBuildSpecifierMap.set(buildUrl, buildSpecifier);
    const buildGeneratedSpecifier = applyVersioningOnBuildSpecifier(
      buildSpecifier,
      reference,
    );
    return buildGeneratedSpecifier;
  };
  const internalRedirections = new Map();
  const bundleInfoMap = new Map();

  const applyBundling = async ({ bundler, urlInfosToBundle }) => {
    const urlInfosBundled = await rawKitchen.pluginController.callAsyncHook(
      {
        plugin: bundler.plugin,
        hookName: "bundle",
        value: bundler.bundleFunction,
      },
      urlInfosToBundle,
    );
    Object.keys(urlInfosBundled).forEach((url) => {
      const urlInfoBundled = urlInfosBundled[url];
      if (urlInfoBundled.sourceUrls) {
        urlInfoBundled.sourceUrls.forEach((sourceUrl) => {
          const sourceRawUrlInfo = rawKitchen.graph.getUrlInfo(sourceUrl);
          if (sourceRawUrlInfo) {
            sourceRawUrlInfo.data.bundled = true;
          }
        });
      }
      bundleInfoMap.set(url, urlInfoBundled);
    });
  };

  const jsenvPluginMoveToBuildDirectory = {
    name: "jsenv:move_to_build_directory",
    appliesDuring: "build",
    // reference resolution is split in 2
    // the redirection to build directory is done in a second phase (redirectReference)
    // to let opportunity to others plugins (js_module_fallback)
    // to mutate reference (inject ?js_module_fallback)
    // before it gets redirected to build directory
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (ownerUrlInfo.remapReference && !reference.isInline) {
        const newSpecifier = ownerUrlInfo.remapReference(reference);
        reference.specifier = newSpecifier;
      }
      const referenceFromPlaceholder = placeholderToReferenceMap.get(
        reference.specifier,
      );
      if (referenceFromPlaceholder) {
        return referenceFromPlaceholder.url;
      }
      if (reference.type === "filesystem") {
        const ownerRawUrl = ensurePathnameTrailingSlash(ownerUrlInfo.url);
        const url = new URL(reference.specifier, ownerRawUrl).href;
        return url;
      }
      if (reference.specifier[0] === "/") {
        const url = new URL(reference.specifier.slice(1), sourceDirectoryUrl)
          .href;
        return url;
      }
      if (reference.injected) {
        // js_module_fallback
        const url = new URL(
          reference.specifier,
          reference.baseUrl || ownerUrlInfo.url,
        ).href;
        return url;
      }
      const parentUrl = reference.baseUrl || ownerUrlInfo.url;
      const url = new URL(reference.specifier, parentUrl).href;
      return url;
    },
    transformReferenceSearchParams: () => {
      // those search params are reflected into the build file name
      // moreover it create cleaner output
      // otherwise output is full of ?js_module_fallback search param
      return {
        js_module_fallback: undefined,
        as_json_module: undefined,
        as_css_module: undefined,
        as_text_module: undefined,
        as_js_module: undefined,
        as_js_classic: undefined,
        cjs_as_js_module: undefined,
        js_classic: undefined, // TODO: add comment to explain who is using this
        entry_point: undefined,
        dynamic_import: undefined,
      };
    },
    formatReference: (reference) => {
      const generatedUrl = reference.generatedUrl;
      if (!generatedUrl.startsWith("file:")) {
        return null;
      }
      if (reference.isWeak) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      const placeholder = placeholderAPI.generate();
      if (generatedUrl !== reference.url) {
        internalRedirections.set(generatedUrl, reference.url);
      }
      placeholderToReferenceMap.set(placeholder, reference);
      return placeholder;
    },
    fetchUrlContent: async (finalUrlInfo) => {
      let { firstReference } = finalUrlInfo;
      if (
        firstReference.isInline &&
        firstReference.prev &&
        !firstReference.prev.isInline
      ) {
        firstReference = firstReference.prev;
      }
      const rawUrl = firstReference.url;
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
      const bundleInfo = bundleInfoMap.get(rawUrl);
      if (bundleInfo) {
        if (rawUrlInfo && !finalUrlInfo.filenameHint) {
          finalUrlInfo.filenameHint = rawUrlInfo.filenameHint;
        }
        finalUrlInfo.remapReference = bundleInfo.remapReference;
        return {
          // url: bundleInfo.url,
          originalUrl: bundleInfo.originalUrl,
          type: bundleInfo.type,
          content: bundleInfo.content,
          contentType: bundleInfo.contentType,
          sourcemap: bundleInfo.sourcemap,
          data: bundleInfo.data,
        };
      }
      if (rawUrlInfo) {
        if (rawUrlInfo && !finalUrlInfo.filenameHint) {
          finalUrlInfo.filenameHint = rawUrlInfo.filenameHint;
        }
        return rawUrlInfo;
      }
      // reference injected during "shape":
      // - "js_module_fallback" using getWithoutSearchParam to obtain source
      //   url info that will be converted to systemjs/UMD
      // - "js_module_fallback" injecting "s.js"
      if (firstReference.injected) {
        const reference = firstReference.original || firstReference;
        const rawReference = rawKitchen.graph.rootUrlInfo.dependencies.inject({
          type: reference.type,
          expectedType: reference.expectedType,
          specifier: reference.specifier,
          specifierLine: reference.specifierLine,
          specifierColumn: reference.specifierColumn,
          specifierStart: reference.specifierStart,
          specifierEnd: reference.specifierEnd,
          isInline: reference.isInline,
          filenameHint: reference.filenameHint,
          content: reference.content,
          contentType: reference.contentType,
        });
        if (!finalUrlInfo.filenameHint) {
          finalUrlInfo.filenameHint = reference.filenameHint;
        }
        const rawUrlInfo = rawReference.urlInfo;
        await rawUrlInfo.cook();
        return {
          type: rawUrlInfo.type,
          content: rawUrlInfo.content,
          contentType: rawUrlInfo.contentType,
          originalContent: rawUrlInfo.originalContent,
          originalUrl: rawUrlInfo.originalUrl,
          sourcemap: rawUrlInfo.sourcemap,
        };
      }
      if (firstReference.isInline) {
        if (
          firstReference.ownerUrlInfo.url ===
          firstReference.ownerUrlInfo.originalUrl
        ) {
          const rawUrlInfo = GRAPH_VISITOR.find(
            rawKitchen.graph,
            (rawUrlInfoCandidate) => {
              const { inlineUrlSite } = rawUrlInfoCandidate;
              if (!inlineUrlSite) {
                return false;
              }
              if (
                inlineUrlSite.url === firstReference.ownerUrlInfo.url &&
                inlineUrlSite.line === firstReference.specifierLine &&
                inlineUrlSite.column === firstReference.specifierColumn
              ) {
                return true;
              }
              if (rawUrlInfoCandidate.content === firstReference.content) {
                return true;
              }
              if (
                rawUrlInfoCandidate.originalContent === firstReference.content
              ) {
                return true;
              }
              return false;
            },
          );
          if (rawUrlInfo) {
            if (!finalUrlInfo.filenameHint) {
              finalUrlInfo.filenameHint = rawUrlInfo.filenameHint;
            }
            return rawUrlInfo;
          }
        }
        if (!finalUrlInfo.filenameHint) {
          finalUrlInfo.filenameHint = firstReference.filenameHint;
        }
        return {
          originalContent: finalUrlInfo.originalContent,
          content: firstReference.content,
          contentType: firstReference.contentType,
        };
      }
      throw new Error(createDetailedMessage$1(`Cannot fetch ${rawUrl}`));
    },
  };

  const buildSpecifierToBuildSpecifierVersionedMap = new Map();

  const versionMap = new Map();

  const workerReferenceSet = new Set();
  const referenceVersioningInfoMap = new Map();
  const _getReferenceVersioningInfo = (reference) => {
    if (!shouldApplyVersioningOnReference(reference)) {
      return {
        type: "not_versioned",
      };
    }
    const ownerUrlInfo = reference.ownerUrlInfo;
    if (ownerUrlInfo.jsQuote) {
      // here we use placeholder as specifier, so something like
      // "/other/file.png" becomes "!~{0001}~" and finally "__v__("/other/file.png")"
      // this is to support cases like CSS inlined in JS
      // CSS minifier must see valid CSS specifiers like background-image: url("!~{0001}~");
      // that is finally replaced by invalid css background-image: url("__v__("/other/file.png")")
      return {
        type: "global",
        render: (buildSpecifier) => {
          return placeholderAPI.markAsCode(
            `${ownerUrlInfo.jsQuote}+__v__(${JSON.stringify(buildSpecifier)})+${
              ownerUrlInfo.jsQuote
            }`,
          );
        },
      };
    }
    if (reference.type === "js_url") {
      return {
        type: "global",
        render: (buildSpecifier) => {
          return placeholderAPI.markAsCode(
            `__v__(${JSON.stringify(buildSpecifier)})`,
          );
        },
      };
    }
    if (reference.type === "js_import") {
      if (reference.subtype === "import_dynamic") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return placeholderAPI.markAsCode(
              `__v__(${JSON.stringify(buildSpecifier)})`,
            );
          },
        };
      }
      if (reference.subtype === "import_meta_resolve") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return placeholderAPI.markAsCode(
              `__v__(${JSON.stringify(buildSpecifier)})`,
            );
          },
        };
      }
      if (canUseImportmap && !isInsideWorker(reference)) {
        return {
          type: "importmap",
          render: (buildSpecifier) => {
            return buildSpecifier;
          },
        };
      }
    }
    return {
      type: "inline",
      render: (buildSpecifier) => {
        const buildSpecifierVersioned =
          buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
        return buildSpecifierVersioned;
      },
    };
  };
  const getReferenceVersioningInfo = (reference) => {
    const infoFromCache = referenceVersioningInfoMap.get(reference);
    if (infoFromCache) {
      return infoFromCache;
    }
    const info = _getReferenceVersioningInfo(reference);
    referenceVersioningInfoMap.set(reference, info);
    return info;
  };
  const isInsideWorker = (reference) => {
    if (workerReferenceSet.has(reference)) {
      return true;
    }
    const referenceOwnerUrllInfo = reference.ownerUrlInfo;
    let is = false;
    if (isWebWorkerUrlInfo(referenceOwnerUrllInfo)) {
      is = true;
    } else {
      GRAPH_VISITOR.findDependent(
        referenceOwnerUrllInfo,
        (dependentUrlInfo) => {
          if (isWebWorkerUrlInfo(dependentUrlInfo)) {
            is = true;
            return true;
          }
          return false;
        },
      );
    }
    if (is) {
      workerReferenceSet.add(reference);
      return true;
    }
    return false;
  };
  const canUseVersionedUrl = (urlInfo) => {
    if (urlInfo.isRoot) {
      return false;
    }
    if (urlInfo.isEntryPoint) {
      // if (urlInfo.subtype === "worker") {
      //   return true;
      // }
      return false;
    }
    return urlInfo.type !== "webmanifest";
  };
  const shouldApplyVersioningOnReference = (reference) => {
    if (reference.isInline) {
      return false;
    }
    if (reference.next && reference.next.isInline) {
      return false;
    }
    if (reference.type === "sourcemap_comment") {
      return false;
    }
    // specifier comes from "normalize" hook done a bit earlier in this file
    // we want to get back their build url to access their infos
    const referencedUrlInfo = reference.urlInfo;
    if (!canUseVersionedUrl(referencedUrlInfo)) {
      return false;
    }
    return true;
  };

  const prepareVersioning = () => {
    const contentOnlyVersionMap = new Map();
    const urlInfoToContainedPlaceholderSetMap = new Map();
    {
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          // ignore:
          // - inline files and data files:
          //   they are already taken into account in the file where they appear
          // - ignored files:
          //   we don't know their content
          // - unused files without reference
          //   File updated such as style.css -> style.css.js or file.js->file.nomodule.js
          //   Are used at some point just to be discarded later because they need to be converted
          //   There is no need to version them and we could not because the file have been ignored
          //   so their content is unknown
          if (urlInfo.type === "sourcemap") {
            return;
          }
          if (urlInfo.isInline) {
            return;
          }
          if (urlInfo.url.startsWith("data:")) {
            // urlInfo became inline and is not referenced by something else
            return;
          }
          if (urlInfo.url.startsWith("ignore:")) {
            return;
          }
          let content = urlInfo.content;
          if (urlInfo.type === "html") {
            content = stringifyHtmlAst(
              parseHtmlString(urlInfo.content, {
                storeOriginalPositions: false,
              }),
              {
                cleanupJsenvAttributes: true,
                cleanupPositionAttributes: true,
              },
            );
          }
          const containedPlaceholderSet = new Set();
          if (mayUsePlaceholder(urlInfo)) {
            const contentWithPredictibleVersionPlaceholders =
              placeholderAPI.replaceWithDefault(content, (placeholder) => {
                containedPlaceholderSet.add(placeholder);
              });
            content = contentWithPredictibleVersionPlaceholders;
          }
          urlInfoToContainedPlaceholderSetMap.set(
            urlInfo,
            containedPlaceholderSet,
          );
          const contentVersion = generateVersion([content], versionLength);
          contentOnlyVersionMap.set(urlInfo, contentVersion);
        },
      );
    }

    {
      const getSetOfUrlInfoInfluencingVersion = (urlInfo) => {
        const placeholderInfluencingVersionSet = new Set();
        const visitContainedPlaceholders = (urlInfo) => {
          const referencedContentVersion = contentOnlyVersionMap.get(urlInfo);
          if (!referencedContentVersion) {
            // ignored while traversing graph (not used anymore, inline, ...)
            return;
          }
          const containedPlaceholderSet =
            urlInfoToContainedPlaceholderSetMap.get(urlInfo);
          for (const containedPlaceholder of containedPlaceholderSet) {
            if (placeholderInfluencingVersionSet.has(containedPlaceholder)) {
              continue;
            }
            const reference =
              placeholderToReferenceMap.get(containedPlaceholder);
            const referenceVersioningInfo =
              getReferenceVersioningInfo(reference);
            if (
              referenceVersioningInfo.type === "global" ||
              referenceVersioningInfo.type === "importmap"
            ) {
              // when versioning is dynamic no need to take into account
              continue;
            }
            placeholderInfluencingVersionSet.add(containedPlaceholder);
            const referencedUrlInfo = reference.urlInfo;
            visitContainedPlaceholders(referencedUrlInfo);
          }
        };
        visitContainedPlaceholders(urlInfo);

        const setOfUrlInfluencingVersion = new Set();
        for (const placeholderInfluencingVersion of placeholderInfluencingVersionSet) {
          const reference = placeholderToReferenceMap.get(
            placeholderInfluencingVersion,
          );
          const referencedUrlInfo = reference.urlInfo;
          setOfUrlInfluencingVersion.add(referencedUrlInfo);
        }
        return setOfUrlInfluencingVersion;
      };
      for (const [urlInfo, contentOnlyVersion] of contentOnlyVersionMap) {
        const setOfUrlInfoInfluencingVersion =
          getSetOfUrlInfoInfluencingVersion(urlInfo);
        const versionPartSet = new Set();
        versionPartSet.add(contentOnlyVersion);
        for (const urlInfoInfluencingVersion of setOfUrlInfoInfluencingVersion) {
          const otherUrlInfoContentVersion = contentOnlyVersionMap.get(
            urlInfoInfluencingVersion,
          );
          if (!otherUrlInfoContentVersion) {
            throw new Error(
              `cannot find content version for ${urlInfoInfluencingVersion.url} (used by ${urlInfo.url})`,
            );
          }
          versionPartSet.add(otherUrlInfoContentVersion);
        }
        const version = generateVersion(versionPartSet, versionLength);
        versionMap.set(urlInfo, version);
      }
    }
  };

  const applyVersioningOnBuildSpecifier = (buildSpecifier, reference) => {
    if (!versioning) {
      return buildSpecifier;
    }
    const referenceVersioningInfo = getReferenceVersioningInfo(reference);
    if (referenceVersioningInfo.type === "not_versioned") {
      return buildSpecifier;
    }
    const version = versionMap.get(reference.urlInfo);
    const buildSpecifierVersioned = injectVersionIntoBuildSpecifier({
      buildSpecifier,
      versioningMethod,
      version,
    });
    buildSpecifierToBuildSpecifierVersionedMap.set(
      buildSpecifier,
      buildSpecifierVersioned,
    );
    return referenceVersioningInfo.render(buildSpecifier);
  };
  const finishVersioning = async () => {
    {
      const actions = [];
      const visitors = [];
      const globalMappings = {};
      const importmapMappings = {};
      for (const [reference, versioningInfo] of referenceVersioningInfoMap) {
        if (versioningInfo.type === "global") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
          globalMappings[buildSpecifier] = buildSpecifierVersioned;
        }
        if (versioningInfo.type === "importmap") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
          importmapMappings[buildSpecifier] = buildSpecifierVersioned;
        }
      }
      if (Object.keys(globalMappings).length > 0) {
        visitors.push((urlInfo) => {
          if (urlInfo.isEntryPoint) {
            actions.push(async () => {
              await injectVersionMappingsAsGlobal(urlInfo, globalMappings);
            });
          }
        });
      }
      if (Object.keys(importmapMappings).length > 0) {
        visitors.push((urlInfo) => {
          if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
            actions.push(async () => {
              await injectVersionMappingsAsImportmap(
                urlInfo,
                importmapMappings,
              );
            });
          }
        });
      }
      if (visitors.length) {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (urlInfo.isRoot) return;
          visitors.forEach((visitor) => visitor(urlInfo));
        });
        if (actions.length) {
          await Promise.all(actions.map((action) => action()));
        }
      }
    }
  };

  const getBuildGeneratedSpecifier = (urlInfo) => {
    const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
    const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
    const buildGeneratedSpecifier =
      buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier) ||
      buildSpecifier;
    return buildGeneratedSpecifier;
  };

  return {
    jsenvPluginMoveToBuildDirectory,
    applyBundling,

    remapPlaceholder: (specifier) => {
      const reference = placeholderToReferenceMap.get(specifier);
      if (reference) {
        return reference.specifier;
      }
      return specifier;
    },

    replacePlaceholders: async () => {
      if (versioning) {
        prepareVersioning();
      }

      const urlInfoSet = new Set();
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          urlInfoSet.add(urlInfo);
          if (urlInfo.isEntryPoint) {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.isInline) {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.type === "sourcemap") {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.firstReference.type === "side_effect_file") {
            generateReplacement(urlInfo.firstReference);
          }
          // side effect stuff must be generated too
          if (mayUsePlaceholder(urlInfo)) {
            const contentBeforeReplace = urlInfo.content;
            const { content, sourcemap } = placeholderAPI.replaceAll(
              contentBeforeReplace,
              (placeholder) => {
                const reference = placeholderToReferenceMap.get(placeholder);
                return generateReplacement(reference);
              },
            );
            urlInfo.mutateContent({ content, sourcemap });
          }
        },
      );

      workerReferenceSet.clear();
      if (versioning) {
        await finishVersioning();
      }

      for (const urlInfo of urlInfoSet) {
        urlInfo.kitchen.urlInfoTransformer.applySourcemapOnContent(
          urlInfo,
          (source) => {
            const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
            if (buildUrl) {
              return urlToRelativeUrl(source, buildUrl);
            }
            return source;
          },
        );
      }
      urlInfoSet.clear();
    },

    prepareResyncResourceHints: () => {
      const actions = [];
      GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
        if (urlInfo.type !== "html") {
          return;
        }
        const htmlAst = parseHtmlString(urlInfo.content, {
          storeOriginalPositions: false,
        });
        const mutations = [];
        const hintToInjectMap = new Map();
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const href = getHtmlNodeAttribute(node, "href");
            if (href === undefined || href.startsWith("data:")) {
              return;
            }
            const rel = getHtmlNodeAttribute(node, "rel");
            const isResourceHint = [
              "preconnect",
              "dns-prefetch",
              "prefetch",
              "preload",
              "modulepreload",
            ].includes(rel);
            if (!isResourceHint) {
              return;
            }
            const rawUrl = href;
            const finalUrl = internalRedirections.get(rawUrl) || rawUrl;
            const urlInfo = finalKitchen.graph.getUrlInfo(finalUrl);
            if (!urlInfo) {
              logger.warn(
                `${UNICODE.WARNING} remove resource hint because cannot find "${href}" in the graph`,
              );
              mutations.push(() => {
                removeHtmlNode(node);
              });
              return;
            }
            if (!urlInfo.isUsed()) {
              const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
              if (rawUrlInfo && rawUrlInfo.data.bundled) {
                logger.warn(
                  `${UNICODE.WARNING} remove resource hint on "${href}" because it was bundled`,
                );
                mutations.push(() => {
                  removeHtmlNode(node);
                });
                return;
              }
              logger.warn(
                `${UNICODE.WARNING} remove resource hint on "${href}" because it is not used anymore`,
              );
              mutations.push(() => {
                removeHtmlNode(node);
              });
              return;
            }
            const buildGeneratedSpecifier = getBuildGeneratedSpecifier(urlInfo);
            mutations.push(() => {
              setHtmlNodeAttributes(node, {
                href: buildGeneratedSpecifier,
                ...(urlInfo.type === "js_classic"
                  ? { crossorigin: undefined }
                  : {}),
              });
            });
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (referenceToOther.isWeak) {
                continue;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              if (referencedUrlInfo.data.generatedToShareCode) {
                hintToInjectMap.set(referencedUrlInfo, { node });
              }
            }
          },
        });
        hintToInjectMap.forEach(({ node }, urlInfo) => {
          const buildGeneratedSpecifier = getBuildGeneratedSpecifier(urlInfo);
          const found = findHtmlNode(htmlAst, (htmlNode) => {
            return (
              htmlNode.nodeName === "link" &&
              getHtmlNodeAttribute(htmlNode, "href") === buildGeneratedSpecifier
            );
          });
          if (!found) {
            mutations.push(() => {
              const nodeToInsert = createHtmlNode({
                tagName: "link",
                rel: getHtmlNodeAttribute(node, "rel"),
                href: buildGeneratedSpecifier,
                as: getHtmlNodeAttribute(node, "as"),
                type: getHtmlNodeAttribute(node, "type"),
                crossorigin: getHtmlNodeAttribute(node, "crossorigin"),
              });
              insertHtmlNodeAfter(nodeToInsert, node);
            });
          }
        });
        if (mutations.length > 0) {
          actions.push(() => {
            mutations.forEach((mutation) => mutation());
            urlInfo.mutateContent({
              content: stringifyHtmlAst(htmlAst),
            });
          });
        }
      });
      if (actions.length === 0) {
        return null;
      }
      return () => {
        actions.map((resourceHintAction) => resourceHintAction());
      };
    },

    prepareServiceWorkerUrlInjection: () => {
      const serviceWorkerEntryUrlInfos = GRAPH_VISITOR.filter(
        finalKitchen.graph,
        (finalUrlInfo) => {
          return (
            finalUrlInfo.subtype === "service_worker" &&
            finalUrlInfo.isEntryPoint &&
            finalUrlInfo.isUsed()
          );
        },
      );
      if (serviceWorkerEntryUrlInfos.length === 0) {
        return null;
      }
      return async () => {
        const allResourcesFromJsenvBuild = {};
        GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
          finalKitchen.graph.rootUrlInfo,
          (urlInfo) => {
            if (!urlInfo.url.startsWith("file:")) {
              return;
            }
            if (urlInfo.isInline) {
              return;
            }

            const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
            const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
            if (canUseVersionedUrl(urlInfo)) {
              const buildSpecifierVersioned = versioning
                ? buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier)
                : null;
              allResourcesFromJsenvBuild[buildSpecifier] = {
                version: versionMap.get(urlInfo),
                versionedUrl: buildSpecifierVersioned,
              };
            } else {
              // when url is not versioned we compute a "version" for that url anyway
              // so that service worker source still changes and navigator
              // detect there is a change
              allResourcesFromJsenvBuild[buildSpecifier] = {
                version: versionMap.get(urlInfo),
              };
            }
          },
        );
        for (const serviceWorkerEntryUrlInfo of serviceWorkerEntryUrlInfos) {
          const resourcesFromJsenvBuild = {
            ...allResourcesFromJsenvBuild,
          };
          const serviceWorkerBuildUrl = urlInfoToBuildUrlMap.get(
            serviceWorkerEntryUrlInfo,
          );
          const serviceWorkerBuildSpecifier = buildUrlToBuildSpecifierMap.get(
            serviceWorkerBuildUrl,
          );
          delete resourcesFromJsenvBuild[serviceWorkerBuildSpecifier];
          await prependContent(serviceWorkerEntryUrlInfo, {
            type: "js_classic",
            content: `self.resourcesFromJsenvBuild = ${JSON.stringify(
              resourcesFromJsenvBuild,
              null,
              "  ",
            )};\n`,
          });
        }
      };
    },

    getBuildInfo: () => {
      const buildManifest = {};
      const buildContents = {};
      const buildInlineRelativeUrlSet = new Set();
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned = versioning
            ? buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier)
            : null;
          const buildRelativeUrl = urlToRelativeUrl(
            buildUrl,
            buildDirectoryUrl,
          );
          let contentKey;
          // if to guard for html where versioned build specifier is not generated
          if (buildSpecifierVersioned) {
            const buildUrlVersioned = asBuildUrlVersioned({
              buildSpecifierVersioned,
              buildDirectoryUrl,
            });
            const buildRelativeUrlVersioned = urlToRelativeUrl(
              buildUrlVersioned,
              buildDirectoryUrl,
            );
            buildManifest[buildRelativeUrl] = buildRelativeUrlVersioned;
            contentKey = buildRelativeUrlVersioned;
          } else {
            contentKey = buildRelativeUrl;
          }
          if (urlInfo.type !== "directory") {
            buildContents[contentKey] = urlInfo.content;
          }
          if (urlInfo.isInline) {
            buildInlineRelativeUrlSet.add(buildRelativeUrl);
          }
        },
      );
      const buildFileContents = {};
      const buildInlineContents = {};
      Object.keys(buildContents)
        .sort((a, b) => comparePathnames(a, b))
        .forEach((buildRelativeUrl) => {
          if (buildInlineRelativeUrlSet.has(buildRelativeUrl)) {
            buildInlineContents[buildRelativeUrl] =
              buildContents[buildRelativeUrl];
          } else {
            buildFileContents[buildRelativeUrl] =
              buildContents[buildRelativeUrl];
          }
        });

      return { buildFileContents, buildInlineContents, buildManifest };
    },
  };
};

// see https://github.com/rollup/rollup/blob/ce453507ab8457dd1ea3909d8dd7b117b2d14fab/src/utils/hashPlaceholders.ts#L1
// see also "New hashing algorithm that "fixes (nearly) everything"
// at https://github.com/rollup/rollup/pull/4543
const placeholderLeft = "!~{";
const placeholderRight = "}~";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

const createPlaceholderAPI = ({ length }) => {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
  const toBase64 = (value) => {
    let outString = "";
    do {
      const currentDigit = value % 64;
      value = (value / 64) | 0;
      outString = chars[currentDigit] + outString;
    } while (value !== 0);
    return outString;
  };

  let nextIndex = 0;
  const generate = () => {
    nextIndex++;
    const id = toBase64(nextIndex);
    let placeholder = placeholderLeft;
    placeholder += id.padStart(length - placeholderOverhead, "0");
    placeholder += placeholderRight;
    return placeholder;
  };

  const replaceFirst = (code, value) => {
    let replaced = false;
    return code.replace(PLACEHOLDER_REGEX, (match) => {
      if (replaced) return match;
      replaced = true;
      return value;
    });
  };

  const extractFirst = (string) => {
    const match = string.match(PLACEHOLDER_REGEX);
    return match ? match[0] : null;
  };

  const defaultPlaceholder = `${placeholderLeft}${"0".repeat(
    length - placeholderOverhead,
  )}${placeholderRight}`;
  const replaceWithDefault = (code, onPlaceholder) => {
    const transformedCode = code.replace(PLACEHOLDER_REGEX, (placeholder) => {
      onPlaceholder(placeholder);
      return defaultPlaceholder;
    });
    return transformedCode;
  };

  const PLACEHOLDER_REGEX = new RegExp(
    `${escapeRegexpSpecialChars(placeholderLeft)}[0-9a-zA-Z_$]{1,${
      length - placeholderOverhead
    }}${escapeRegexpSpecialChars(placeholderRight)}`,
    "g",
  );

  const markAsCode = (string) => {
    return {
      __isCode__: true,
      toString: () => string,
      value: string,
    };
  };

  const replaceAll = (string, replacer) => {
    const magicSource = createMagicSource(string);

    string.replace(PLACEHOLDER_REGEX, (placeholder, index) => {
      const replacement = replacer(placeholder, index);
      if (!replacement) {
        return;
      }
      let value;
      let isCode = false;
      if (replacement && replacement.__isCode__) {
        value = replacement.value;
        isCode = true;
      } else {
        value = replacement;
      }

      let start = index;
      let end = start + placeholder.length;
      if (
        isCode &&
        // when specifier is wrapper by quotes
        // we remove the quotes to transform the string
        // into code that will be executed
        isWrappedByQuote(string, start, end)
      ) {
        start = start - 1;
        end = end + 1;
      }
      magicSource.replace({
        start,
        end,
        replacement: value,
      });
    });
    return magicSource.toContentAndSourcemap();
  };

  return {
    generate,
    replaceFirst,
    replaceAll,
    extractFirst,
    markAsCode,
    replaceWithDefault,
  };
};

const mayUsePlaceholder = (urlInfo) => {
  if (urlInfo.referenceToOthersSet.size === 0) {
    return false;
  }
  if (!CONTENT_TYPE.isTextual(urlInfo.contentType)) {
    return false;
  }
  return true;
};

const isWrappedByQuote = (content, start, end) => {
  const previousChar = content[start - 1];
  const nextChar = content[end];
  if (previousChar === `'` && nextChar === `'`) {
    return true;
  }
  if (previousChar === `"` && nextChar === `"`) {
    return true;
  }
  if (previousChar === "`" && nextChar === "`") {
    return true;
  }
  return false;
};

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
const generateVersion = (parts, length) => {
  const hash = createHash("sha256");
  parts.forEach((part) => {
    hash.update(part);
  });
  return hash.digest("hex").slice(0, length);
};

const injectVersionIntoBuildSpecifier = ({
  buildSpecifier,
  version,
  versioningMethod,
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParamIntoSpecifierWithoutEncoding(
      buildSpecifier,
      "v",
      version,
    );
  }
  return renderUrlOrRelativeUrlFilename(
    buildSpecifier,
    ({ basename, extension }) => {
      return `${basename}-${version}${extension}`;
    },
  );
};

const asBuildUrlVersioned = ({
  buildSpecifierVersioned,
  buildDirectoryUrl,
}) => {
  if (buildSpecifierVersioned[0] === "/") {
    return new URL(buildSpecifierVersioned.slice(1), buildDirectoryUrl).href;
  }
  const buildUrl = new URL(buildSpecifierVersioned, buildDirectoryUrl).href;
  if (buildUrl.startsWith(buildDirectoryUrl)) {
    return buildUrl;
  }
  // it's likely "base" parameter was set to an url origin like "https://cdn.example.com"
  // let's move url to build directory
  const { pathname, search, hash } = new URL(buildSpecifierVersioned);
  return `${buildDirectoryUrl}${pathname}${search}${hash}`;
};

/*
 * Build is split in 3 steps:
 * 1. craft
 * 2. shape
 * 3. refine
 *
 * craft: prepare all the materials
 *  - resolve, fetch and transform all source files into "rawKitchen.graph"
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
  samsung: "9.2",
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
 * @param {boolean|object} [buildParameters.bundling=true]
 *        Reduce number of files written in the build directory
 *  @param {boolean|object} [buildParameters.minification=true]
 *        Minify the content of files written into the build directory
 * @param {boolean} [buildParameters.versioning=true]
 *        Use versioning on files written in the build directory
 * @param {('search_param'|'filename')} [buildParameters.versioningMethod="search_param"]
 *        Controls how url are versioned in the build directory
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
  ignore,

  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceAllowed,
  scenarioPlaceholders,
  injections,
  transpilation = {},
  bundling = true,
  minification = !runtimeCompat.node,
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param", // "filename", "search_param"
  versioningViaImportmap = true,
  versionLength = 8,
  lineBreakNormalization = process.platform === "win32",

  sourceFilesConfig = {},
  cooldownBetweenFileEvents,
  watch = false,

  directoryToClean,
  sourcemaps = "none",
  sourcemapsSourcesContent,
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
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
      buildDirectoryUrl,
      "buildDirectoryUrl",
    );
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }

    if (typeof entryPoints !== "object" || entryPoints === null) {
      throw new TypeError(`entryPoints must be an object, got ${entryPoints}`);
    }
    const keys = Object.keys(entryPoints);
    keys.forEach((key) => {
      if (!key.startsWith("./")) {
        throw new TypeError(
          `entryPoints keys must start with "./", found ${key}`,
        );
      }
      const value = entryPoints[key];
      if (typeof value !== "string") {
        throw new TypeError(
          `entryPoints values must be strings, found "${value}" on key "${key}"`,
        );
      }
      if (value.includes("/")) {
        throw new TypeError(
          `entryPoints values must be plain strings (no "/"), found "${value}" on key "${key}"`,
        );
      }
    });
    if (!["filename", "search_param"].includes(versioningMethod)) {
      throw new TypeError(
        `versioningMethod must be "filename" or "search_param", got ${versioning}`,
      );
    }
    if (bundling === true) {
      bundling = {};
    }
    if (minification === true) {
      minification = {};
    }
  }

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
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

  const runBuild = async ({ signal, logLevel }) => {
    const logger = createLogger({ logLevel });
    const createBuildTask = (label) => {
      return createTaskLog(label, {
        disabled: !logger.levels.debug && !logger.levels.info,
        animated: !logger.levels.debug,
      });
    };

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
    let explicitJsModuleConversion = false;
    for (const entryPointKey of entryPointKeys) {
      if (entryPointKey.includes("?js_module_fallback")) {
        explicitJsModuleConversion = true;
        break;
      }
      if (entryPointKey.includes("?as_js_classic")) {
        explicitJsModuleConversion = true;
        break;
      }
    }
    const rawRedirections = new Map();
    const entryUrls = [];
    const contextSharedDuringBuild = {
      buildStep: "craft",
      buildDirectoryUrl,
      assetsDirectory,
      versioning,
      versioningViaImportmap,
    };
    const rawKitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      ignore,
      // during first pass (craft) we keep "ignore:" when a reference is ignored
      // so that the second pass (shape) properly ignore those urls
      ignoreProtocol: "keep",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      plugins: [
        ...plugins,
        ...(bundling ? [jsenvPluginBundling(bundling)] : []),
        ...(minification ? [jsenvPluginMinification(minification)] : []),
        {
          appliesDuring: "build",
          fetchUrlContent: (urlInfo) => {
            if (urlInfo.firstReference.original) {
              rawRedirections.set(
                urlInfo.firstReference.original.url,
                urlInfo.firstReference.url,
              );
            }
          },
        },
        ...getCorePlugins({
          rootDirectoryUrl: sourceDirectoryUrl,
          runtimeCompat,
          referenceAnalysis,
          nodeEsmResolution,
          magicExtensions,
          magicDirectoryIndex,
          directoryReferenceAllowed,
          injections,
          transpilation: {
            babelHelpersAsImport: !explicitJsModuleConversion,
            ...transpilation,
            jsModuleFallback: false,
          },
          inlining: false,
          scenarioPlaceholders,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("craft/", outDirectoryUrl)
        : undefined,
    });
    {
      const generateSourceGraph = createBuildTask("generate source graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`craft/`, outDirectoryUrl));
        }
        const rawRootUrlInfo = rawKitchen.graph.rootUrlInfo;
        await rawRootUrlInfo.dependencies.startCollecting(() => {
          Object.keys(entryPoints).forEach((key) => {
            const entryReference = rawRootUrlInfo.dependencies.found({
              trace: { message: `"${key}" in entryPoints parameter` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: key,
              filenameHint: entryPoints[key],
            });
            entryUrls.push(entryReference.url);
          });
        });
        await rawRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      } catch (e) {
        generateSourceGraph.fail();
        throw e;
      }
      generateSourceGraph.done();
    }

    const finalKitchen = createKitchen({
      name: "shape",
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      // here most plugins are not there
      // - no external plugin
      // - no plugin putting reference.mustIgnore on https urls
      // At this stage it's only about redirecting urls to the build directory
      // consequently only a subset or urls are supported
      supportedProtocols: ["file:", "data:", "virtual:", "ignore:"],
      ignore,
      ignoreProtocol: "remove",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      initialPluginsMeta: rawKitchen.pluginController.pluginsMeta,
      plugins: [
        jsenvPluginReferenceAnalysis({
          ...referenceAnalysis,
          fetchInlineUrls: false,
          // inlineContent: false,
        }),
        ...(lineBreakNormalization
          ? [jsenvPluginLineBreakNormalization()]
          : []),
        jsenvPluginJsModuleFallback({
          remapImportSpecifier: (specifier, parentUrl) => {
            return buildSpecifierManager.remapPlaceholder(specifier, parentUrl);
          },
        }),
        jsenvPluginInlining(),
        {
          name: "jsenv:optimize",
          appliesDuring: "build",
          transformUrlContent: async (urlInfo) => {
            await rawKitchen.pluginController.callAsyncHooks(
              "optimizeUrlContent",
              urlInfo,
              (optimizeReturnValue) => {
                urlInfo.mutateContent(optimizeReturnValue);
              },
            );
          },
        },
      ],
      sourcemaps,
      sourcemapsComment: "relative",
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("shape/", outDirectoryUrl)
        : undefined,
    });

    const buildSpecifierManager = createBuildSpecifierManager({
      rawKitchen,
      finalKitchen,
      logger,
      sourceDirectoryUrl,
      buildDirectoryUrl,
      base,
      assetsDirectory,

      versioning,
      versioningMethod,
      versionLength,
      canUseImportmap:
        versioningViaImportmap &&
        entryUrls.every((finalEntryUrl) => {
          const entryUrlInfo = rawKitchen.graph.getUrlInfo(finalEntryUrl);
          return entryUrlInfo.type === "html";
        }) &&
        rawKitchen.context.isSupportedOnCurrentClients("importmap"),
    });
    finalKitchen.pluginController.pushPlugin(
      buildSpecifierManager.jsenvPluginMoveToBuildDirectory,
    );

    const bundlers = {};
    {
      rawKitchen.pluginController.plugins.forEach((plugin) => {
        const bundle = plugin.bundle;
        if (!bundle) {
          return;
        }
        if (typeof bundle !== "object") {
          throw new Error(
            `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
          );
        }
        Object.keys(bundle).forEach((type) => {
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
            urlInfoMap: new Map(),
          };
        });
      });
      const addToBundlerIfAny = (rawUrlInfo) => {
        const bundler = bundlers[rawUrlInfo.type];
        if (bundler) {
          bundler.urlInfoMap.set(rawUrlInfo.url, rawUrlInfo);
        }
      };
      // ignore unused urls thanks to "forEachUrlInfoStronglyReferenced"
      // it avoid bundling things that are not actually used
      // happens for:
      // - js import assertions
      // - conversion to js classic using ?as_js_classic or ?js_module_fallback
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        rawKitchen.graph.rootUrlInfo,
        (rawUrlInfo) => {
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo);
          }
          if (rawUrlInfo.type === "html") {
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (referenceToOther.isWeak) {
                return;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              if (referencedUrlInfo.isInline) {
                if (referencedUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  referencedUrlInfo.referenceToOthersSet.forEach(
                    (jsModuleReferenceToOther) => {
                      if (jsModuleReferenceToOther.type === "js_import") {
                        const inlineUrlInfo = jsModuleReferenceToOther.urlInfo;
                        addToBundlerIfAny(inlineUrlInfo);
                      }
                    },
                  );
                }
                // inline content cannot be bundled
                return;
              }
              addToBundlerIfAny(referencedUrlInfo);
            });
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (
                referenceToOther.isResourceHint &&
                referenceToOther.expectedType === "js_module"
              ) {
                const referencedUrlInfo = referenceToOther.urlInfo;
                if (
                  referencedUrlInfo &&
                  // something else than the resource hint is using this url
                  referencedUrlInfo.referenceFromOthersSet.size > 0
                ) {
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
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (referenceToOther.type === "js_url") {
                const referencedUrlInfo = referenceToOther.urlInfo;
                for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
                  if (referenceFromOther.url === referencedUrlInfo.url) {
                    if (
                      referenceFromOther.subtype === "import_dynamic" ||
                      referenceFromOther.type === "script"
                    ) {
                      // will already be bundled
                      return;
                    }
                  }
                }
                addToBundlerIfAny(referencedUrlInfo);
                return;
              }
              if (referenceToOther.type === "js_inline_content") ;
            });
          }
        },
      );
      for (const type of Object.keys(bundlers)) {
        const bundler = bundlers[type];
        const urlInfosToBundle = Array.from(bundler.urlInfoMap.values());
        if (urlInfosToBundle.length === 0) {
          continue;
        }
        const bundleTask = createBuildTask(`bundle "${type}"`);
        try {
          await buildSpecifierManager.applyBundling({
            bundler,
            urlInfosToBundle,
          });
        } catch (e) {
          bundleTask.fail();
          throw e;
        }
        bundleTask.done();
      }
    }

    {
      finalKitchen.context.buildStep = "shape";
      const generateBuildGraph = createBuildTask("generate build graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`shape/`, outDirectoryUrl));
        }
        const finalRootUrlInfo = finalKitchen.graph.rootUrlInfo;
        await finalRootUrlInfo.dependencies.startCollecting(() => {
          entryUrls.forEach((entryUrl) => {
            finalRootUrlInfo.dependencies.found({
              trace: { message: `entryPoint` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: entryUrl,
            });
          });
        });
        await finalRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      } catch (e) {
        generateBuildGraph.fail();
        throw e;
      }
      generateBuildGraph.done();
    }

    {
      finalKitchen.context.buildStep = "refine";
      {
        await buildSpecifierManager.replacePlaceholders();
      }
      {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          if (urlInfo.type === "html") {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false,
            });
            urlInfo.content = stringifyHtmlAst(htmlAst, {
              cleanupJsenvAttributes: true,
              cleanupPositionAttributes: true,
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
        const resync = buildSpecifierManager.prepareResyncResourceHints();
        if (resync) {
          const resyncTask = createBuildTask("resync resource hints");
          resync();
          buildOperation.throwIfAborted();
          resyncTask.done();
        }
      }
      {
        const inject = buildSpecifierManager.prepareServiceWorkerUrlInjection();
        if (inject) {
          const urlsInjectionInSw = createBuildTask(
            "inject urls in service worker",
          );
          await inject();
          urlsInjectionInSw.done();
          buildOperation.throwIfAborted();
        }
      }
    }
    const { buildFileContents, buildInlineContents, buildManifest } =
      buildSpecifierManager.getBuildInfo();
    if (writeOnFileSystem) {
      const writingFiles = createBuildTask("write files in build directory");
      if (directoryToClean) {
        await ensureEmptyDirectory(directoryToClean);
      }
      const buildRelativeUrls = Object.keys(buildFileContents);
      buildRelativeUrls.forEach((buildRelativeUrl) => {
        writeFileSync(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        );
      });
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        writeFileSync(
          new URL(assetManifestFileRelativeUrl, buildDirectoryUrl),
          JSON.stringify(buildManifest, null, "  "),
        );
      }
      writingFiles.done();
    }
    logger.info(
      createUrlGraphSummary(finalKitchen.graph, {
        title: "build files",
      }),
    );
    return {
      buildFileContents,
      buildInlineContents,
      buildManifest,
    };
  };

  if (!watch) {
    return runBuild({ signal: operation.signal, logLevel });
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
        logLevel: "warn",
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
  const stopWatchingSourceFiles = watchSourceFiles(
    sourceDirectoryUrl,
    ({ url, event }) => {
      if (watchFilesTask) {
        watchFilesTask.happen(
          `${url.slice(sourceDirectoryUrl.length)} ${event}`,
        );
        watchFilesTask = null;
      }
      buildAbortController.abort();
      // setTimeout is to ensure the abortController.abort() above
      // is properly taken into account so that logs about abort comes first
      // then logs about re-running the build happens
      clearTimeout(startTimeout);
      startTimeout = setTimeout(startBuild, 20);
    },
    {
      sourceFilesConfig,
      keepProcessAlive: true,
      cooldownBetweenFileEvents,
    },
  );
  operation.addAbortCallback(() => {
    stopWatchingSourceFiles();
  });
  await firstBuildPromise;
  return stopWatchingSourceFiles;
};

const WEB_URL_CONVERTER = {
  asWebUrl: (fileUrl, webServer) => {
    if (urlIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      return moveUrl({
        url: fileUrl,
        from: webServer.rootDirectoryUrl,
        to: `${webServer.origin}/`,
      });
    }
    const fsRootUrl = ensureWindowsDriveLetter("file:///", fileUrl);
    return `${webServer.origin}/@fs/${fileUrl.slice(fsRootUrl.length)}`;
  },
  asFileUrl: (webUrl, webServer) => {
    const { pathname, search } = new URL(webUrl);
    if (pathname.startsWith("/@fs/")) {
      const fsRootRelativeUrl = pathname.slice("/@fs/".length);
      return `file:///${fsRootRelativeUrl}${search}`;
    }
    return moveUrl({
      url: webUrl,
      from: `${webServer.origin}/`,
      to: webServer.rootDirectoryUrl,
    });
  },
};

/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

const serverEventsClientFileUrl = new URL(
  "./js/server_events_client.js",
  import.meta.url,
).href;

const jsenvPluginServerEventsClientInjection = ({ logs = true }) => {
  return {
    name: "jsenv:server_events_client_injection",
    appliesDuring: "*",
    transformUrlContent: {
      html: () => {
        return {
          scriptInjections: [
            {
              src: serverEventsClientFileUrl,
              setup: {
                name: "window.__server_events__.setup",
                param: {
                  logs,
                },
              },
            },
          ],
        };
      },
    },
  };
};

const memoizeByFirstArgument = (compute) => {
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

const requireFromJsenv = createRequire(import.meta.url);

const parseUserAgentHeader = memoizeByFirstArgument((userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    };
  }
  const UA = requireFromJsenv("@financial-times/polyfill-useragent-normaliser");
  const { ua } = new UA(userAgent);
  const { family, major, minor, patch } = ua;
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion:
      family === "Other" ? "unknown" : `${major}.${minor}${patch}`,
  };
});

const createFileService = ({
  signal,
  logLevel,
  serverStopCallbacks,
  serverEventsDispatcher,
  kitchenCache,
  onKitchenCreated = () => {},

  sourceDirectoryUrl,
  sourceMainFilePath,
  ignore,
  sourceFilesConfig,
  runtimeCompat,

  plugins,
  referenceAnalysis,
  nodeEsmResolution,
  magicExtensions,
  magicDirectoryIndex,
  supervisor,
  injections,
  transpilation,
  clientAutoreload,
  cacheControl,
  ribbon,
  sourcemaps,
  sourcemapsSourcesContent,
  outDirectoryUrl,
}) => {
  if (clientAutoreload === true) {
    clientAutoreload = {};
  }
  if (clientAutoreload === false) {
    clientAutoreload = { enabled: false };
  }
  const clientFileChangeEventEmitter = createEventEmitter();
  const clientFileDereferencedEventEmitter = createEventEmitter();

  clientAutoreload = {
    enabled: true,
    clientServerEventsConfig: {},
    clientFileChangeEventEmitter,
    clientFileDereferencedEventEmitter,
    ...clientAutoreload,
  };

  const stopWatchingSourceFiles = watchSourceFiles(
    sourceDirectoryUrl,
    (fileInfo) => {
      clientFileChangeEventEmitter.emit(fileInfo);
    },
    {
      sourceFilesConfig,
      keepProcessAlive: false,
      cooldownBetweenFileEvents: clientAutoreload.cooldownBetweenFileEvents,
    },
  );
  serverStopCallbacks.push(stopWatchingSourceFiles);

  const getOrCreateKitchen = (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"] || "",
    );
    const runtimeId = `${runtimeName}@${runtimeVersion}`;
    const existing = kitchenCache.get(runtimeId);
    if (existing) {
      return existing;
    }
    const watchAssociations = URL_META.resolveAssociations(
      { watch: stopWatchingSourceFiles.watchPatterns },
      sourceDirectoryUrl,
    );
    let kitchen;
    clientFileChangeEventEmitter.on(({ url }) => {
      const urlInfo = kitchen.graph.getUrlInfo(url);
      if (urlInfo) {
        urlInfo.onModified();
      }
    });
    const clientRuntimeCompat = { [runtimeName]: runtimeVersion };

    kitchen = createKitchen({
      name: runtimeId,
      signal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      mainFilePath: sourceMainFilePath,
      ignore,
      dev: true,
      runtimeCompat,
      clientRuntimeCompat,
      plugins: [
        ...plugins,
        ...getCorePlugins({
          rootDirectoryUrl: sourceDirectoryUrl,
          runtimeCompat,

          referenceAnalysis,
          nodeEsmResolution,
          magicExtensions,
          magicDirectoryIndex,
          supervisor,
          injections,
          transpilation,

          clientAutoreload,
          cacheControl,
          ribbon,
        }),
      ],
      supervisor,
      minification: false,
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL(`${runtimeName}@${runtimeVersion}/`, outDirectoryUrl)
        : undefined,
    });
    kitchen.graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
      const { watch } = URL_META.applyAssociations({
        url: urlInfoCreated.url,
        associations: watchAssociations,
      });
      urlInfoCreated.isWatched = watch;
      // wehn an url depends on many others, we check all these (like package.json)
      urlInfoCreated.isValid = () => {
        if (!urlInfoCreated.url.startsWith("file:")) {
          return false;
        }
        if (urlInfoCreated.content === undefined) {
          // urlInfo content is undefined when:
          // - url info content never fetched
          // - it is considered as modified because undelying file is watched and got saved
          // - it is considered as modified because underlying file content
          //   was compared using etag and it has changed
          return false;
        }
        if (!watch) {
          // file is not watched, check the filesystem
          let fileContentAsBuffer;
          try {
            fileContentAsBuffer = readFileSync(new URL(urlInfoCreated.url));
          } catch (e) {
            if (e.code === "ENOENT") {
              urlInfoCreated.onModified();
              return false;
            }
            return false;
          }
          const fileContentEtag = bufferToEtag$1(fileContentAsBuffer);
          if (fileContentEtag !== urlInfoCreated.originalContentEtag) {
            urlInfoCreated.onModified();
            // restore content to be able to compare it again later
            urlInfoCreated.kitchen.urlInfoTransformer.setContent(
              urlInfoCreated,
              String(fileContentAsBuffer),
              {
                contentEtag: fileContentEtag,
              },
            );
            return false;
          }
        }
        for (const implicitUrl of urlInfoCreated.implicitUrlSet) {
          const implicitUrlInfo = urlInfoCreated.graph.getUrlInfo(implicitUrl);
          if (implicitUrlInfo && !implicitUrlInfo.isValid()) {
            return false;
          }
        }
        return true;
      };
    });
    kitchen.graph.urlInfoDereferencedEventEmitter.on(
      (urlInfoDereferenced, lastReferenceFromOther) => {
        clientFileDereferencedEventEmitter.emit(
          urlInfoDereferenced,
          lastReferenceFromOther,
        );
      },
    );

    serverStopCallbacks.push(() => {
      kitchen.pluginController.callHooks("destroy", kitchen.context);
    });
    {
      const allServerEvents = {};
      kitchen.pluginController.plugins.forEach((plugin) => {
        const { serverEvents } = plugin;
        if (serverEvents) {
          Object.keys(serverEvents).forEach((serverEventName) => {
            // we could throw on serverEvent name conflict
            // we could throw if serverEvents[serverEventName] is not a function
            allServerEvents[serverEventName] = serverEvents[serverEventName];
          });
        }
      });
      const serverEventNames = Object.keys(allServerEvents);
      if (serverEventNames.length > 0) {
        Object.keys(allServerEvents).forEach((serverEventName) => {
          const serverEventInfo = {
            ...kitchen.context,
            sendServerEvent: (data) => {
              serverEventsDispatcher.dispatch({
                type: serverEventName,
                data,
              });
            },
          };
          const serverEventInit = allServerEvents[serverEventName];
          serverEventInit(serverEventInfo);
        });
        // "pushPlugin" so that event source client connection can be put as early as possible in html
        kitchen.pluginController.pushPlugin(
          jsenvPluginServerEventsClientInjection(
            clientAutoreload.clientServerEventsConfig,
          ),
        );
      }
    }

    kitchenCache.set(runtimeId, kitchen);
    onKitchenCreated(kitchen);
    return kitchen;
  };

  return async (request) => {
    const kitchen = getOrCreateKitchen(request);
    const serveHookInfo = {
      ...kitchen.context,
      request,
    };
    const responseFromPlugin =
      await kitchen.pluginController.callAsyncHooksUntil(
        "serve",
        serveHookInfo,
      );
    if (responseFromPlugin) {
      return responseFromPlugin;
    }
    const { referer } = request.headers;
    const parentUrl = referer
      ? WEB_URL_CONVERTER.asFileUrl(referer, {
          origin: request.origin,
          rootDirectoryUrl: sourceDirectoryUrl,
        })
      : sourceDirectoryUrl;
    let reference = kitchen.graph.inferReference(request.resource, parentUrl);
    if (!reference) {
      reference =
        kitchen.graph.rootUrlInfo.dependencies.createResolveAndFinalize({
          trace: { message: parentUrl },
          type: "http_request",
          specifier: request.resource,
        });
    }
    const urlInfo = reference.urlInfo;
    const ifNoneMatch = request.headers["if-none-match"];
    const urlInfoTargetedByCache = urlInfo.findParentIfInline() || urlInfo;

    try {
      if (!urlInfo.error && ifNoneMatch) {
        const [clientOriginalContentEtag, clientContentEtag] =
          ifNoneMatch.split("_");
        if (
          urlInfoTargetedByCache.originalContentEtag ===
            clientOriginalContentEtag &&
          urlInfoTargetedByCache.contentEtag === clientContentEtag &&
          urlInfoTargetedByCache.isValid()
        ) {
          const headers = {
            "cache-control": `private,max-age=0,must-revalidate`,
          };
          Object.keys(urlInfo.headers).forEach((key) => {
            if (key !== "content-length") {
              headers[key] = urlInfo.headers[key];
            }
          });
          return {
            status: 304,
            headers,
          };
        }
      }

      await urlInfo.cook({ request, reference });
      let { response } = urlInfo;
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
          ...(urlInfo.headers["cache-control"] === "no-store" ||
          urlInfo.headers["cache-control"] === "no-cache"
            ? {}
            : {
                "cache-control": `private,max-age=0,must-revalidate`,
                // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
                "eTag": `${urlInfoTargetedByCache.originalContentEtag}_${urlInfoTargetedByCache.contentEtag}`,
              }),
          ...urlInfo.headers,
          "content-type": urlInfo.contentType,
          "content-length": urlInfo.contentLength,
        },
        body: urlInfo.content,
        timing: urlInfo.timing,
      };
      const augmentResponseInfo = {
        ...kitchen.context,
        reference,
        urlInfo,
      };
      kitchen.pluginController.callHooks(
        "augmentResponse",
        augmentResponseInfo,
        (returnValue) => {
          response = composeTwoResponses(response, returnValue);
        },
      );
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
              "content-length": urlInfo.contentLength,
              "cache-control": "no-store",
            },
            body: urlInfo.content,
          };
        }
        return {
          url: reference.url,
          status: 500,
          statusText: e.reason,
          statusMessage: originalError.message,
          headers: {
            "cache-control": "no-store",
          },
          body: urlInfo.content,
        };
      }
      if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html",
          },
          canReadDirectory: true,
          rootDirectoryUrl: sourceDirectoryUrl,
        });
      }
      if (code === "NOT_ALLOWED") {
        return {
          url: reference.url,
          status: 403,
          statusText: originalError.reason,
        };
      }
      if (code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: originalError.reason,
          statusMessage: originalError.message,
        };
      }
      return {
        url: reference.url,
        status: 500,
        statusText: e.reason,
        statusMessage: e.stack,
      };
    }
  };
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
  ignore,
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

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  supervisor = true,
  magicExtensions,
  magicDirectoryIndex,
  injections,
  transpilation,
  cacheControl = true,
  ribbon = true,
  // toolbar = false,
  onKitchenCreated = () => {},

  sourcemaps = "inline",
  sourcemapsSourcesContent,
  outDirectoryUrl,
  ...rest
}) => {
  // params type checking
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    if (typeof sourceMainFilePath !== "string") {
      throw new TypeError(
        `sourceMainFilePath must be a string, got ${sourceMainFilePath}`,
      );
    }
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }
  }

  const logger = createLogger({ logLevel });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }
  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  });

  const serverStopCallbacks = [];
  const serverEventsDispatcher = createServerEventsDispatcher();
  serverStopCallbacks.push(() => {
    serverEventsDispatcher.destroy();
  });
  const kitchenCache = new Map();
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive: process.env.IMPORTED_BY_TEST_PLAN
      ? false
      : keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    services: [
      {
        handleRequest: (request) => {
          if (request.headers["x-server-inspect"]) {
            return { status: 200 };
          }
          if (request.pathname === "/__params__.json") {
            const json = JSON.stringify({
              sourceDirectoryUrl,
            });
            return {
              status: 200,
              headers: {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(json),
              },
              body: json,
            };
          }
          return null;
        },
        injectResponseHeaders: () => {
          return { server: "jsenv_dev_server/1" };
        },
      },
      jsenvServiceCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
      ...services,
      {
        name: "jsenv:omega_file_service",
        handleRequest: createFileService({
          signal,
          logLevel,
          serverStopCallbacks,
          serverEventsDispatcher,
          kitchenCache,
          onKitchenCreated,

          sourceDirectoryUrl,
          sourceMainFilePath,
          ignore,
          sourceFilesConfig,
          runtimeCompat,

          plugins,
          referenceAnalysis,
          nodeEsmResolution,
          magicExtensions,
          magicDirectoryIndex,
          supervisor,
          injections,
          transpilation,
          clientAutoreload,
          cacheControl,
          ribbon,
          sourcemaps,
          sourcemapsSourcesContent,
          outDirectoryUrl,
        }),
        handleWebsocket: (websocket, { request }) => {
          if (request.headers["sec-websocket-protocol"] === "jsenv") {
            serverEventsDispatcher.addWebsocket(websocket, request);
          }
        },
      },
      {
        name: "jsenv:omega_error_handler",
        handleError: (error) => {
          const getResponseForError = () => {
            if (error && error.asResponse) {
              return error.asResponse();
            }
            if (
              error &&
              error.statusText === "Unexpected directory operation"
            ) {
              return {
                status: 403,
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
            body: response.body,
          });
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      },
      // default error handling
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
  });
  server.stoppedPromise.then((reason) => {
    onStop();
    serverStopCallbacks.forEach((serverStopCallback) => {
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
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    },
    kitchenCache,
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
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
      buildDirectoryUrl,
      "buildDirectoryUrl",
    );

    if (buildMainFilePath) {
      if (typeof buildMainFilePath !== "string") {
        throw new TypeError(
          `buildMainFilePath must be a string, got ${buildMainFilePath}`,
        );
      }
      if (buildMainFilePath[0] === "/") {
        buildMainFilePath = buildMainFilePath.slice(1);
      } else {
        const buildMainFileUrl = new URL(buildMainFilePath, buildDirectoryUrl)
          .href;
        if (!buildMainFileUrl.startsWith(buildDirectoryUrl)) {
          throw new Error(
            `buildMainFilePath must be relative, got ${buildMainFilePath}`,
          );
        }
        buildMainFilePath = buildMainFileUrl.slice(buildDirectoryUrl.length);
      }
      if (!existsSync(new URL(buildMainFilePath, buildDirectoryUrl))) {
        buildMainFilePath = null;
      }
    }
  }

  const logger = createLogger({ logLevel });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }

  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !logger.levels.info,
  });
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive: process.env.IMPORTED_BY_TEST_PLAN
      ? false
      : keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    serverTiming: true,
    requestWaitingMs: 60_000,
    services: [
      jsenvServiceCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
      ...services,
      {
        name: "jsenv:build_files_service",
        handleRequest: createBuildFilesService({
          buildDirectoryUrl,
          buildMainFilePath,
        }),
      },
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
  });
  startBuildServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    },
  };
};

const createBuildFilesService = ({ buildDirectoryUrl, buildMainFilePath }) => {
  return (request) => {
    const urlIsVersioned = new URL(request.url).searchParams.has("v");
    if (buildMainFilePath && request.resource === "/") {
      request = {
        ...request,
        resource: `/${buildMainFilePath}`,
      };
    }
    return fetchFileSystem(
      new URL(request.resource.slice(1), buildDirectoryUrl),
      {
        headers: request.headers,
        cacheControl: urlIsVersioned
          ? `private,max-age=${SECONDS_IN_30_DAYS},immutable`
          : "private,max-age=0,must-revalidate",
        etagEnabled: true,
        compressionEnabled: !request.pathname.endsWith(".mp4"),
        rootDirectoryUrl: buildDirectoryUrl,
        canReadDirectory: true,
      },
    );
  };
};

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;

export { INJECTIONS, build, startBuildServer, startDevServer };
