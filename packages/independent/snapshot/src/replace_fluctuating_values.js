// - Find all things looking like urls and replace with stable values
// - Find all things looking likes dates and replace with stable values

import stripAnsi from "strip-ansi";
import { pathToFileURL } from "node:url";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const replaceFluctuatingValues = (
  string,
  {
    removeAnsi = true,
    // for unit tests
    cwdPath = process.cwd(),
    cwdUrl = String(pathToFileURL(cwdPath)),
    isWindows = process.platform === "win32",
  } = {},
) => {
  if (removeAnsi) {
    string = stripAnsi(string);
  }
  string = string.replaceAll(cwdUrl, "file:///cwd()");
  if (isWindows) {
    const windowPathRegex = new RegExp(
      `${escapeRegexpSpecialChars(cwdPath)}(((?:\\\\(?:[\\w !#()-]+|[.]{1,2})+)*)(?:\\\\)?)`,
      "gm",
    );
    string = string.replaceAll(windowPathRegex, (match, afterCwd) => {
      return `cwd()${afterCwd.replaceAll("\\", "/")}`;
    });
  } else {
    string = string.replaceAll(cwdPath, "cwd()");
  }
  string = replaceHttpUrls(string);
  return string;
};

const replaceHttpUrls = (source) => {
  return source.replace(/(?:https?|ftp):\/\/\S+/g, (match) => {
    const lastChar = match[match.length - 1];
    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }
    try {
      const urlObject = new URL(match);
      if (urlObject.port) {
        urlObject.port = 9999;
      }
      return urlObject.href;
    } catch (e) {
      return match;
    }
  });
};
