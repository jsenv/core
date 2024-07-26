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
import { urlToExtension } from "@jsenv/urls";
import stripAnsi from "strip-ansi";
import { createReplaceFilesystemWellKnownValues } from "./filesystem_well_known_values.js";

export const replaceFluctuatingValues = (
  string,
  {
    stringType,
    rootDirectoryUrl,
    fileUrl,
    removeAnsi = true,
    // for unit test
    replaceFilesystemWellKnownValues = createReplaceFilesystemWellKnownValues({
      rootDirectoryUrl,
    }),
  } = {},
) => {
  if (fileUrl && stringType === undefined) {
    const extension = urlToExtension(fileUrl);
    if (extension === ".html") {
      stringType = "html";
    } else if (extension === ".svg") {
      stringType = "svg";
    }
  }
  const replaceDurations = (value) => {
    // https://stackoverflow.com/a/59202307/24573072
    value = value.replace(
      /(?<!\d|\.)\d+(?:\.\d+)?(\s*)(seconds|second|s)\b/g,
      (match, space, unit) => {
        if (unit === "seconds") unit = "second";
        return `<X>${space}${unit}`;
      },
    );
    return value;
  };
  const replaceThings = (value) => {
    if (stringType === "filesystem") {
      return replaceFilesystemWellKnownValues(value, { stringType });
    }
    if (removeAnsi) {
      value = stripAnsi(value);
    }
    value = replaceFilesystemWellKnownValues(value, { stringType });
    value = replaceHttpUrls(value);
    value = replaceDurations(value);
    return value;
  };
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
