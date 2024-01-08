import { readFileSync } from "node:fs";
import { inspectFileContent } from "@jsenv/inspect";
import { urlToFileSystemPath } from "@jsenv/urls";
import { ANSI } from "@jsenv/log";

export const formatErrorForTerminal = (
  error,
  { rootDirectoryUrl, mainFileRelativeUrl, mockFluctuatingValues },
) => {
  if (!error.stack) {
    return error.message;
  }

  let text = "";
  write_code_frame: {
    if (
      error.site &&
      error.site.url &&
      error.site.url.startsWith("file:") &&
      typeof error.site.line === "number"
    ) {
      const content = readFileSync(new URL(error.site.url), "utf8");
      text += inspectFileContent({
        content,
        line: error.site.line,
        column: error.site.column,
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
  text += `${error.name}: ${error.message}`;
  write_stack: {
    const stringifyUrlSite = ({ url, line, column, urlIsMain }) => {
      let urlAsPath = String(url).startsWith("file:")
        ? urlToFileSystemPath(url)
        : url;
      if (mockFluctuatingValues) {
        const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
        urlAsPath = urlAsPath.replace(rootDirectoryPath, "<mock>");
        if (process.platform === "win32") {
          urlAsPath = urlAsPath.replace(/\\/g, "/");
        }
      }
      if (urlIsMain) {
        urlAsPath = ANSI.effect(urlAsPath, ANSI.BOLD);
      }
      if (typeof line === "number" && typeof column === "number") {
        return `${urlAsPath}:${line}:${column}`;
      }
      if (typeof line === "number") {
        return `${urlAsPath}:${line}`;
      }
      return urlAsPath;
    };

    let stackTrace = "";
    const stackFrames = error.stackFrames;
    if (stackFrames && stackFrames.length) {
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
            const replacement = stringifyUrlSite({
              url,
              urlIsMain: stackFrame === lastStackFrameForMain,
              line,
              column,
            });
            return replacement;
          },
        );
        if (stackTrace) stackTrace += "\n";
        stackTrace += stackFrameString;
      }
    } else if (error.stackTrace) {
      stackTrace = replaceUrls(error.stackTrace, ({ url, line, column }) => {
        const replacement = stringifyUrlSite({
          url,
          line,
          column,
        });
        return replacement;
      });
    } else if (error.site) {
      stackTrace += `  ${stringifyUrlSite({
        url: error.site.url,
        line: error.site.line,
        column: error.site.column,
      })}`;
    }

    if (stackTrace) {
      text += `\n${stackTrace}`;
    }
  }
  return text;
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
