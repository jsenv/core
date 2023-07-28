import { Parser, getLineInfo } from "acorn";
import { importAssertions } from "acorn-import-assertions";

import { createJsParseError } from "./js_parse_error.js";

export const parseJsWithAcorn = ({ js, url, isJsModule }) => {
  const AcornParser = Parser.extend(importAssertions);
  const comments = [];

  try {
    // https://github.com/acornjs/acorn/tree/master/acorn#interface
    const jsAst = AcornParser.parse(js, {
      locations: true,
      allowAwaitOutsideFunction: true,
      sourceType: isJsModule ? "module" : "script",
      ecmaVersion: 2022,
      onComment: (block, text, start, end) => {
        comments.push({
          block,
          text,
          start,
          end,
        });
      },
    });
    jsAst.comments = comments;
    return jsAst;
  } catch (e) {
    if (e && e.name === "SyntaxError") {
      const { line, column } = getLineInfo(js, e.raisedAt);
      throw createJsParseError({
        message: e.message,
        reasonCode: e.message,
        content: js,
        url,
        line,
        column,
      });
    }
    throw e;
  }
};
