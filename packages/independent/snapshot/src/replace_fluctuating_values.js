// content = content.replaceAll
// TODO: if textual find all things looking like urls
// and replace with process.cwd()
// replace things that looks like date
// if http urls replace with localhost
// replace evntual port with 9999?
// for .json we would parse (and ignore syntax error)
// and try to recognize value based on key
// and re-stringify
// see report_as_json.js
// ideally we would cover all this and replace with mocked values

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
  return string;
};
