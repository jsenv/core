// - Find all things looking like urls and replace with stable values
// - Find all things looking likes dates and replace with stable values

import {
  getHtmlNodeAttributes,
  getHtmlNodeText,
  parseHtml,
  parseSvgString,
  setHtmlNodeAttributes,
  setHtmlNodeText,
  stringifyHtmlAst,
  visitHtmlNodes,
} from "@jsenv/ast";
import { removePathnameTrailingSlash, urlToExtension } from "@jsenv/urls";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import stripAnsi from "strip-ansi";

export const replaceFluctuatingValues = (
  string,
  {
    stringType,
    fileUrl,
    removeAnsi = true,
    rootDirectoryUrl,
    // for unit tests
    homedirDisabled,
    cwdPath = process.cwd(),
    cwdUrl,
    isWindows = process.platform === "win32",
  } = {},
) => {
  const wellKownUrlArray = [];
  const wellKnownPathArray = [];
  const addWellKnownFileUrl = (url, replacement) => {
    const urlWithoutTrailingSlash = removePathnameTrailingSlash(url);
    wellKownUrlArray.push({
      url: urlWithoutTrailingSlash,
      replacement,
      replace: (string) =>
        string.replaceAll(urlWithoutTrailingSlash, replacement),
    });
    const path =
      url === cwdUrl ? cwdPath : fileURLToPath(urlWithoutTrailingSlash);
    const windowPathRegex = new RegExp(
      `${escapeRegexpSpecialChars(path)}(((?:\\\\(?:[\\w !#()-]+|[.]{1,2})+)*)(?:\\\\)?)`,
      "gm",
    );
    const pathReplacement = replacement.slice("file:///".length);
    wellKnownPathArray.push({
      path,
      replacement: pathReplacement,
      replace: isWindows
        ? (string) => {
            return string.replaceAll(windowPathRegex, (match, after) => {
              return `${pathReplacement}${after.replaceAll("\\", "/")}`;
            });
          }
        : (string) => string.replaceAll(path, pathReplacement),
    });
  };
  if (rootDirectoryUrl) {
    addWellKnownFileUrl(rootDirectoryUrl, "file:///<root>");
  }
  home_dir: {
    if (!homedirDisabled) {
      const homedirPath = homedir();
      const homedirUrl = pathToFileURL(homedirPath);
      addWellKnownFileUrl(homedirUrl, "file:///~");
    }
  }
  process_cwd: {
    // we fallback on process.cwd()
    // but it's brittle because a file might be execute from anywhere
    // so it should be the last resort
    cwdUrl = cwdUrl || pathToFileURL(cwdPath);
    addWellKnownFileUrl(cwdUrl, "file:///cwd()");
  }
  const replaceFileUrls = (value) => {
    for (const wellKownUrl of wellKownUrlArray) {
      const replaceResult = wellKownUrl.replace(value);
      if (replaceResult !== value) {
        return replaceResult;
      }
    }
    return value;
  };
  const replaceFilePaths = (value) => {
    for (const wellKownPath of wellKnownPathArray) {
      const replaceResult = wellKownPath.replace(value);
      if (replaceResult !== value) {
        return replaceResult;
      }
    }
    return value;
  };
  const replaceThings = (value) => {
    if (removeAnsi) {
      value = stripAnsi(value);
    }
    value = replaceFileUrls(value);
    value = replaceFilePaths(value);
    value = replaceHttpUrls(value);
    return value;
  };

  if (fileUrl && stringType === undefined) {
    const extension = urlToExtension(fileUrl);
    if (extension === ".html") {
      stringType = "html";
    } else if (extension === ".svg") {
      stringType = "svg";
    }
  }
  if (stringType === "html") {
    // do parse html
    const htmlAst =
      stringType === "svg"
        ? parseSvgString(string)
        : parseHtml({
            html: string,
            storeOriginalPositions: false,
          });
    // for each attribute value
    // and each text node content
    visitHtmlNodes(htmlAst, {
      "*": (node) => {
        const htmlNodeText = getHtmlNodeText(node);
        if (htmlNodeText) {
          setHtmlNodeText(node, replaceThings(htmlNodeText));
        }
        const attributes = getHtmlNodeAttributes(node);
        if (attributes) {
          for (const name of Object.keys(attributes)) {
            attributes[name] = replaceThings(attributes[name]);
          }
          setHtmlNodeAttributes(node, attributes);
        }
      },
    });
    return stringifyHtmlAst(htmlAst);
  }
  return replaceThings(string);
};

const replaceHttpUrls = (source) => {
  return source.replace(/(?:https?|ftp):\/\/\S+[\w/]/g, (match) => {
    const lastChar = match[match.length - 1];
    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }
    try {
      const urlObject = new URL(match);
      if (urlObject.hostname === "www.w3.org") {
        return match;
      }
      if (urlObject.port) {
        urlObject.port = 9999;
      }
      const url = urlObject.href;
      return url;
    } catch (e) {
      return match;
    }
  });
};
