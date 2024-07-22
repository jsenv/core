// - Find all things looking like urls and replace with stable values
// - Find all things looking likes dates and replace with stable values

import stripAnsi from "strip-ansi";
import { pathToFileURL, fileURLToPath } from "node:url";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import {
  parseHtml,
  setHtmlNodeText,
  visitHtmlNodes,
  getHtmlNodeText,
  getHtmlNodeAttributes,
  setHtmlNodeAttributes,
  stringifyHtmlAst,
} from "@jsenv/ast";
import { urlToExtension } from "@jsenv/urls";

export const replaceFluctuatingValues = (
  string,
  {
    fileUrl,
    removeAnsi = true,
    rootDirectoryUrl = pathToFileURL(process.cwd()),
    // for unit tests
    rootDirectoryPath = fileURLToPath(rootDirectoryUrl),
    isWindows = process.platform === "win32",
  } = {},
) => {
  if (removeAnsi) {
    string = stripAnsi(string);
  }
  rootDirectoryUrl = String(rootDirectoryUrl);
  if (rootDirectoryUrl[rootDirectoryUrl.length - 1] === "/") {
    rootDirectoryUrl = rootDirectoryUrl.slice(0, -1);
  }
  const replaceFileUrls = (value) => {
    return value.replaceAll(rootDirectoryUrl, "file:///cwd()");
  };
  const replaceFilePaths = isWindows
    ? (value) => {
        const windowPathRegex = new RegExp(
          `${escapeRegexpSpecialChars(rootDirectoryPath)}(((?:\\\\(?:[\\w !#()-]+|[.]{1,2})+)*)(?:\\\\)?)`,
          "gm",
        );
        return value.replaceAll(windowPathRegex, (match, afterCwd) => {
          return `cwd()${afterCwd.replaceAll("\\", "/")}`;
        });
      }
    : (value) => {
        return value.replaceAll(rootDirectoryPath, "cwd()");
      };
  const replaceThings = (value) => {
    value = replaceFileUrls(value);
    value = replaceFilePaths(value);
    value = replaceHttpUrls(value);
    return value;
  };

  if (fileUrl) {
    const extension = urlToExtension(fileUrl);
    if (extension === ".svg" || extension === ".html") {
      // do parse html
      const htmlAst = parseHtml(string);
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
