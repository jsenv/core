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
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import stripAnsi from "strip-ansi";
import { createReplaceFilesystemWellKnownValues } from "./filesystem_well_known_values.js";

export const replaceFluctuatingValues = (
  value,
  {
    stringType,
    rootDirectoryUrl,
    fileUrl,
    preserveAnsi,
    // for unit test
    replaceFilesystemWellKnownValues = createReplaceFilesystemWellKnownValues({
      rootDirectoryUrl,
    }),
  } = {},
) => {
  if (fileUrl) {
    const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
    if (Buffer.isBuffer(value) && CONTENT_TYPE.isTextual(contentType)) {
      value = String(value);
    }
    if (stringType === undefined) {
      const extension = urlToExtension(fileUrl);
      if (extension === ".html") {
        stringType = "html";
      } else if (extension === ".svg") {
        stringType = "svg";
      } else if (extension === ".json" || CONTENT_TYPE.isJson(contentType)) {
        stringType = "json";
      }
    }
  }
  const replaceDurations = (string) => {
    // https://stackoverflow.com/a/59202307/24573072
    string = string.replace(
      /(?<!\d|\.)\d+(?:\.\d+)?(\s*)(seconds|second|s)\b/g,
      (match, space, unit) => {
        if (unit === "seconds") unit = "second";
        return `<X>${space}${unit}`;
      },
    );
    return string;
  };
  const replaceSizes = (string) => {
    // the size of files might slighly differ from an OS to an other
    // we round the floats to make them predictable
    // (happens for HTML files where one char is added on linux)
    string = string.replace(
      /(?<!\d|\.)(\d+(?:\.\d+)?)(\s*)(B|kB|MB)\b/g,
      (match, size, space, unit) => {
        return `${Math.round(parseFloat(size))}${space}${unit}`;
      },
    );
    return string;
  };
  const replaceThings = (string) => {
    if (stringType === "filesystem") {
      return replaceFilesystemWellKnownValues(string);
    }
    if (!preserveAnsi) {
      string = stripAnsi(string);
    }
    string = replaceFilesystemWellKnownValues(string, {
      willBeWrittenOnFilesystem: false,
    });
    string = replaceHttpUrls(string);
    string = replaceDurations(string);
    string = replaceSizes(string);
    return string;
  };
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    if (stringType === "json") {
      const jsValue = JSON.parse(value);
      const replaced = replaceInObject(jsValue, { replace: replaceThings });
      return JSON.stringify(replaced, null, "  ");
    }
    if (stringType === "html" || stringType === "svg") {
      // do parse html
      const htmlAst =
        stringType === "svg"
          ? parseSvgString(value)
          : parseHtml({
              html: value,
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
    return replaceThings(value);
  }
  if (typeof value === "object") {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    const jsValueReplaced = replaceInObject(value, { replace: replaceThings });
    return JSON.stringify(jsValueReplaced, null, "  ");
  }
  return value;
};

const replaceInObject = (object, { replace }) => {
  const deepCopy = (
    value,
    { shouldReplaceStrings, shouldReplaceNumbers } = {},
  ) => {
    if (value === null) {
      return null;
    }
    if (Array.isArray(value)) {
      const copy = [];
      let i = 0;
      while (i < value.length) {
        copy[i] = deepCopy(value[i], {
          shouldReplaceStrings,
          shouldReplaceNumbers,
        });
        i++;
      }
      return copy;
    }
    if (typeof value === "object") {
      const copy = {};
      const keysToVisit = Object.keys(value);
      for (const keyToVisit of keysToVisit) {
        const nestedValue = value[keyToVisit];
        copy[keyToVisit] = deepCopy(nestedValue, {
          shouldReplaceStrings: shouldReplaceStrings || keyToVisit === "os",
          shouldReplaceNumbers:
            shouldReplaceNumbers ||
            keyToVisit === "timings" ||
            keyToVisit === "performance" ||
            keyToVisit === "memoryUsage" ||
            keyToVisit === "cpuUsage" ||
            keyToVisit === "os",
        });
      }
      return copy;
    }
    if (typeof value === "string") {
      if (shouldReplaceStrings) {
        return "<X>";
      }
      return replace(value);
    }
    if (typeof value === "number") {
      if (shouldReplaceNumbers) {
        return "<X>";
      }
      return value;
    }
    return value;
  };
  const copy = deepCopy(object);
  return copy;
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
