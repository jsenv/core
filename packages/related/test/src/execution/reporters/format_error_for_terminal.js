import { readFileSync } from "node:fs";
import { inspectFileContent } from "@jsenv/inspect";
import { urlToFileSystemPath } from "@jsenv/urls";
import { ANSI } from "@jsenv/log";

import { createException } from "../exception.js";

export const formatErrorForTerminal = (
  error,
  { rootDirectoryUrl, mainFileRelativeUrl, mockFluctuatingValues },
) => {
  const exception = createException(error);
  if (!exception.stack) {
    return exception.message;
  }

  let text = "";
  write_code_frame: {
    if (
      exception.site &&
      exception.site.url &&
      exception.site.url.startsWith("file:") &&
      typeof exception.site.line === "number"
    ) {
      const content = readFileSync(new URL(exception.site.url), "utf8");
      text += inspectFileContent({
        content,
        line: exception.site.line,
        column: exception.site.column,
        linesAbove: 2,
        linesBelow: 0,
        lineMaxWidth: process.stdout.columns,
        format: (string, type) => {
          return {
            line_number_aside: () => ANSI.color(string, ANSI.GREY),
            char: () => string,
            marker_overflow_left: () => ANSI.color(string, ANSI.GREY),
            marker_overflow_right: () => ANSI.color(string, ANSI.GREY),
            marker_line: () => ANSI.color(string, ANSI.RED),
            marker_column: () => ANSI.color(string, ANSI.RED),
          }[type]();
        },
      });
      text += `\n`;
    }
  }
  text += `${exception.name}: ${exception.message}`;
  write_stack: {
    let stackTrace = "";
    const stackFrames = exception.stackFrames;
    if (stackFrames) {
      let atLeastOneNonNative = false;
      let lastStackFrameForMain;
      const mainFileUrl = new URL(mainFileRelativeUrl, rootDirectoryUrl).href;
      for (const stackFrame of stackFrames) {
        if (stackFrame.url === mainFileUrl) {
          lastStackFrameForMain = stackFrame;
        }
        if (!stackFrame.native) {
          atLeastOneNonNative = true;
        }
      }

      for (const stackFrame of stackFrames) {
        if (atLeastOneNonNative && stackFrame.native) {
          continue;
        }
        let stackFrameString = stackFrame.raw;
        stackFrameString = replaceUrls(
          stackFrameString,
          ({ url, line, column }) => {
            let urlAsPath = urlToFileSystemPath(url);
            if (mockFluctuatingValues) {
              const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
              urlAsPath = urlAsPath.replace(rootDirectoryPath, "<mock>");
            }
            if (stackFrame === lastStackFrameForMain) {
              urlAsPath = ANSI.effect(urlAsPath, ANSI.BOLD);
            }
            const replacement = stringifyUrlSite({
              url: urlAsPath,
              line,
              column,
            });
            return replacement;
          },
        );
        if (stackTrace) stackTrace += "\n";
        stackTrace += stackFrameString;
      }
    } else {
      stackTrace = replaceUrls(
        exception.stackTrace,
        ({ url, line, column }) => {
          let urlAsPath = urlToFileSystemPath(url);
          if (mockFluctuatingValues) {
            const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
            urlAsPath = urlAsPath.replace(rootDirectoryPath, "<mock>");
          }
          const replacement = stringifyUrlSite({
            url: urlAsPath,
            line,
            column,
          });
          return replacement;
        },
      );
    }

    if (stackTrace) {
      text += `\n${stackTrace}`;
    }
  }
  return text;
};

const stringifyUrlSite = ({ url, line, column }) => {
  if (typeof line === "number" && typeof column === "number") {
    return `${url}:${line}:${column}`;
  }
  if (typeof line === "number") {
    return `${url}:${line}`;
  }
  return url;
};

// `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })
const replaceUrls = (source, replace) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, (match) => {
    let replacement = "";
    const lastChar = match[match.length - 1];

    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);
    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineString = lineAndColumMatch[1];
      const columnString = lineAndColumMatch[2];
      replacement = replace({
        url: match.slice(0, -lineAndColumnString.length),
        line: lineString ? parseInt(lineString) : null,
        column: columnString ? parseInt(columnString) : null,
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);
      if (lineMatch) {
        const lineString = lineMatch[0];
        replacement = replace({
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : null,
        });
      } else {
        replacement = replace({
          url: match,
        });
      }
    }
    if (endsWithSeparationChar) {
      return `${replacement}${lastChar}`;
    }
    return replacement;
  });
};
