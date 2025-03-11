import { ANSI, generateContentFrame } from "@jsenv/humanize";
import { urlToFileSystemPath } from "@jsenv/urls";
import { readFileSync } from "node:fs";

import { replaceUrls } from "./replace_urls.js";

export const formatErrorForTerminal = (
  error,
  { rootDirectoryUrl, mainFileRelativeUrl, mockFluctuatingValues, tryColors },
) => {
  if (!error.stack) {
    return error.message;
  }

  let ansiSupported = ANSI.supported;
  if (!tryColors) {
    ANSI.supported = false;
  }

  let text = "";
  write_code_frame: {
    if (
      error.site &&
      error.site.url &&
      error.site.url.startsWith("file:") &&
      typeof error.site.line === "number"
    ) {
      try {
        const content = readFileSync(new URL(error.site.url), "utf8");
        text += generateContentFrame({
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
      } catch {}
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
        urlAsPath = urlAsPath.replace(rootDirectoryPath, "[mock]");
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

  if (!tryColors) {
    ANSI.supported = ansiSupported;
  }

  return text;
};
