// https://github.com/marvinhagemeister/errorstacks/tree/main
// https://cdn.jsdelivr.net/npm/errorstacks@latest/dist/esm/index.mjs
import { parseStackTrace } from "errorstacks";

import { readFileSync } from "node:fs";
import { inspectFileContent } from "@jsenv/inspect";
import { urlIsInsideOf } from "@jsenv/urls";
import { ANSI } from "@jsenv/log";

const jsenvTestSourceDirectoryUrl = new URL("../../", import.meta.url);

export const formatErrorForTerminal = (
  error,
  { mainFileUrl, mockFluctuatingValues },
) => {
  if (!error) {
    return String(error);
  }
  if (!error.stack) {
    return error.message || error;
  }
  const calls = parseStackTrace(error.stack);
  const meaningfullCalls = [];
  for (const call of calls) {
    if (call.type === "native") {
      continue;
    }
    if (call.fileName.startsWith("node:")) {
      continue;
    }
    if (
      call.fileName.startsWith("file:") &&
      urlIsInsideOf(call.fileName, jsenvTestSourceDirectoryUrl)
    ) {
      continue;
    }
    meaningfullCalls.push(call);
  }

  let text = "";
  write_code_frame: {
    const firstCall = calls[0];
    if (
      typeof firstCall.line === "number" &&
      firstCall.fileName.startsWith("file:")
    ) {
      const content = readFileSync(new URL(firstCall.fileName), "utf8");
      text += inspectFileContent({
        content,
        line: firstCall.line,
        column: firstCall.column,
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
    let stackTrace = "";
    for (const call of meaningfullCalls.length ? meaningfullCalls : calls) {
      if (stackTrace) stackTrace += "\n";
      let trace = call.raw;
      trace = trace.replace(mainFileUrl, ANSI.effect(mainFileUrl, ANSI.BOLD));
      // ideally replace file:// by path version
      // but here it must happen for every url like thing
      // TODO: if mockFluctuatingValues
      stackTrace += trace;
    }
    if (stackTrace) {
      text += `\n${stackTrace}`;
    }
  }
  return text;
};
